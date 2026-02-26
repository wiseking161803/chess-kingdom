const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Chess } = require('chess.js');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for PGN uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'pgn');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Parse PGN move text into a move tree with variations.
 * Returns array of move nodes: { move: "e4", alternatives: ["d4", "c4"] }
 *
 * For player moves: alternatives = other valid moves (any is correct)
 * For opponent moves: alternatives = other possible responses (info only)
 */
function parseMoveTree(movesText, fen) {
    // Clean annotations but KEEP variations in parentheses
    let cleaned = movesText
        .replace(/\{[^}]*\}/g, '')           // Remove comments {text}
        .replace(/\$\d+/g, '')               // Remove NAG annotations ($1, $2)
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove results
        .trim();

    if (!cleaned) return [];

    // Tokenize: split into moves, parentheses, and move numbers
    const tokens = tokenize(cleaned);

    // Parse tokens into a move tree
    const chess = new Chess(fen);
    const mainLine = [];

    parseTokens(tokens, chess, mainLine, fen);

    return mainLine;
}

/**
 * Tokenize PGN move text into an array of tokens
 */
function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
        // Skip whitespace
        if (/\s/.test(text[i])) { i++; continue; }

        // Opening paren — start of variation
        if (text[i] === '(') {
            tokens.push({ type: 'OPEN_PAREN' });
            i++; continue;
        }

        // Closing paren — end of variation
        if (text[i] === ')') {
            tokens.push({ type: 'CLOSE_PAREN' });
            i++; continue;
        }

        // Move number like "1." or "1..." — skip
        if (/\d/.test(text[i])) {
            let num = '';
            while (i < text.length && /[\d.]/.test(text[i])) {
                num += text[i]; i++;
            }
            // Skip whitespace after move number
            while (i < text.length && /\s/.test(text[i])) i++;
            continue;
        }

        // SAN move token
        if (/[a-zA-ZO]/.test(text[i])) {
            let move = '';
            while (i < text.length && /[a-zA-Z0-9+#=\-]/.test(text[i])) {
                move += text[i]; i++;
            }
            if (move) tokens.push({ type: 'MOVE', value: move });
            continue;
        }

        i++; // Skip unknown chars
    }
    return tokens;
}

/**
 * Parse token stream into main line with alternatives
 */
function parseTokens(tokens, chess, mainLine, startFen) {
    let pos = 0;

    while (pos < tokens.length) {
        const token = tokens[pos];

        if (token.type === 'CLOSE_PAREN') {
            // End of current variation scope
            break;
        }

        if (token.type === 'OPEN_PAREN') {
            // Variation — this is an alternative to the LAST move in mainLine
            pos++; // skip '('

            // The variation replaces the last move played.
            // We need to undo it and try the alternative.
            const lastNode = mainLine[mainLine.length - 1];
            if (lastNode) {
                // Undo the last main line move to try the variation
                chess.undo();

                // Collect alternative moves within this variation
                const altMoves = [];
                let depth = 0;
                while (pos < tokens.length) {
                    if (tokens[pos].type === 'OPEN_PAREN') { depth++; pos++; continue; }
                    if (tokens[pos].type === 'CLOSE_PAREN') {
                        if (depth === 0) { pos++; break; }
                        depth--; pos++; continue;
                    }
                    if (tokens[pos].type === 'MOVE' && depth === 0) {
                        // Only capture the first move of the variation as an alternative
                        if (altMoves.length === 0) {
                            try {
                                const tempChess = new Chess(chess.fen());
                                const result = tempChess.move(tokens[pos].value);
                                if (result) altMoves.push(result.san);
                            } catch (e) { }
                        }
                    }
                    pos++;
                }

                // Add alternatives to the last main line node
                for (const alt of altMoves) {
                    if (!lastNode.alternatives.includes(alt) && alt !== lastNode.move) {
                        lastNode.alternatives.push(alt);
                    }
                }

                // Re-apply the main line move
                try { chess.move(lastNode.move); } catch (e) { }
            }
            continue;
        }

        if (token.type === 'MOVE') {
            try {
                const result = chess.move(token.value);
                if (result) {
                    mainLine.push({ move: result.san, alternatives: [] });
                }
            } catch (e) {
                // Skip invalid move
            }
            pos++;
            continue;
        }

        pos++;
    }
}

