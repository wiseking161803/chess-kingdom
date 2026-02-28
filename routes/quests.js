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
 * POST /api/quests/:id/complete — Mark quest as completed (with auto-verification)
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
            return res.status(400).json({ error: 'Bạn đã hoàn thành nhiệm vụ này rồi' });
        }

        // ========== AUTO-VERIFICATION ==========
        const verified = await verifyQuestCompletion(userId, quest);
        if (!verified) {
            return res.status(400).json({ error: '❌ Bạn chưa hoàn thành nhiệm vụ này! Hãy thực hiện trước.' });
        }

        await db.query(
            'INSERT INTO user_quest_completions (user_id, quest_id, period_key) VALUES (?,?,?)',
            [userId, questId, periodKey]
        );

        // Award coins only (no stars)
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

        let msg = `✅ Hoàn thành: ${quest.title}!`;
        if (coinsReward > 0) msg += ` +${coinsReward.toLocaleString()} 🪙`;

        res.json({
            message: msg,
            coins_earned: coinsReward
        });
    } catch (err) {
        console.error('Quest complete error:', err);
        res.status(500).json({ error: 'Lỗi hoàn thành nhiệm vụ' });
    }
});

/**
 * Auto-verify quest completion based on quest title/type
 */
async function verifyQuestCompletion(userId, quest) {
    const title = quest.title || '';
    const dayKey = getDayKey();

    try {
        // === DAILY QUESTS ===
        if (title.includes('Đăng nhập')) {
            // Login: always true if they're calling this endpoint (they're logged in)
            return true;
        }

        if (title.includes('Kiếm ít nhất 3 sao')) {
            const [rows] = await db.query(
                "SELECT COALESCE(SUM(amount),0) as total FROM currency_transactions WHERE user_id = ? AND currency_type = 'stars' AND amount > 0 AND DATE(created_at) = ?",
                [userId, dayKey]
            );
            return (rows[0]?.total || 0) >= 3;
        }

        if (title.includes('Kiếm ít nhất 10 sao')) {
            const [rows] = await db.query(
                "SELECT COALESCE(SUM(amount),0) as total FROM currency_transactions WHERE user_id = ? AND currency_type = 'stars' AND amount > 0 AND DATE(created_at) = ?",
                [userId, dayKey]
            );
            return (rows[0]?.total || 0) >= 10;
        }

        if (title.includes('Cho rồng ăn')) {
            const count = title.match(/(\d+)/)?.[1] || 1;
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM currency_transactions WHERE user_id = ? AND source = 'dragon_feed' AND DATE(created_at) = ?",
                [userId, dayKey]
            );
            return (rows[0]?.cnt || 0) >= parseInt(count);
        }

        if (title.includes('Tháp Kỳ Vương')) {
            const count = title.match(/(\d+)/)?.[1] || 1;
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM user_quest_completions uqc JOIN quest_templates qt ON uqc.quest_id = qt.id WHERE uqc.user_id = ? AND qt.url IS NOT NULL AND uqc.period_key = ?",
                [userId, dayKey]
            );
            return (rows[0]?.cnt || 0) >= parseInt(count);
        }

        if (title.includes('Thu hoạch vườn')) {
            const count = title.match(/(\d+)/)?.[1] || 1;
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM currency_transactions WHERE user_id = ? AND source = 'garden' AND DATE(created_at) = ?",
                [userId, dayKey]
            );
            return (rows[0]?.cnt || 0) >= parseInt(count);
        }

        // === WEEKLY QUESTS ===
        if (title.includes('Đăng nhập 5 ngày')) {
            const weekKey = getWeekKey();
            const [rows] = await db.query(
                "SELECT COUNT(DISTINCT DATE(created_at)) as days FROM currency_transactions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
                [userId]
            );
            return (rows[0]?.days || 0) >= 5;
        }

        if (title.includes('Kiếm tổng 50 sao')) {
            const [rows] = await db.query(
                "SELECT COALESCE(SUM(amount),0) as total FROM currency_transactions WHERE user_id = ? AND currency_type = 'stars' AND amount > 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
                [userId]
            );
            return (rows[0]?.total || 0) >= 50;
        }

        if (title.includes('Hoàn thành 5 nhiệm vụ')) {
            const weekKey = getWeekKey();
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM user_quest_completions uqc JOIN quest_templates qt ON uqc.quest_id = qt.id WHERE uqc.user_id = ? AND qt.url IS NOT NULL AND uqc.period_key = ?",
                [userId, weekKey]
            );
            return (rows[0]?.cnt || 0) >= 5;
        }

        if (title.includes('3 trận chiến')) {
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM dragon_battles WHERE attacker_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
                [userId]
            );
            return (rows[0]?.cnt || 0) >= 3;
        }

        if (title.includes('Cho rồng ăn 5 lần')) {
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM currency_transactions WHERE user_id = ? AND source = 'dragon_feed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
                [userId]
            );
            return (rows[0]?.cnt || 0) >= 5;
        }

        if (title.includes('Thu hoạch vườn cây 5 lần')) {
            const [rows] = await db.query(
                "SELECT COUNT(*) as cnt FROM currency_transactions WHERE user_id = ? AND source = 'garden' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
                [userId]
            );
            return (rows[0]?.cnt || 0) >= 5;
        }

        if (title.includes('Top 10')) {
            const [rows] = await db.query(
                "SELECT rank_position FROM dragon_arena_rankings WHERE user_id = ? AND rank_position <= 10",
                [userId]
            );
            return rows.length > 0;
        }

        // Unknown quest type — don't auto-verify
        return false;
    } catch (e) {
        console.error('Quest verification error:', e.message);
        return false;
    }
}

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
