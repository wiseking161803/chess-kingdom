const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/wheel/config — Get wheel prizes and user spin count
 */
router.get('/config', authenticate, async (req, res) => {
    try {
        const [prizes] = await db.query(
            'SELECT id, label, prize_type, rarity, color FROM lucky_wheel_prizes WHERE is_active = 1 ORDER BY sort_order'
        );

        // Calculate free spins: 1 per 1000 total stars earned
        const [currencies] = await db.query(
            'SELECT total_stars_earned FROM user_currencies WHERE user_id = ?',
            [req.user.id]
        );
        const totalStars = currencies[0]?.total_stars_earned || 0;
        const totalFreeSpins = Math.floor(totalStars / 1000);

        // Count used spins
        const [spins] = await db.query(
            'SELECT COUNT(*) as count FROM lucky_wheel_history WHERE user_id = ?',
            [req.user.id]
        );
        const usedSpins = spins[0]?.count || 0;
        const availableSpins = Math.max(0, totalFreeSpins - usedSpins);

        res.json({
            prizes,
            available_spins: availableSpins,
            total_spins_earned: totalFreeSpins,
            used_spins: usedSpins
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy cấu hình vòng quay' });
    }
});

/**
 * POST /api/wheel/spin — Spin the wheel
 */
router.post('/spin', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check available spins
        const [currencies] = await db.query(
            'SELECT total_stars_earned FROM user_currencies WHERE user_id = ?',
            [userId]
        );
        const totalStars = currencies[0]?.total_stars_earned || 0;
        const totalFreeSpins = Math.floor(totalStars / 1000);

        const [spins] = await db.query(
            'SELECT COUNT(*) as count FROM lucky_wheel_history WHERE user_id = ?',
            [userId]
        );
        const usedSpins = spins[0]?.count || 0;

        if (usedSpins >= totalFreeSpins) {
            return res.status(400).json({ error: 'Bạn không còn lượt quay. Kiếm thêm sao để nhận lượt quay mới!' });
        }

        // Get all prizes with weights
        const [prizes] = await db.query(
            'SELECT * FROM lucky_wheel_prizes WHERE is_active = 1'
        );

        if (prizes.length === 0) {
            return res.status(500).json({ error: 'Chưa có giải thưởng' });
        }

        // Weighted random selection
        const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = prizes[0];

        for (const prize of prizes) {
            random -= prize.weight;
            if (random <= 0) {
                selected = prize;
                break;
            }
        }

        // Log spin
        await db.query(
            'INSERT INTO lucky_wheel_history (user_id, prize_id, prize_label) VALUES (?,?,?)',
            [userId, selected.id, selected.label]
        );

        // Award prize
        if (selected.prize_type === 'coins') {
            const amount = parseInt(selected.prize_value);
            await db.query(
                'UPDATE user_currencies SET chess_coins = chess_coins + ? WHERE user_id = ?',
                [amount, userId]
            );
            const [curr] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
            await db.query(
                'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
                [userId, 'coins', amount, curr[0]?.chess_coins || 0, 'lucky_wheel', selected.label]
            );
        } else if (selected.prize_type === 'stars') {
            const amount = parseInt(selected.prize_value);
            await db.query(
                'UPDATE user_currencies SET knowledge_stars = knowledge_stars + ? WHERE user_id = ?',
                [amount, userId]
            );
        }

        res.json({
            prize: {
                id: selected.id,
                label: selected.label,
                type: selected.prize_type,
                rarity: selected.rarity,
                color: selected.color
            },
            remaining_spins: totalFreeSpins - usedSpins - 1,
            message: `🎉 Chúc mừng! Bạn nhận được: ${selected.label}`
        });
    } catch (err) {
        console.error('Spin error:', err);
        res.status(500).json({ error: 'Lỗi quay' });
    }
});

module.exports = router;