/**
 * Parse PGN content into individual puzzles
 */
function parsePGN(pgnContent) {
    const puzzles = [];
    // Fix: handle mixed line endings (\r\n and \n)
    const normalized = pgnContent.replace(/\r\n/g, '\n');
    // Split PGN into individual games — empty line before a header
    const games = normalized.split(/\n\n(?=\[)/).filter(g => g.trim());

    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        try {
            // Extract headers
            const headers = {};
            const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
            let match;
            while ((match = headerRegex.exec(game)) !== null) {
                headers[match[1]] = match[2];
            }

            // Extract moves (everything after the last header line)
            const movesText = game.replace(/\[.*?\]\s*/g, '').trim();
            if (!movesText) continue;

            // Get FEN or use default starting position
            const fen = headers.FEN || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

            // Parse move tree (with variations)
            const moveTree = parseMoveTree(movesText, fen);

            if (moveTree.length > 0) {
                // Determine orientation from FEN
                const orientation = fen.includes(' w ') ? 'white' : 'black';

                puzzles.push({
                    fen,
                    solution_moves: JSON.stringify(moveTree),
                    orientation,
                    tags: headers.Event || headers.Site || null,
                    elo_rating: headers.Rating ? parseInt(headers.Rating, 10) : null
                });
            }
        } catch (e) {
            console.error(`Error parsing game ${i}:`, e.message);
        }
    }

    return puzzles;
}

/**
 * POST /api/puzzles/sets — Upload PGN and create puzzle set (admin only)
 */
