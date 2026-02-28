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

// ═══════════════════════════════════════════════════════════════════
// PGN PARSER — Full variation tree support with comments, NAGs,
// arrows ([%cal]), highlights ([%csl]), and recursive variations
// ═══════════════════════════════════════════════════════════════════

/**
 * NAG symbol mapping: annotation symbols → NAG numbers
 */
const ANNOTATION_TO_NAG = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };
const NAG_TO_SYMBOL = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };

/**
 * ChessBase annotation color codes
 */
const CB_COLORS = {
    R: '#e74c3c', G: '#2ecc71', B: '#3498db',
    Y: '#f1c40f', C: '#1abc9c', M: '#9b59b6'
};

/**
 * SAN regex for move matching
 */
const SAN_REGEX = /^(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?)/;

/**
 * Parse comment text extracting ChessBase annotations:
 *   [%cal Ge2e4,Re7e5] → arrows
 *   [%csl Gd5,Re4]     → highlights
 * Returns { text, arrows, highlights }
 */
function parseComment(raw) {
    if (!raw) return { text: '', arrows: [], highlights: [] };
    let text = raw;
    const arrows = [];
    const highlights = [];

    // Parse [%cal ...] → arrows
    text = text.replace(/\[%cal\s+([^\]]+)\]/gi, (_, content) => {
        content.split(',').forEach(item => {
            item = item.trim();
            if (item.length >= 5) {
                const colorChar = item[0].toUpperCase();
                const from = item.substring(1, 3);
                const to = item.substring(3, 5);
                arrows.push({
                    color: CB_COLORS[colorChar] || CB_COLORS.G,
                    from, to
                });
            }
        });
        return '';
    });

    // Parse [%csl ...] → highlights
    text = text.replace(/\[%csl\s+([^\]]+)\]/gi, (_, content) => {
        content.split(',').forEach(item => {
            item = item.trim();
            if (item.length >= 3) {
                const colorChar = item[0].toUpperCase();
                const square = item.substring(1, 3);
                highlights.push({
                    color: CB_COLORS[colorChar] || CB_COLORS.G,
                    square
                });
            }
        });
        return '';
    });

    // Strip other ChessBase annotations we don't use
    text = text.replace(/\[%(evp|mdl|clk|emt)\s+[^\]]*\]/gi, '');
    text = text.trim();

    return { text, arrows, highlights };
}

/**
 * Tokenize PGN move text into structured tokens.
 * Token types: MOVE, MOVE_NUMBER, COMMENT, VARIATION_START, VARIATION_END, NAG, RESULT
 */
function tokenize(text) {
    const tokens = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
        // Skip whitespace
        if (/\s/.test(text[i])) { i++; continue; }

        // Comment { ... }
        if (text[i] === '{') {
            i++; // skip '{'
            let comment = '';
            let depth = 1;
            while (i < len && depth > 0) {
                if (text[i] === '{') depth++;
                else if (text[i] === '}') { depth--; if (depth === 0) break; }
                comment += text[i];
                i++;
            }
            i++; // skip '}'
            tokens.push({ type: 'COMMENT', value: comment });
            continue;
        }

        // Variation start
        if (text[i] === '(') {
            tokens.push({ type: 'VARIATION_START' });
            i++; continue;
        }

        // Variation end
        if (text[i] === ')') {
            tokens.push({ type: 'VARIATION_END' });
            i++; continue;
        }

        // NAG: $1, $2, etc.
        if (text[i] === '$') {
            i++; // skip '$'
            let num = '';
            while (i < len && /\d/.test(text[i])) { num += text[i]; i++; }
            if (num) tokens.push({ type: 'NAG', value: parseInt(num, 10) });
            continue;
        }

        // Result: 1-0, 0-1, 1/2-1/2, *
        if (text[i] === '*') {
            tokens.push({ type: 'RESULT', value: '*' });
            i++; continue;
        }
        if (i + 2 < len && text.substring(i, i + 3) === '1-0') {
            tokens.push({ type: 'RESULT', value: '1-0' }); i += 3; continue;
        }
        if (i + 2 < len && text.substring(i, i + 3) === '0-1') {
            tokens.push({ type: 'RESULT', value: '0-1' }); i += 3; continue;
        }
        if (i + 6 < len && text.substring(i, i + 7) === '1/2-1/2') {
            tokens.push({ type: 'RESULT', value: '1/2-1/2' }); i += 7; continue;
        }

        // Move number: "1." or "1..."
        if (/\d/.test(text[i])) {
            let num = '';
            while (i < len && /\d/.test(text[i])) { num += text[i]; i++; }
            // Skip dots after move number
            while (i < len && text[i] === '.') i++;
            if (num) tokens.push({ type: 'MOVE_NUMBER', value: parseInt(num, 10) });
            continue;
        }

        // SAN move (starts with letter or O for castling)
        if (/[a-zA-ZO]/.test(text[i])) {
            const remaining = text.substring(i);
            const match = remaining.match(SAN_REGEX);
            if (match) {
                const san = match[1];
                i += san.length;
                tokens.push({ type: 'MOVE', value: san });

                // Check for annotation symbols immediately after move: !, ?, !!, ??, !?, ?!
                while (i < len && /\s/.test(text[i])) i++; // skip whitespace
                if (i < len && (text[i] === '!' || text[i] === '?')) {
                    let ann = text[i]; i++;
                    if (i < len && (text[i] === '!' || text[i] === '?')) {
                        ann += text[i]; i++;
                    }
                    if (ANNOTATION_TO_NAG[ann] !== undefined) {
                        tokens.push({ type: 'NAG', value: ANNOTATION_TO_NAG[ann] });
                    }
                }
                continue;
            }
            // If no SAN match, skip the character
            i++;
            continue;
        }

        // Annotation symbols standalone: !, ?, etc
        if (text[i] === '!' || text[i] === '?') {
            let ann = text[i]; i++;
            if (i < len && (text[i] === '!' || text[i] === '?')) {
                ann += text[i]; i++;
            }
            if (ANNOTATION_TO_NAG[ann] !== undefined) {
                tokens.push({ type: 'NAG', value: ANNOTATION_TO_NAG[ann] });
            }
            continue;
        }

        i++; // Skip unknown chars
    }
    return tokens;
}

