/**
 * Achievement Routes — 3-tab milestone system
 * Tab 1: Stars milestones (total_stars_earned)
 * Tab 2: ELO milestones (current_elo)
 * Tab 3: Streak milestones (current_streak / longest_streak)
 *
 * Rewards are predefined and balanced for game economy.
 * Users claim rewards when they reach each milestone.
 */
const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// MILESTONE DEFINITIONS — balanced game economy
// ============================================================

const STAR_MILESTONES = [
    // === Giai đoạn đầu (thưởng nhỏ, tạo động lực) ===
    { key: 'stars_10', threshold: 10, icon: '⭐', label: '10 Sao', rewards: { coins: 1000 } },
    { key: 'stars_50', threshold: 50, icon: '⭐', label: '50 Sao', rewards: { coins: 3000 } },
    { key: 'stars_100', threshold: 100, icon: '⭐', label: '100 Sao', rewards: { coins: 5000, tickets: 1 } },
    { key: 'stars_200', threshold: 200, icon: '⭐', label: '200 Sao', rewards: { coins: 8000 } },
    { key: 'stars_300', threshold: 300, icon: '⭐', label: '300 Sao', rewards: { coins: 10000, tickets: 1 } },
    { key: 'stars_500', threshold: 500, icon: '🌟', label: '500 Sao', rewards: { coins: 15000, tickets: 2 } },
    { key: 'stars_1000', threshold: 1000, icon: '🌟', label: '1,000 Sao', rewards: { coins: 30000, tickets: 3 } },
    // === Mỗi 500 sao ===
    { key: 'stars_1500', threshold: 1500, icon: '🌟', label: '1,500 Sao', rewards: { coins: 35000, tickets: 2 } },
    { key: 'stars_2000', threshold: 2000, icon: '🥚', label: '2,000 Sao', rewards: { coins: 40000, tickets: 3, egg: 1 } },
    { key: 'stars_2500', threshold: 2500, icon: '🌟', label: '2,500 Sao', rewards: { coins: 45000, tickets: 3 } },
    { key: 'stars_3000', threshold: 3000, icon: '🌟', label: '3,000 Sao', rewards: { coins: 50000, equipment_rarity: 'rare' } },
    { key: 'stars_3500', threshold: 3500, icon: '🌟', label: '3,500 Sao', rewards: { coins: 55000, tickets: 3 } },
    { key: 'stars_4000', threshold: 4000, icon: '🥚', label: '4,000 Sao', rewards: { coins: 60000, tickets: 4, egg: 1 } },
    { key: 'stars_4500', threshold: 4500, icon: '🌟', label: '4,500 Sao', rewards: { coins: 70000, tickets: 4 } },
    // === Mốc đặc biệt 5000 ===
    { key: 'stars_5000', threshold: 5000, icon: '💎', label: '5,000 Sao', rewards: { coins: 150000, tickets: 8, egg: 1, equipment_rarity: 'epic' } },
    { key: 'stars_5500', threshold: 5500, icon: '🌟', label: '5,500 Sao', rewards: { coins: 80000, tickets: 4 } },
    { key: 'stars_6000', threshold: 6000, icon: '🥚', label: '6,000 Sao', rewards: { coins: 90000, tickets: 5, egg: 1 } },
    { key: 'stars_6500', threshold: 6500, icon: '🌟', label: '6,500 Sao', rewards: { coins: 95000, tickets: 5 } },
    { key: 'stars_7000', threshold: 7000, icon: '🌟', label: '7,000 Sao', rewards: { coins: 100000, tickets: 5, equipment_rarity: 'rare' } },
    { key: 'stars_7500', threshold: 7500, icon: '🌟', label: '7,500 Sao', rewards: { coins: 110000, tickets: 5 } },
    { key: 'stars_8000', threshold: 8000, icon: '🥚', label: '8,000 Sao', rewards: { coins: 120000, tickets: 6, egg: 1, equipment_rarity: 'epic' } },
    { key: 'stars_8500', threshold: 8500, icon: '🌟', label: '8,500 Sao', rewards: { coins: 130000, tickets: 6 } },
    { key: 'stars_9000', threshold: 9000, icon: '🌟', label: '9,000 Sao', rewards: { coins: 140000, tickets: 7 } },
    { key: 'stars_9500', threshold: 9500, icon: '🌟', label: '9,500 Sao', rewards: { coins: 150000, tickets: 7 } },
    // === Mốc đặc biệt 10000 ===
    { key: 'stars_10000', threshold: 10000, icon: '👑', label: '10,000 Sao', rewards: { coins: 300000, tickets: 15, egg: 2, equipment_rarity: 'legendary' } },
    // === Mốc cuối ===
    { key: 'stars_15000', threshold: 15000, icon: '🏆', label: '15,000 Sao', rewards: { coins: 500000, tickets: 20, egg: 2, equipment_rarity: 'mythic' } },
    { key: 'stars_20000', threshold: 20000, icon: '🌈', label: '20,000 Sao', rewards: { coins: 1000000, tickets: 30, egg: 3, equipment_rarity: 'mythic' } },
];