router.post('/sets', authenticate, requireAdmin, upload.single('pgn_file'), async (req, res) => {
    try {
        const { name, description, difficulty, play_mode, solve_mode } = req.body;
        let pgnContent = '';

        if (req.file) {
            pgnContent = fs.readFileSync(req.file.path, 'utf-8');
        } else if (req.body.pgn_content) {
            pgnContent = req.body.pgn_content;
        } else {
            return res.status(400).json({ error: 'Vui lòng upload file PGN hoặc nhập nội dung PGN' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Vui lòng nhập tên bộ puzzle' });
        }

        // Parse PGN into puzzles
        const puzzles = parsePGN(pgnContent);

        if (puzzles.length === 0) {
            return res.status(400).json({ error: 'Không tìm thấy puzzle hợp lệ trong file PGN' });
        }

        // Validate play_mode
        const validModes = ['first', 'second'];
        const mode = validModes.includes(play_mode) ? play_mode : 'first';
        const validSolveModes = ['basic', 'focus', 'memory', 'opening'];
        const sMode = validSolveModes.includes(solve_mode) ? solve_mode : 'basic';

        // Create puzzle set
        const [result] = await db.query(
            'INSERT INTO puzzle_sets (name, description, difficulty, play_mode, solve_mode, puzzle_count, pgn_content, created_by) VALUES (?,?,?,?,?,?,?,?)',
            [name, description || null, difficulty || 'beginner', mode, sMode, puzzles.length, pgnContent, req.user.id]
        );

        const setId = result.insertId;

        // Insert individual puzzles
        for (let i = 0; i < puzzles.length; i++) {
            const p = puzzles[i];
            await db.query(
                'INSERT INTO puzzles (puzzle_set_id, puzzle_index, fen, solution_moves, orientation, tags, elo_rating) VALUES (?,?,?,?,?,?,?)',
                [setId, i, p.fen, p.solution_moves, p.orientation, p.tags, p.elo_rating]
            );
        }

        res.status(201).json({
            message: `Đã tạo bộ puzzle "${name}" với ${puzzles.length} bài tập`,
            puzzle_set: { id: setId, name, puzzle_count: puzzles.length }
        });
    } catch (err) {
        console.error('Create puzzle set error:', err);
        res.status(500).json({ error: 'Lỗi tạo bộ puzzle' });
    }
});

/**
 * GET /api/puzzles/sets — List all puzzle sets
 */
router.get('/sets', authenticate, async (req, res) => {
    try {
        const [sets] = await db.query(`
            SELECT ps.id, ps.name, ps.description, ps.difficulty, ps.play_mode,
                   ps.puzzle_count, ps.is_active, ps.created_at,
                   u.display_name as created_by_name
            FROM puzzle_sets ps
            LEFT JOIN users u ON ps.created_by = u.id
            WHERE ps.is_active = 1
            ORDER BY ps.created_at DESC
        `);

        // Get user progress for each set
        for (const set of sets) {
            const [progress] = await db.query(`
                SELECT COUNT(*) as solved, MAX(stars_earned) as best_stars
                FROM puzzle_progress
                WHERE user_id = ? AND puzzle_set_id = ? AND solved = 1
            `, [req.user.id, set.id]);

            set.user_solved = progress[0]?.solved || 0;
            set.user_best_stars = progress[0]?.best_stars || 0;
            set.completion_pct = set.puzzle_count > 0 ? Math.round((set.user_solved / set.puzzle_count) * 100) : 0;
        }

        res.json({ puzzle_sets: sets });
    } catch (err) {
        console.error('List puzzle sets error:', err);
        res.status(500).json({ error: 'Lỗi lấy danh sách puzzle' });
    }
});

/**
 * GET /api/puzzles/sets/:id — Get specific puzzle set with puzzles
 */
router.get('/sets/:id', authenticate, async (req, res) => {
    try {
        const setId = req.params.id;

        const [sets] = await db.query('SELECT * FROM puzzle_sets WHERE id = ? AND is_active = 1', [setId]);
        if (sets.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bộ puzzle' });
        }

        const [puzzles] = await db.query(
            'SELECT id, puzzle_index, fen, solution_moves, orientation, tags FROM puzzles WHERE puzzle_set_id = ? ORDER BY puzzle_index',
            [setId]
        );

        // Get user progress
        const [progress] = await db.query(
            'SELECT puzzle_index, solved, attempts, hints_used, stars_earned FROM puzzle_progress WHERE user_id = ? AND puzzle_set_id = ?',
            [req.user.id, setId]
        );

        const progressMap = {};
        for (const p of progress) {
            progressMap[p.puzzle_index] = p;
        }

        const enrichedPuzzles = puzzles.map(p => ({
            ...p,
            solution_moves: JSON.parse(p.solution_moves),
            user_progress: progressMap[p.puzzle_index] || null
        }));

        res.json({
            puzzle_set: sets[0],
            puzzles: enrichedPuzzles
        });
    } catch (err) {
        console.error('Get puzzle set error:', err);
        res.status(500).json({ error: 'Lỗi lấy puzzle' });
    }
});

/**
 * POST /api/puzzles/hint-penalty — Deduct ELO for using a hint
 */
router.post('/hint-penalty', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const eloChange = -10;

        await db.query(
            'UPDATE user_elo SET current_elo = GREATEST(0, current_elo + ?) WHERE user_id = ?',
            [eloChange, userId]
        );

        // Snapshot ELO to history
        const today = new Date().toISOString().split('T')[0];
        const [updatedElo] = await db.query('SELECT current_elo, puzzles_solved, puzzles_attempted FROM user_elo WHERE user_id = ?', [userId]);
        if (updatedElo.length > 0) {
            await db.query(`
                INSERT INTO elo_history (user_id, elo, puzzles_solved, puzzles_attempted, record_date)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE elo = VALUES(elo), puzzles_solved = VALUES(puzzles_solved), puzzles_attempted = VALUES(puzzles_attempted)
            `, [userId, updatedElo[0].current_elo, updatedElo[0].puzzles_solved, updatedElo[0].puzzles_attempted, today]);
        }

        res.json({ elo_change: eloChange, new_elo: updatedElo[0]?.current_elo || 800 });
    } catch (err) {
        console.error('Hint penalty error:', err);
        res.status(500).json({ error: 'Lỗi trừ ELO' });
    }
});

/**
 * POST /api/puzzles/solve — Submit puzzle solution
 */
