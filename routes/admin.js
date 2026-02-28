const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

/**
 * GET /api/admin/users — List all users
 */
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT u.id, u.username, u.display_name, u.email, u.role, u.status,
                   u.avatar_url, u.current_rank, u.rank_level, u.created_at,
                   uc.knowledge_stars, uc.chess_coins,
                   ue.current_elo
            FROM users u
            LEFT JOIN user_currencies uc ON u.id = uc.user_id
            LEFT JOIN user_elo ue ON u.id = ue.user_id
            ORDER BY u.created_at DESC
        `);
        res.json({ users });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Lỗi lấy danh sách' });
    }
});

/**
 * POST /api/admin/users — Create a new user
 */
router.post('/users', async (req, res) => {
    try {
        const { username, display_name, password, role = 'student', email } = req.body;

        if (!username || !display_name || !password) {
            return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
        }

        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (username, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [username, display_name, email || null, password_hash, role, 'active']
        );

        const userId = result.insertId;
        await db.query('INSERT INTO user_currencies (user_id) VALUES (?)', [userId]);
        await db.query('INSERT INTO user_elo (user_id) VALUES (?)', [userId]);
        await db.query('INSERT INTO user_streaks (user_id) VALUES (?)', [userId]);

        res.status(201).json({
            message: 'Tạo tài khoản thành công',
            user: { id: userId, username, display_name, role, status: 'active' }
        });
    } catch (err) {
        console.error('Admin create user error:', err);
        res.status(500).json({ error: 'Lỗi tạo tài khoản' });
    }
});

/**
 * PUT /api/admin/users/:id/approve
 */
router.put('/users/:id/approve', async (req, res) => {
    try {
        const userId = req.params.id;
        await db.query('UPDATE users SET status = ? WHERE id = ? AND status = ?', ['active', userId, 'pending']);
        res.json({ message: 'Đã phê duyệt tài khoản' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi phê duyệt' });
    }
});

/**
 * PUT /api/admin/users/:id
 */
router.put('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { display_name, email, role, status } = req.body;

        const updates = [];
        const values = [];

        if (display_name) { updates.push('display_name = ?'); values.push(display_name); }
        if (email !== undefined) { updates.push('email = ?'); values.push(email); }
        if (role) { updates.push('role = ?'); values.push(role); }
        if (status) { updates.push('status = ?'); values.push(status); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Không có gì để cập nhật' });
        }

        values.push(userId);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        res.json({ message: 'Cập nhật thành công' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật' });
    }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Không thể xóa chính mình' });
        }
        await db.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'Đã xóa tài khoản' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa' });
    }
});

/**
 * POST /api/admin/award — Manual reward
 */
router.post('/award', async (req, res) => {
    try {
        const { user_id, currency_type, amount, description } = req.body;

        if (!user_id || !currency_type || !amount) {
            return res.status(400).json({ error: 'Thiếu thông tin' });
        }

        const col = currency_type === 'stars' ? 'knowledge_stars'
            : currency_type === 'tickets' ? 'good_kid_tickets'
                : 'chess_coins';

        await db.query(
            `UPDATE user_currencies SET ${col} = ${col} + ? WHERE user_id = ?`,
            [amount, user_id]
        );

        if (currency_type === 'stars') {
            await db.query(
                'UPDATE user_currencies SET total_stars_earned = total_stars_earned + ? WHERE user_id = ? AND ? > 0',
                [amount, user_id, amount]
            );
        }

        // Log transaction
        const [curr] = await db.query(`SELECT ${col} as balance FROM user_currencies WHERE user_id = ?`, [user_id]);
        await db.query(
            'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
            [user_id, currency_type, amount, curr[0]?.balance || 0, 'admin_award', description || 'Thưởng từ admin']
        );

        const typeLabel = currency_type === 'stars' ? 'sao' : currency_type === 'tickets' ? 'phiếu bé ngoan' : 'xu';
        res.json({ message: `Đã trao ${amount} ${typeLabel}` });
    } catch (err) {
        console.error('Award error:', err);
        res.status(500).json({ error: 'Lỗi trao thưởng' });
    }
});

/**
 * GET /api/admin/level-up-requests
 */
router.get('/level-up-requests', async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT lr.*, u.username, u.display_name
            FROM level_up_requests lr
            JOIN users u ON lr.user_id = u.id
            WHERE lr.status = 'pending'
            ORDER BY lr.created_at DESC
        `);
        res.json({ requests });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy danh sách' });
    }
});

/**
 * PUT /api/admin/level-up-requests/:id/approve
 */