const ELO_MILESTONES = [
    // === Mỗi 100 ELO ===
    { key: 'elo_800', threshold: 800, icon: '📊', label: '800 ELO', rewards: { coins: 2000 } },
    { key: 'elo_900', threshold: 900, icon: '📊', label: '900 ELO', rewards: { coins: 5000 } },
    { key: 'elo_1000', threshold: 1000, icon: '📊', label: '1,000 ELO', rewards: { coins: 10000, tickets: 1 } },
    { key: 'elo_1100', threshold: 1100, icon: '🏅', label: '1,100 ELO', rewards: { coins: 15000 } },
    { key: 'elo_1200', threshold: 1200, icon: '🏅', label: '1,200 ELO', rewards: { coins: 20000, tickets: 2 } },
    { key: 'elo_1300', threshold: 1300, icon: '🏅', label: '1,300 ELO', rewards: { coins: 30000 } },
    { key: 'elo_1400', threshold: 1400, icon: '🎖️', label: '1,400 ELO', rewards: { coins: 40000, tickets: 3 } },
    { key: 'elo_1500', threshold: 1500, icon: '🎖️', label: '1,500 ELO', rewards: { coins: 50000, tickets: 3, equipment_rarity: 'rare' } },
    { key: 'elo_1600', threshold: 1600, icon: '🏆', label: '1,600 ELO', rewards: { coins: 60000, tickets: 4 } },
    { key: 'elo_1700', threshold: 1700, icon: '🏆', label: '1,700 ELO', rewards: { coins: 70000, tickets: 4 } },
    { key: 'elo_1800', threshold: 1800, icon: '💎', label: '1,800 ELO', rewards: { coins: 80000, tickets: 5, equipment_rarity: 'epic' } },
    { key: 'elo_1900', threshold: 1900, icon: '💎', label: '1,900 ELO', rewards: { coins: 100000, tickets: 5 } },
    // === Mốc đặc biệt 2000 ===
    { key: 'elo_2000', threshold: 2000, icon: '🥚', label: '2,000 ELO', rewards: { coins: 200000, tickets: 10, egg: 1, equipment_rarity: 'epic' } },
    { key: 'elo_2100', threshold: 2100, icon: '🥚', label: '2,100 ELO', rewards: { coins: 150000, tickets: 8 } },
    { key: 'elo_2200', threshold: 2200, icon: '🥚', label: '2,200 ELO', rewards: { coins: 200000, tickets: 10, egg: 1 } },
    { key: 'elo_2300', threshold: 2300, icon: '🥚', label: '2,300 ELO', rewards: { coins: 250000, tickets: 10 } },
    { key: 'elo_2400', threshold: 2400, icon: '🥚', label: '2,400 ELO', rewards: { coins: 300000, tickets: 12, egg: 1, equipment_rarity: 'legendary' } },
    { key: 'elo_2500', threshold: 2500, icon: '👑', label: '2,500 ELO', rewards: { coins: 400000, tickets: 12 } },
    { key: 'elo_2600', threshold: 2600, icon: '👑', label: '2,600 ELO', rewards: { coins: 500000, tickets: 15, egg: 2, equipment_rarity: 'legendary' } },
    { key: 'elo_2700', threshold: 2700, icon: '🏆', label: '2,700 ELO', rewards: { coins: 600000, tickets: 15 } },
    { key: 'elo_2800', threshold: 2800, icon: '🏆', label: '2,800 ELO', rewards: { coins: 800000, tickets: 20, egg: 2, equipment_rarity: 'mythic' } },
    { key: 'elo_2900', threshold: 2900, icon: '🏆', label: '2,900 ELO', rewards: { coins: 1000000, tickets: 25 } },
    // === Mốc đặc biệt 3000 ===
    { key: 'elo_3000', threshold: 3000, icon: '🌈', label: '3,000 ELO', rewards: { coins: 1500000, tickets: 30, egg: 3, equipment_rarity: 'mythic' } },
];