/**
 * Recursively parse a token sequence into a move node array.
 * Each MoveNode: { move, comment, nags, arrows, highlights, variations, alternatives }
 *
 * @param {Array} tokens - Token array
 * @param {Object} state - { pos: current position }
 * @param {Chess} chess  - chess.js instance (mutated)
 * @returns {Array<MoveNode>}
 */
function parseSequence(tokens, state, chess) {
    const moves = [];
    let currentMoveNumber = 1;

    while (state.pos < tokens.length) {
        const token = tokens[state.pos];

        // End of variation scope
        if (token.type === 'VARIATION_END') {
            break;
        }

        // Skip results
        if (token.type === 'RESULT') {
            state.pos++;
            continue;
        }

        // Track move numbers
        if (token.type === 'MOVE_NUMBER') {
            currentMoveNumber = token.value;
            state.pos++;
            continue;
        }

        // Actual move
        if (token.type === 'MOVE') {
            const isWhiteTurn = chess.turn() === 'w';
            const fenBeforeMove = chess.fen();

            let moveResult;
            try {
                moveResult = chess.move(token.value);
            } catch (e) {
                state.pos++;
                continue;
            }
            if (!moveResult) { state.pos++; continue; }

            const node = {
                move: moveResult.san,
                moveNumber: currentMoveNumber,
                isWhite: isWhiteTurn,
                comment: '',
                nags: [],
                arrows: [],
                highlights: [],
                variations: [],
                alternatives: []  // backward compatibility
            };

            state.pos++;

            // Collect NAGs and comments after the move
            while (state.pos < tokens.length) {
                const next = tokens[state.pos];
                if (next.type === 'NAG') {
                    node.nags.push(next.value);
                    state.pos++;
                } else if (next.type === 'COMMENT') {
                    const parsed = parseComment(next.value);
                    node.comment = (node.comment ? node.comment + ' ' : '') + parsed.text;
                    node.arrows.push(...parsed.arrows);
                    node.highlights.push(...parsed.highlights);
                    state.pos++;
                } else {
                    break;
                }
            }

            // Collect variations (recursive) — each ( ... ) after the move
            while (state.pos < tokens.length && tokens[state.pos].type === 'VARIATION_START') {
                state.pos++; // skip '('

                // Save chess state before entering variation
                const savedFen = chess.fen();
                // Undo the mainline move to get the position BEFORE this move
                chess.undo();

                // Parse the variation recursively
                const variationMoves = parseSequence(tokens, state, chess);

                // Skip the closing ')'
                if (state.pos < tokens.length && tokens[state.pos].type === 'VARIATION_END') {
                    state.pos++;
                }

                if (variationMoves.length > 0) {
                    node.variations.push(variationMoves);
                    // Add first move of variation to alternatives (backward compat)
                    const altSan = variationMoves[0].move;
                    if (altSan !== node.move && !node.alternatives.includes(altSan)) {
                        node.alternatives.push(altSan);
                    }
                }

                // Restore chess state (re-apply mainline move)
                chess.load(savedFen);
            }

            moves.push(node);
            continue;
        }

        // Skip comments at the start of a sequence (game comment or variation comment)
        if (token.type === 'COMMENT') {
            // Attach to previous move if exists, otherwise skip
            if (moves.length > 0) {
                const parsed = parseComment(token.value);
                const lastMove = moves[moves.length - 1];
                lastMove.comment = (lastMove.comment ? lastMove.comment + ' ' : '') + parsed.text;
                lastMove.arrows.push(...parsed.arrows);
                lastMove.highlights.push(...parsed.highlights);
            }
            state.pos++;
            continue;
        }

        state.pos++;
    }

    return moves;
}

