const express = require('express');
const db = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Helper: Get today's date in Vietnam timezone (UTC+7)
function getVietnamToday() {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 3600000);
    return vn.toISOString().split('T')[0];
}

const router = express.Router();

/**
 * GET /api/leaderboard/elo — Top ELO rankings
 */
router.get('/elo', optionalAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const [rows] = await db.query(`
            SELECT u.id as user_id, u.display_name, u.avatar_url, u.current_rank,
                   ue.current_elo, ue.peak_elo, ue.puzzles_solved
            FROM user_elo ue
            JOIN users u ON ue.user_id = u.id
            WHERE u.status = 'active' AND u.role = 'student'
            ORDER BY ue.current_elo DESC
            LIMIT ?
        `, [limit]);

        const leaderboard = rows.map((r, idx) => ({
            rank: idx + 1,
            ...r,
            is_current_user: req.user ? r.user_id === req.user.id : false
        }));

        res.json({ leaderboard, type: 'elo' });
    } catch (err) {
        console.error('Leaderboard ELO error:', err.message);
        res.status(500).json({ error: 'Lỗi lấy bảng xếp hạng' });
    }
});

/**
 * GET /api/leaderboard/stars — Top Stars rankings
 */
router.get('/stars', optionalAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const [rows] = await db.query(`
            SELECT u.id as user_id, u.display_name, u.avatar_url, u.current_rank,
                   uc.knowledge_stars, uc.total_stars_earned
            FROM user_currencies uc
            JOIN users u ON uc.user_id = u.id
            WHERE u.status = 'active' AND u.role = 'student'
            ORDER BY uc.knowledge_stars DESC
            LIMIT ?
        `, [limit]);

        const leaderboard = rows.map((r, idx) => ({
            rank: idx + 1,
            ...r,
            is_current_user: req.user ? r.user_id === req.user.id : false
        }));

        res.json({ leaderboard, type: 'stars' });
    } catch (err) {
        console.error('Leaderboard Stars error:', err.message);
        res.status(500).json({ error: 'Lỗi lấy bảng xếp hạng' });
    }
});

/**
 * POST /api/leaderboard/claim-daily — Claim daily leaderboard reward
 */
router.post('/claim-daily', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const today = getVietnamToday();

        // Check if already claimed
        const [existing] = await db.query(
            'SELECT id FROM daily_leaderboard_rewards WHERE user_id = ? AND reward_date = ?',
            [userId, today]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Bạn đã nhận thưởng hôm nay rồi!' });
        }

        // Get user's ELO rank (only students)
        const [allUsers] = await db.query(`
            SELECT ue.user_id, ue.current_elo
            FROM user_elo ue JOIN users u ON ue.user_id = u.id
            WHERE u.status = 'active' AND u.role = 'student'
            ORDER BY ue.current_elo DESC
        `);

        const userRank = allUsers.findIndex(u => u.user_id === userId) + 1;

        if (userRank === 0 || userRank > 5) {
            return res.status(400).json({ error: 'Bạn cần vào top 5 bảng xếp hạng ELO để nhận thưởng!' });
        }

        // Reward tiers
        const rewards = { 1: { tickets: 5, coins: 10000 }, 2: { tickets: 3, coins: 5000 }, 3: { tickets: 2, coins: 3000 }, 4: { tickets: 1, coins: 1000 }, 5: { tickets: 1, coins: 1000 } };
        const reward = rewards[userRank];

        // Award tickets + coins
        await db.query(
            'UPDATE user_currencies SET good_kid_tickets = good_kid_tickets + ?, chess_coins = chess_coins + ? WHERE user_id = ?',
            [reward.tickets, reward.coins, userId]
        );

        // Log reward
        await db.query(
            'INSERT INTO daily_leaderboard_rewards (user_id, reward_date, rank_position, tickets_earned, coins_earned) VALUES (?,?,?,?,?)',
            [userId, today, userRank, reward.tickets, reward.coins]
        );

        // Log transactions
        const [curr] = await db.query('SELECT good_kid_tickets, chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
        await db.query(
            'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
            [userId, 'tickets', reward.tickets, curr[0]?.good_kid_tickets || 0, 'daily_leaderboard', `Top ${userRank} daily`]
        );
        await db.query(
            'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
            [userId, 'coins', reward.coins, curr[0]?.chess_coins || 0, 'daily_leaderboard', `Top ${userRank} daily`]
        );

        res.json({
            message: `🏆 Top ${userRank}! +${reward.tickets} phiếu bé ngoan, +${reward.coins} xu!`,
            rank: userRank,
            tickets_earned: reward.tickets,
            coins_earned: reward.coins
        });
    } catch (err) {
        console.error('Daily reward error:', err);
        res.status(500).json({ error: 'Lỗi nhận thưởng' });
    }
});

/**
 * GET /api/leaderboard/daily-status — Check if user can claim today
 */
router.get('/daily-status', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const today = getVietnamToday();

        const [claimed] = await db.query(
            'SELECT id FROM daily_leaderboard_rewards WHERE user_id = ? AND reward_date = ?',
            [userId, today]
        );

        // Get rank
        const [allUsers] = await db.query(`
            SELECT ue.user_id FROM user_elo ue JOIN users u ON ue.user_id = u.id
            WHERE u.status = 'active' AND u.role = 'student'
            ORDER BY ue.current_elo DESC LIMIT 5
        `);
        const rank = allUsers.findIndex(u => u.user_id === userId) + 1;

        res.json({
            claimed: claimed.length > 0,
            in_top5: rank > 0 && rank <= 5,
            rank: rank > 0 ? rank : null
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi' });
    }
});

module.exports = router;