const STREAK_MILESTONES = [
    // === Giai đoạn đầu ===
    { key: 'streak_3', threshold: 3, icon: '🔥', label: '3 ngày liên tiếp', rewards: { coins: 3000 } },
    { key: 'streak_7', threshold: 7, icon: '🔥', label: '7 ngày liên tiếp', rewards: { coins: 8000, tickets: 1 } },
    { key: 'streak_14', threshold: 14, icon: '🔥', label: '14 ngày liên tiếp', rewards: { coins: 20000, tickets: 2 } },
    { key: 'streak_21', threshold: 21, icon: '🔥', label: '21 ngày liên tiếp', rewards: { coins: 30000, tickets: 2 } },
    { key: 'streak_30', threshold: 30, icon: '🥚', label: '30 ngày liên tiếp', rewards: { coins: 50000, tickets: 3, egg: 1 } },
    // === Mỗi 10 ngày sau mốc 30 ===
    { key: 'streak_40', threshold: 40, icon: '🔥', label: '40 ngày liên tiếp', rewards: { coins: 60000, tickets: 3, equipment_rarity: 'rare' } },
    { key: 'streak_50', threshold: 50, icon: '🔥', label: '50 ngày liên tiếp', rewards: { coins: 80000, tickets: 4 } },
    { key: 'streak_60', threshold: 60, icon: '💎', label: '60 ngày liên tiếp', rewards: { coins: 100000, tickets: 5, equipment_rarity: 'epic' } },
    { key: 'streak_70', threshold: 70, icon: '🔥', label: '70 ngày liên tiếp', rewards: { coins: 120000, tickets: 5 } },
    { key: 'streak_80', threshold: 80, icon: '🔥', label: '80 ngày liên tiếp', rewards: { coins: 150000, tickets: 6 } },
    { key: 'streak_90', threshold: 90, icon: '🥚', label: '90 ngày liên tiếp', rewards: { coins: 200000, tickets: 8, egg: 1, equipment_rarity: 'epic' } },
    // === Mốc đặc biệt 100 ===
    { key: 'streak_100', threshold: 100, icon: '👑', label: '100 ngày liên tiếp', rewards: { coins: 500000, tickets: 15, egg: 2, equipment_rarity: 'legendary' } },
    { key: 'streak_120', threshold: 120, icon: '🔥', label: '120 ngày liên tiếp', rewards: { coins: 300000, tickets: 10 } },
    { key: 'streak_150', threshold: 150, icon: '🏆', label: '150 ngày liên tiếp', rewards: { coins: 500000, tickets: 15, egg: 2, equipment_rarity: 'mythic' } },
    // === Mốc đặc biệt 200 ===
    { key: 'streak_200', threshold: 200, icon: '🌈', label: '200 ngày liên tiếp', rewards: { coins: 1000000, tickets: 25, egg: 3, equipment_rarity: 'mythic' } },
    { key: 'streak_250', threshold: 250, icon: '🔥', label: '250 ngày liên tiếp', rewards: { coins: 600000, tickets: 15 } },
    { key: 'streak_300', threshold: 300, icon: '🏆', label: '300 ngày liên tiếp', rewards: { coins: 800000, tickets: 20, egg: 2, equipment_rarity: 'mythic' } },
    // === Mốc đặc biệt 365 ===
    { key: 'streak_365', threshold: 365, icon: '🌈', label: '365 ngày — Trọn 1 năm!', rewards: { coins: 2000000, tickets: 50, egg: 5, equipment_rarity: 'mythic' } },
];