router.put('/level-up-requests/:id/approve', async (req, res) => {
    try {
        const requestId = req.params.id;

        const [requests] = await db.query(
            'SELECT * FROM level_up_requests WHERE id = ? AND status = ?',
            [requestId, 'pending']
        );

        if (requests.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
        }

        const request = requests[0];

        // Find the milestone to get the rank level
        const [milestones] = await db.query(
            'SELECT sort_order FROM milestones WHERE title = ?',
            [request.requested_milestone]
        );

        await db.query(
            'UPDATE users SET current_rank = ?, rank_level = ? WHERE id = ?',
            [request.requested_milestone, milestones[0]?.sort_order || 0, request.user_id]
        );

        await db.query(
            'UPDATE level_up_requests SET status = ?, resolved_at = NOW() WHERE id = ?',
            ['approved', requestId]
        );

        res.json({ message: `Đã phê duyệt thăng cấp: ${request.requested_milestone}` });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi phê duyệt' });
    }
});

/**
 * PUT /api/admin/level-up-requests/:id/deny
 */
router.put('/level-up-requests/:id/deny', async (req, res) => {
    try {
        await db.query(
            'UPDATE level_up_requests SET status = ?, resolved_at = NOW() WHERE id = ?',
            ['denied', req.params.id]
        );
        res.json({ message: 'Đã từ chối yêu cầu' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi từ chối' });
    }
});

/**
 * GET /api/admin/award-history — Recent award transactions
 */
router.get('/award-history', async (req, res) => {
    try {
        const [history] = await db.query(`
            SELECT ct.amount, ct.currency_type, ct.description, ct.created_at,
                   u.display_name, u.username
            FROM currency_transactions ct
            JOIN users u ON ct.user_id = u.id
            WHERE ct.source = 'admin_award'
            ORDER BY ct.created_at DESC
            LIMIT 20
        `);
        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy lịch sử' });
    }
});

/**
 * GET /api/admin/users/:id/stats — User puzzle statistics
 */
router.get('/users/:id/stats', async (req, res) => {
    try {
        const userId = req.params.id;

        // Basic user info
        const [users] = await db.query(`
            SELECT u.display_name, u.username, u.current_rank,
                   uc.knowledge_stars, uc.chess_coins,
                   ue.current_elo,
                   us.current_streak, us.longest_streak
            FROM users u
            LEFT JOIN user_currencies uc ON u.id = uc.user_id
            LEFT JOIN user_elo ue ON u.id = ue.user_id
            LEFT JOIN user_streaks us ON u.id = us.user_id
            WHERE u.id = ?
        `, [userId]);

        if (users.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });

        // Aggregate session stats
        let sessionStats = { total_sessions: 0, total_time: 0, total_solved: 0, total_failed: 0 };
        try {
            const [ss] = await db.query(`
                SELECT COUNT(*) as total_sessions,
                       COALESCE(SUM(total_time_seconds), 0) as total_time,
                       COALESCE(SUM(puzzles_solved), 0) as total_solved,
                       COALESCE(SUM(puzzles_failed), 0) as total_failed
                FROM puzzle_sessions WHERE user_id = ?
            `, [userId]);
            if (ss[0]) sessionStats = ss[0];
        } catch (e) { /* puzzle_sessions may not exist */ }

        // Per-set progress
        let setProgress = [];
        try {
            const [sp] = await db.query(`
                SELECT ps.id, ps.name, ps.puzzle_count, ps.solve_mode,
                       COUNT(pp.id) as solved_count,
                       COALESCE(SUM(pp.time_seconds), 0) as set_time
                FROM puzzle_sets ps
                LEFT JOIN puzzle_progress pp ON ps.id = pp.puzzle_set_id AND pp.user_id = ? AND pp.solved = 1
                WHERE ps.is_active = 1
                GROUP BY ps.id
                ORDER BY solved_count DESC
            `, [userId]);
            setProgress = sp;
        } catch (e) { /* ignore */ }

        // Recent sessions
        let recentSessions = [];
        try {
            const [rs] = await db.query(`
                SELECT ps2.mode, ps2.puzzles_solved, ps2.puzzles_failed,
                       ps2.total_time_seconds, ps2.accuracy, ps2.elo_change, ps2.created_at,
                       pset.name as set_name
                FROM puzzle_sessions ps2
                LEFT JOIN puzzle_sets pset ON ps2.puzzle_set_id = pset.id
                WHERE ps2.user_id = ?
                ORDER BY ps2.created_at DESC
                LIMIT 10
            `, [userId]);
            recentSessions = rs;
        } catch (e) { /* ignore */ }

        res.json({
            user: users[0],
            sessionStats,
            setProgress,
            recentSessions
        });
    } catch (err) {
        console.error('User stats error:', err);
        res.status(500).json({ error: 'Lỗi lấy thống kê' });
    }
});

module.exports = router;