/**
 * Parse PGN move text into a full move tree with variations.
 * Returns array of MoveNodes (mainline), each potentially containing
 * nested variations arrays.
 *
 * MoveNode: {
 *   move: "Nf3",           // SAN
 *   moveNumber: 1,         // Move number
 *   isWhite: true,         // White's move?
 *   comment: "Good move",  // Text comment
 *   nags: [1],             // NAG numbers
 *   arrows: [{color, from, to}],     // [%cal] annotations
 *   highlights: [{color, square}],   // [%csl] annotations
 *   variations: [[MoveNode, ...]], // Alternative lines
 *   alternatives: ["d4"]   // First moves of variations (backward compat)
 * }
 */
function parseMoveTree(movesText, fen) {
    if (!movesText || !movesText.trim()) return [];

    const tokens = tokenize(movesText);
    if (tokens.length === 0) return [];

    const chess = new Chess(fen);
    const state = { pos: 0 };
    const moves = parseSequence(tokens, state, chess);

    return moves;
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

            // Parse move tree (with full variations)
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
            'INSERT INTO puzzle_sets (name, description, difficulty, play_mode, solve_mode, puzzle_count, pgn_content, created_by, group_name, theme) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [name, description || null, difficulty || 'beginner', mode, sMode, puzzles.length, pgnContent, req.user.id, req.body.group_name || null, req.body.theme || null]
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
        let sets;
        try {
            [sets] = await db.query(`
                SELECT ps.id, ps.name, ps.group_name, ps.description, ps.difficulty, ps.play_mode,
                       ps.solve_mode, ps.puzzle_count, ps.is_active, ps.created_at, ps.theme,
                       u.display_name as created_by_name
                FROM puzzle_sets ps
                LEFT JOIN users u ON ps.created_by = u.id
                WHERE ps.is_active = 1
                ORDER BY ps.created_at DESC
            `);
        } catch (colErr) {
            // Fallback if group_name column doesn't exist yet
            [sets] = await db.query(`
                SELECT ps.id, ps.name, NULL as group_name, ps.description, ps.difficulty, ps.play_mode,
                       ps.solve_mode, ps.puzzle_count, ps.is_active, ps.created_at, ps.theme,
                       u.display_name as created_by_name
                FROM puzzle_sets ps
                LEFT JOIN users u ON ps.created_by = u.id
                WHERE ps.is_active = 1
                ORDER BY ps.created_at DESC
            `);
        }

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
 * PUT /api/puzzles/sets/:id — Update puzzle set (admin only)
 */
router.put('/sets/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, description, difficulty, play_mode, solve_mode, group_name } = req.body;
        const fields = [];
        const values = [];

        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (description !== undefined) { fields.push('description = ?'); values.push(description || null); }
        if (difficulty !== undefined) { fields.push('difficulty = ?'); values.push(difficulty); }
        if (play_mode !== undefined) { fields.push('play_mode = ?'); values.push(play_mode); }
        if (solve_mode !== undefined) { fields.push('solve_mode = ?'); values.push(solve_mode); }
        if (group_name !== undefined) { fields.push('group_name = ?'); values.push(group_name || null); }
        if (req.body.theme !== undefined) { fields.push('theme = ?'); values.push(req.body.theme || null); }

        if (fields.length === 0) return res.status(400).json({ error: 'Không có gì để cập nhật' });

        values.push(req.params.id);
        await db.query(`UPDATE puzzle_sets SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Đã cập nhật!' });
    } catch (err) {
        console.error('Update puzzle set error:', err);
        res.status(500).json({ error: 'Lỗi cập nhật' });
    }
});

/**
 * GET /api/puzzles/groups — Get all distinct group names
 */
router.get('/groups', authenticate, async (req, res) => {
    try {
        const [groups] = await db.query(
            `SELECT DISTINCT group_name FROM puzzle_sets WHERE is_active = 1 AND group_name IS NOT NULL ORDER BY group_name`
        );
        res.json({ groups: groups.map(g => g.group_name) });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy danh sách nhóm' });
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