const ALL_MILESTONES = {
    stars: STAR_MILESTONES,
    elo: ELO_MILESTONES,
    streak: STREAK_MILESTONES
};

// Helper: format rewards text
function rewardText(r) {
    const parts = [];
    if (r.coins) parts.push(`${r.coins.toLocaleString()} 🪙`);
    if (r.tickets) parts.push(`${r.tickets} 🎫`);
    if (r.egg) parts.push(`${r.egg} 🥚`);
    if (r.equipment_rarity) {
        const names = { rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại', mythic: 'Thần Thoại' };
        parts.push(`TB ${names[r.equipment_rarity] || r.equipment_rarity} ⚔️`);
    }
    return parts.join(' + ');
}

/**
 * GET /api/achievements — Get all milestones with user progress
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user stats
        const [currencies] = await db.query(
            'SELECT total_stars_earned FROM user_currencies WHERE user_id = ?', [userId]
        );
        const [elo] = await db.query(
            'SELECT current_elo FROM user_elo WHERE user_id = ?', [userId]
        );
        const [streak] = await db.query(
            'SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?', [userId]
        );

        // Fetch claimed milestones
        const [claims] = await db.query(
            'SELECT milestone_key FROM achievement_milestone_claims WHERE user_id = ?', [userId]
        );
        const claimedKeys = new Set(claims.map(c => c.milestone_key));

        const totalStars = currencies[0]?.total_stars_earned || 0;
        const currentElo = elo[0]?.current_elo || 800;
        const currentStreak = streak[0]?.current_streak || 0;
        const longestStreak = streak[0]?.longest_streak || 0;
        // Use longest streak for milestone tracking (so streaks don't reset progress)
        const bestStreak = Math.max(currentStreak, longestStreak);

        const values = { stars: totalStars, elo: currentElo, streak: bestStreak };

        // Enrich milestones
        const result = {};
        for (const [type, milestones] of Object.entries(ALL_MILESTONES)) {
            result[type] = milestones.map(m => {
                const value = values[type];
                const reached = value >= m.threshold;
                const claimed = claimedKeys.has(m.key);
                const pct = Math.min(100, Math.round((value / m.threshold) * 100));
                return {
                    key: m.key,
                    threshold: m.threshold,
                    icon: m.icon,
                    label: m.label,
                    rewards: m.rewards,
                    rewards_text: rewardText(m.rewards),
                    reached,
                    claimed,
                    claimable: reached && !claimed,
                    progress: pct
                };
            });
        }

        res.json({
            milestones: result,
            stats: {
                total_stars: totalStars,
                elo: currentElo,
                current_streak: currentStreak,
                longest_streak: longestStreak,
                best_streak: bestStreak
            }
        });
    } catch (err) {
        console.error('Achievements error:', err);
        res.status(500).json({ error: 'Lỗi lấy thành tích' });
    }
});

/**
 * POST /api/achievements/claim — Claim a milestone reward
 */
router.post('/claim', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { milestone_key } = req.body;

        if (!milestone_key) {
            return res.status(400).json({ error: 'Thiếu milestone_key' });
        }

        // Find milestone definition
        let milestone = null;
        let milestoneType = null;
        for (const [type, list] of Object.entries(ALL_MILESTONES)) {
            const found = list.find(m => m.key === milestone_key);
            if (found) { milestone = found; milestoneType = type; break; }
        }
        if (!milestone) {
            return res.status(400).json({ error: 'Milestone không tồn tại' });
        }

        // Check if already claimed
        const [existing] = await db.query(
            'SELECT id FROM achievement_milestone_claims WHERE user_id = ? AND milestone_key = ?',
            [userId, milestone_key]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Bạn đã nhận thưởng này rồi!' });
        }

        // Check if user meets threshold
        let userValue = 0;
        if (milestoneType === 'stars') {
            const [c] = await db.query('SELECT total_stars_earned FROM user_currencies WHERE user_id = ?', [userId]);
            userValue = c[0]?.total_stars_earned || 0;
        } else if (milestoneType === 'elo') {
            const [e] = await db.query('SELECT current_elo FROM user_elo WHERE user_id = ?', [userId]);
            userValue = e[0]?.current_elo || 800;
        } else if (milestoneType === 'streak') {
            const [s] = await db.query('SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?', [userId]);
            userValue = Math.max(s[0]?.current_streak || 0, s[0]?.longest_streak || 0);
        }

        if (userValue < milestone.threshold) {
            return res.status(400).json({ error: `Chưa đạt mốc ${milestone.label}!` });
        }

        const rewards = milestone.rewards;
        const awarded = [];

        // Award coins
        if (rewards.coins) {
            await db.query(
                'UPDATE user_currencies SET chess_coins = chess_coins + ? WHERE user_id = ?',
                [rewards.coins, userId]
            );
            awarded.push(`+${rewards.coins.toLocaleString()} xu`);
        }

        // Award tickets
        if (rewards.tickets) {
            await db.query(
                'UPDATE user_currencies SET good_kid_tickets = good_kid_tickets + ? WHERE user_id = ?',
                [rewards.tickets, userId]
            );
            awarded.push(`+${rewards.tickets} phiếu bé ngoan`);
        }

        // Award dragon eggs
        if (rewards.egg) {
            for (let i = 0; i < rewards.egg; i++) {
                try {
                    await db.query(
                        'INSERT INTO dragon_eggs (user_id, name, hatch_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
                        [userId, `Trứng Thưởng (${milestone_key})`]
                    );
                } catch (eggErr) {
                    console.log('Note: dragon_eggs insert skipped:', eggErr.message);
                }
            }
            awarded.push(`+${rewards.egg} trứng rồng`);
        }

        // Award random equipment of specified rarity
        if (rewards.equipment_rarity) {
            try {
                const [equipments] = await db.query(
                    'SELECT id FROM dragon_equipment WHERE rarity = ? ORDER BY RAND() LIMIT 1',
                    [rewards.equipment_rarity]
                );
                if (equipments.length > 0) {
                    await db.query(
                        'INSERT INTO user_dragon_equipment (user_id, equipment_id) VALUES (?, ?)',
                        [userId, equipments[0].id]
                    );
                    const rarityNames = { rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại', mythic: 'Thần Thoại' };
                    awarded.push(`+1 trang bị ${rarityNames[rewards.equipment_rarity]}`);
                }
            } catch (eqErr) {
                console.log('Note: equipment award skipped:', eqErr.message);
            }
        }

        // Record claim
        await db.query(
            'INSERT INTO achievement_milestone_claims (user_id, milestone_key) VALUES (?, ?)',
            [userId, milestone_key]
        );

        // Log transactions
        if (rewards.coins) {
            const [curr] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
            await db.query(
                'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
                [userId, 'coins', rewards.coins, curr[0]?.chess_coins || 0, 'achievement', milestone.label]
            );
        }

        res.json({
            message: `🎉 ${milestone.label}! ${awarded.join(', ')}`,
            milestone_key,
            rewards_awarded: awarded
        });
    } catch (err) {
        console.error('Achievement claim error:', err);
        res.status(500).json({ error: 'Lỗi nhận thưởng' });
    }
});

module.exports = router;