router.post('/solve', authenticate, async (req, res) => {
    try {
        const { puzzle_set_id, puzzle_index, solved, attempts, hints_used, time_seconds } = req.body;
        const userId = req.user.id;

        // Calculate stars: 3 stars (perfect), 2 stars (1 hint), 1 star (solved with help)
        let starsEarned = 0;
        if (solved) {
            if (hints_used === 0 && attempts <= 1) {
                starsEarned = 3;
            } else if (hints_used <= 1 && attempts <= 3) {
                starsEarned = 2;
            } else {
                starsEarned = 1;
            }
        }

        // Check previous solve state BEFORE upsert (to know if re-solving)
        const [prevSolveCheck] = await db.query(
            'SELECT solved FROM puzzle_progress WHERE user_id = ? AND puzzle_set_id = ? AND puzzle_index = ?',
            [userId, puzzle_set_id, puzzle_index]
        );
        const wasPreviouslySolved = prevSolveCheck.length > 0 && prevSolveCheck[0].solved === 1;

        // Upsert puzzle progress
        await db.query(`
            INSERT INTO puzzle_progress (user_id, puzzle_set_id, puzzle_index, solved, attempts, hints_used, stars_earned, best_time_seconds, solved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${solved ? 'NOW()' : 'NULL'})
            ON DUPLICATE KEY UPDATE
                solved = IF(VALUES(solved) = 1, 1, solved),
                attempts = attempts + VALUES(attempts),
                hints_used = hints_used + VALUES(hints_used),
                stars_earned = GREATEST(stars_earned, VALUES(stars_earned)),
                best_time_seconds = IF(VALUES(best_time_seconds) IS NOT NULL AND (best_time_seconds IS NULL OR VALUES(best_time_seconds) < best_time_seconds), VALUES(best_time_seconds), best_time_seconds),
                solved_at = IF(solved_at IS NULL AND VALUES(solved) = 1, NOW(), solved_at)
        `, [userId, puzzle_set_id, puzzle_index, solved ? 1 : 0, attempts || 1, hints_used || 0, starsEarned, time_seconds || null]);

        // If solved, update stars and ELO
        let eloChange = 0;

        if (solved && starsEarned > 0) {
            const [prev] = await db.query(
                'SELECT stars_earned FROM puzzle_progress WHERE user_id = ? AND puzzle_set_id = ? AND puzzle_index = ?',
                [userId, puzzle_set_id, puzzle_index]
            );

            const prevStars = prev[0]?.stars_earned || 0;
            const newStarsToAdd = Math.max(0, starsEarned - prevStars);

            if (newStarsToAdd > 0) {
                await db.query(
                    'UPDATE user_currencies SET knowledge_stars = knowledge_stars + ?, total_stars_earned = total_stars_earned + ? WHERE user_id = ?',
                    [newStarsToAdd, newStarsToAdd, userId]
                );

                const [curr] = await db.query('SELECT knowledge_stars FROM user_currencies WHERE user_id = ?', [userId]);
                await db.query(
                    'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
                    [userId, 'stars', newStarsToAdd, curr[0]?.knowledge_stars || 0, 'puzzle', `Puzzle ${puzzle_set_id}:${puzzle_index}`]
                );
            }
        }

        // ELO: skip if re-solving a previously solved puzzle
        const alreadySolvedBefore = wasPreviouslySolved && solved;

        const isEloRated = req.body.is_elo_rated !== false;

        if (!alreadySolvedBefore && isEloRated) {
            // Per-puzzle rating from PGN [Rating] header, fallback to set-level rating
            const [puzzleRows] = await db.query('SELECT elo_rating FROM puzzles WHERE puzzle_set_id = ? AND puzzle_index = ?', [puzzle_set_id, puzzle_index]);
            const perPuzzleRating = puzzleRows[0]?.elo_rating;
            const [setRows] = await db.query('SELECT elo_rating FROM puzzle_sets WHERE id = ?', [puzzle_set_id]);
            const puzzleRating = perPuzzleRating || setRows[0]?.elo_rating;
            const [eloRows] = await db.query('SELECT current_elo FROM user_elo WHERE user_id = ?', [userId]);
            const playerElo = eloRows[0]?.current_elo || 800;

            if (solved) {
                // Won: +ELO
                if (puzzleRating) {
                    const K = 32;
                    const expected = 1 / (1 + Math.pow(10, (puzzleRating - playerElo) / 400));
                    eloChange = Math.round(K * (1 - expected) / 4);
                } else {
                    eloChange = 1;
                }
            } else {
                // Failed: -ELO
                if (puzzleRating) {
                    const K = 32;
                    const expected = 1 / (1 + Math.pow(10, (puzzleRating - playerElo) / 400));
                    eloChange = Math.round(K * (0 - expected));
                } else {
                    eloChange = -1;
                }
            }
        }

        if (solved) {
            await db.query(`
                UPDATE user_elo SET
                    current_elo = GREATEST(0, current_elo + ?),
                    peak_elo = GREATEST(peak_elo, current_elo + ?),
                    puzzles_solved = puzzles_solved + 1,
                    puzzles_attempted = puzzles_attempted + 1
                WHERE user_id = ?
            `, [eloChange, eloChange, userId]);

            // Update streak
            const today = new Date().toISOString().split('T')[0];
            const [streakRow] = await db.query('SELECT * FROM user_streaks WHERE user_id = ?', [userId]);
            if (streakRow.length > 0) {
                const lastDate = streakRow[0].last_active_date;
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                if (lastDate === today) {
                    // Already active today
                } else if (lastDate === yesterday) {
                    await db.query(
                        'UPDATE user_streaks SET current_streak = current_streak + 1, longest_streak = GREATEST(longest_streak, current_streak + 1), last_active_date = ? WHERE user_id = ?',
                        [today, userId]
                    );
                } else {
                    await db.query(
                        'UPDATE user_streaks SET current_streak = 1, last_active_date = ? WHERE user_id = ?',
                        [today, userId]
                    );
                }
            }
        } else {
            await db.query(
                'UPDATE user_elo SET current_elo = GREATEST(0, current_elo + ?), puzzles_attempted = puzzles_attempted + 1 WHERE user_id = ?',
                [eloChange, userId]
            );
        }

        // Snapshot ELO to history (1 record per day for charts)
        const today = new Date().toISOString().split('T')[0];
        const [updatedElo] = await db.query('SELECT current_elo, puzzles_solved, puzzles_attempted FROM user_elo WHERE user_id = ?', [userId]);
        if (updatedElo.length > 0) {
            await db.query(`
                INSERT INTO elo_history (user_id, elo, puzzles_solved, puzzles_attempted, record_date)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE elo = VALUES(elo), puzzles_solved = VALUES(puzzles_solved), puzzles_attempted = VALUES(puzzles_attempted)
            `, [userId, updatedElo[0].current_elo, updatedElo[0].puzzles_solved, updatedElo[0].puzzles_attempted, today]);
        }

        // Get updated stats
        const [stats] = await db.query(
            'SELECT uc.knowledge_stars, uc.chess_coins, ue.current_elo FROM user_currencies uc JOIN user_elo ue ON uc.user_id = ue.user_id WHERE uc.user_id = ?',
            [userId]
        );

        res.json({
            solved,
            stars_earned: starsEarned,
            elo_change: eloChange,
            stats: stats[0] || {},
            message: solved ? `Tuyệt vời! Bạn nhận được ${starsEarned} ⭐` : 'Cố gắng lần sau nhé!'
        });
    } catch (err) {
        console.error('Solve puzzle error:', err);
        res.status(500).json({ error: 'Lỗi ghi nhận kết quả' });
    }
});

/**
 * DELETE /api/puzzles/sets/:id — Delete puzzle set (admin only)
 */
router.delete('/sets/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE puzzle_sets SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Đã xóa bộ puzzle' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa' });
    }
});

/**
 * POST /api/puzzles/sessions/end — Save a puzzle session
 */
router.post('/sessions/end', authenticate, async (req, res) => {
    try {
        const { puzzle_set_id, mode, puzzles_solved, puzzles_failed, total_time_seconds, accuracy, elo_change } = req.body;
        const userId = req.user.id;

        await db.query(
            `INSERT INTO puzzle_sessions (user_id, puzzle_set_id, mode, puzzles_solved, puzzles_failed, total_time_seconds, accuracy, elo_change)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, puzzle_set_id, mode || 'basic', puzzles_solved || 0, puzzles_failed || 0, total_time_seconds || 0, accuracy || 0, elo_change || 0]
        );

        res.json({ message: 'Đã lưu phiên làm bài' });
    } catch (err) {
        console.error('Save session error:', err);
        res.status(500).json({ error: 'Lỗi lưu phiên' });
    }
});

module.exports = router;
