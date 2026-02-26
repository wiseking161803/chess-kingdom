const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: Get current day key (7am reset in UTC+7)
 */
function getDayKey() {
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const hour = vnNow.getUTCHours();
    if (hour < 7) {
        vnNow.setUTCDate(vnNow.getUTCDate() - 1);
    }
    return vnNow.toISOString().split('T')[0];
}

/**
 * Helper: Get current week key
 */
function getWeekKey() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * GET /api/quests/daily — Today's daily quests
 */
router.get('/daily', authenticate, async (req, res) => {
    try {
        const dayKey = getDayKey();
        const dayOfWeek = new Date().getDay() || 7; // 1-7 (Mon-Sun)

        const [quests] = await db.query(
            'SELECT * FROM quest_templates WHERE type = ? AND day_of_week = ? AND is_active = 1',
            ['daily', dayOfWeek]
        );

        // Get completions for today
        const [completions] = await db.query(
            'SELECT quest_id FROM user_quest_completions WHERE user_id = ? AND period_key = ?',
            [req.user.id, dayKey]
        );
        const completedIds = completions.map(c => c.quest_id);

        const enriched = quests.map(q => ({
            ...q,
            completed: completedIds.includes(q.id),
            period_key: dayKey
        }));

        // Calculate countdown to next 7am
        const now = new Date();
        const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const tomorrow7am = new Date(vnNow);
        tomorrow7am.setUTCHours(7, 0, 0, 0);
        if (vnNow.getUTCHours() >= 7) {
            tomorrow7am.setUTCDate(tomorrow7am.getUTCDate() + 1);
        }
        const countdown = Math.max(0, Math.floor((tomorrow7am - vnNow) / 1000));

        res.json({
            quests: enriched,
            day_key: dayKey,
            day_of_week: dayOfWeek,
            countdown_seconds: countdown
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy nhiệm vụ ngày' });
    }
});

/**
 * GET /api/quests/weekly — This week's quests
 */
router.get('/weekly', authenticate, async (req, res) => {
    try {
        const weekKey = getWeekKey();

        const [quests] = await db.query(
            'SELECT * FROM quest_templates WHERE type = ? AND is_active = 1',
            ['weekly']
        );

        const [completions] = await db.query(
            'SELECT quest_id FROM user_quest_completions WHERE user_id = ? AND period_key = ?',
            [req.user.id, weekKey]
        );
        const completedIds = completions.map(c => c.quest_id);

        const enriched = quests.map(q => ({
            ...q,
            completed: completedIds.includes(q.id),
            period_key: weekKey
        }));

        res.json({ quests: enriched, week_key: weekKey });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy nhiệm vụ tuần' });
    }
});

/**
 * POST /api/quests/:id/complete — Mark quest as completed
 */
router.post('/:id/complete', authenticate, async (req, res) => {
    try {
        const questId = req.params.id;
        const userId = req.user.id;

        const [quests] = await db.query('SELECT * FROM quest_templates WHERE id = ?', [questId]);
        if (quests.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
        }

        const quest = quests[0];
        const periodKey = quest.type === 'daily' ? getDayKey() : getWeekKey();

        // Check if already completed
        const [existing] = await db.query(
            'SELECT id FROM user_quest_completions WHERE user_id = ? AND quest_id = ? AND period_key = ?',
            [userId, questId, periodKey]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Bạn đã hoàn thành nhiệm vụ này' });
        }

        await db.query(
            'INSERT INTO user_quest_completions (user_id, quest_id, period_key) VALUES (?,?,?)',
            [userId, questId, periodKey]
        );

        // Award stars
        if (quest.stars_reward > 0) {
            await db.query(
                'UPDATE user_currencies SET knowledge_stars = knowledge_stars + ?, total_stars_earned = total_stars_earned + ? WHERE user_id = ?',
                [quest.stars_reward, quest.stars_reward, userId]
            );

            const [curr] = await db.query('SELECT knowledge_stars FROM user_currencies WHERE user_id = ?', [userId]);
            await db.query(
                'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
                [userId, 'stars', quest.stars_reward, curr[0]?.knowledge_stars || 0, 'quest', quest.title]
            );
        }

        // Award coins (for puzzle-based quests)
        const coinsReward = quest.coins_reward || 0;
        if (coinsReward > 0) {
            await db.query(
                'UPDATE user_currencies SET chess_coins = chess_coins + ? WHERE user_id = ?',
                [coinsReward, userId]
            );

            const [currCoins] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
            await db.query(
                'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
                [userId, 'coins', coinsReward, currCoins[0]?.chess_coins || 0, 'quest', quest.title]
            );
        }

        let msg = `Hoàn thành: ${quest.title}! +${quest.stars_reward} ⭐`;
        if (coinsReward > 0) msg += ` +${coinsReward} 🪙`;

        res.json({
            message: msg,
            stars_earned: quest.stars_reward,
            coins_earned: coinsReward
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi hoàn thành nhiệm vụ' });
    }
});

// ============================================
// ADMIN QUEST CRUD
// ============================================
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
    try {
        const [quests] = await db.query('SELECT * FROM quest_templates ORDER BY type, day_of_week');
        res.json({ quests });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi' });
    }
});

router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { type, day_of_week, title, url, stars_reward, puzzle_set_id, coins_reward, play_mode } = req.body;
        const [result] = await db.query(
            'INSERT INTO quest_templates (type, day_of_week, title, url, stars_reward, puzzle_set_id, coins_reward, play_mode) VALUES (?,?,?,?,?,?,?,?)',
            [type, day_of_week || null, title, url || null, stars_reward || 1, puzzle_set_id || null, coins_reward || 0, play_mode || 'basic']
        );
        res.status(201).json({ message: 'Đã tạo nhiệm vụ', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tạo' });
    }
});

router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { type, day_of_week, title, url, stars_reward, is_active, puzzle_set_id, coins_reward, play_mode } = req.body;
        await db.query(
            'UPDATE quest_templates SET type=?, day_of_week=?, title=?, url=?, stars_reward=?, is_active=?, puzzle_set_id=?, coins_reward=?, play_mode=? WHERE id=?',
            [type, day_of_week, title, url, stars_reward, is_active !== undefined ? is_active : 1, puzzle_set_id || null, coins_reward || 0, play_mode || 'basic', req.params.id]
        );
        res.json({ message: 'Đã cập nhật' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật' });
    }
});

router.delete('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM quest_templates WHERE id = ?', [req.params.id]);
        res.json({ message: 'Đã xóa' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa' });
    }
});

module.exports = router;
