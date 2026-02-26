const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Student self-registration (status: pending until admin approves)
 */
router.post('/register', async (req, res) => {
    try {
        const { username, display_name, password } = req.body;

        if (!username || !display_name || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'Tên đăng nhập phải từ 3-50 ký tự' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Check if username exists
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (username, display_name, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
            [username, display_name, password_hash, 'student', 'pending']
        );

        const userId = result.insertId;

        // Create related records
        await db.query('INSERT INTO user_currencies (user_id) VALUES (?)', [userId]);
        await db.query('INSERT INTO user_elo (user_id) VALUES (?)', [userId]);
        await db.query('INSERT INTO user_streaks (user_id) VALUES (?)', [userId]);

        res.status(201).json({
            message: 'Đăng ký thành công! Vui lòng chờ quản trị viên phê duyệt.',
            user: { id: userId, username, display_name, status: 'pending' }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Lỗi đăng ký' });
    }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
        }

        const [rows] = await db.query(
            'SELECT id, username, display_name, email, password_hash, role, status, avatar_url, current_rank FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        const user = rows[0];

        if (user.status === 'pending') {
            return res.status(403).json({ error: 'Tài khoản đang chờ phê duyệt. Vui lòng liên hệ quản trị viên.' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Tài khoản đã bị tạm khóa' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Set httpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Get user stats
        const [currencies] = await db.query(
            'SELECT knowledge_stars, chess_coins, total_stars_earned FROM user_currencies WHERE user_id = ?',
            [user.id]
        );
        const [elo] = await db.query(
            'SELECT current_elo FROM user_elo WHERE user_id = ?',
            [user.id]
        );
        const [streak] = await db.query(
            'SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?',
            [user.id]
        );

        res.json({
            message: 'Đăng nhập thành công!',
            token,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
                current_rank: user.current_rank,
                stats: {
                    knowledge_stars: currencies[0]?.knowledge_stars || 0,
                    chess_coins: currencies[0]?.chess_coins || 0,
                    total_stars_earned: currencies[0]?.total_stars_earned || 0,
                    elo: elo[0]?.current_elo || 800,
                    current_streak: streak[0]?.current_streak || 0,
                    longest_streak: streak[0]?.longest_streak || 0
                }
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Lỗi đăng nhập' });
    }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Đã đăng xuất' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const [currencies] = await db.query(
            'SELECT knowledge_stars, chess_coins, total_stars_earned FROM user_currencies WHERE user_id = ?',
            [req.user.id]
        );
        const [elo] = await db.query(
            'SELECT current_elo, peak_elo, puzzles_solved FROM user_elo WHERE user_id = ?',
            [req.user.id]
        );
        const [streak] = await db.query(
            'SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?',
            [req.user.id]
        );
        const [rankInfo] = await db.query(
            'SELECT current_rank, rank_level FROM users WHERE id = ?',
            [req.user.id]
        );

        res.json({
            user: {
                ...req.user,
                current_rank: rankInfo[0]?.current_rank || 'Tân Binh Trí Tuệ',
                rank_level: rankInfo[0]?.rank_level || 0,
                stats: {
                    knowledge_stars: currencies[0]?.knowledge_stars || 0,
                    chess_coins: currencies[0]?.chess_coins || 0,
                    total_stars_earned: currencies[0]?.total_stars_earned || 0,
                    elo: elo[0]?.current_elo || 800,
                    peak_elo: elo[0]?.peak_elo || 800,
                    puzzles_solved: elo[0]?.puzzles_solved || 0,
                    current_streak: streak[0]?.current_streak || 0,
                    longest_streak: streak[0]?.longest_streak || 0
                }
            }
        });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Lỗi lấy thông tin' });
    }
});

module.exports = router;
