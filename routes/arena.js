const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Reuse battle helpers from world.js
const ELEMENTS = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark'];
const WUXING_COUNTER = { metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal' };

function getElementMultiplier(atk, def) {
    if (WUXING_COUNTER[atk] === def) return 1.2;
    if (WUXING_COUNTER[def] === atk) return 0.8;
    if (atk === 'light' && def === 'dark') return 1.3;
    if (atk === 'dark' && def === 'light') return 1.3;
    return 1.0;
}

// Get equipment bonuses for a dragon
async function getEquipmentBonuses(userId, dragonId, dragonBaseStats) {
    try {
        const [equipped] = await db.query(`
            SELECT de.hp_bonus, de.att_bonus, de.def_bonus, de.crit_rate_bonus, de.crit_dmg_bonus,
                   de.spd_bonus, de.rarity, ude.star_level
            FROM user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            WHERE ude.user_id = ? AND ude.is_equipped = true AND (ude.dragon_id = ? OR ude.dragon_id IS NULL)
        `, [userId, dragonId]);

        const bonuses = { hp: 0, att: 0, def: 0, spd: 0, crit_rate: 0, crit_dmg: 0 };
        const base = dragonBaseStats || {};
        for (const eq of equipped) {
            const starMult = 1 + (eq.star_level || 0) * 0.5;
            const rarity = eq.rarity || 'common';
            let hpB = (eq.hp_bonus || 0), attB = (eq.att_bonus || 0), defB = (eq.def_bonus || 0);
            if (rarity === 'legendary') {
                hpB += Math.floor((base.hp || 0) * 0.05);
                attB += Math.floor((base.att || 0) * 0.05);
                defB += Math.floor((base.def || 0) * 0.05);
            } else if (rarity === 'mythic') {
                hpB += Math.floor((base.hp || 0) * 0.08);
                attB += Math.floor((base.att || 0) * 0.08);
                defB += Math.floor((base.def || 0) * 0.08);
            }
            bonuses.hp += Math.floor(hpB * starMult);
            bonuses.att += Math.floor(attB * starMult);
            bonuses.def += Math.floor(defB * starMult);
            bonuses.spd += Math.floor((eq.spd_bonus || 0) * starMult);
            bonuses.crit_rate += (parseFloat(eq.crit_rate_bonus) || 0) * starMult;
            bonuses.crit_dmg += (parseFloat(eq.crit_dmg_bonus) || 0) * starMult;
        }
        return bonuses;
    } catch (e) {
        return { hp: 0, att: 0, def: 0, spd: 0, crit_rate: 0, crit_dmg: 0 };
    }
}

// Load formation for a user
async function loadFormation(userId) {
    const [allDragons] = await db.query('SELECT * FROM user_dragons WHERE user_id = ? ORDER BY id', [userId]);
    if (allDragons.length === 0) return [];
    const [formation] = await db.query(
        'SELECT slot, dragon_id, position FROM dragon_formations WHERE user_id = ? ORDER BY slot', [userId]
    );
    let team = [];
    if (formation.length > 0) {
        let frontCount = 0;
        const adjusted = formation.map(f => {
            if (f.position === 'front') {
                frontCount++;
                if (frontCount > 2) return { ...f, position: 'back' };
            }
            return f;
        });
        const front = adjusted.filter(f => f.position === 'front').sort((a, b) => a.slot - b.slot);
        const back = adjusted.filter(f => f.position === 'back').sort((a, b) => a.slot - b.slot);
        for (const f of [...front, ...back]) {
            const dr = allDragons.find(d => d.id === f.dragon_id);
            if (dr) team.push({ ...dr, position: f.position });
        }
    }
    if (team.length === 0) {
        team = allDragons.map((dr, i) => ({ ...dr, position: i < 2 ? 'front' : 'back' }));
    }
    return team;
}

// Build combatant with equipment
async function buildCombatant(dragon, userId) {
    const eq = await getEquipmentBonuses(userId, dragon.id, { hp: dragon.hp, att: dragon.att, def: dragon.def_stat });
    const tHp = (dragon.hp || 0) + eq.hp;
    return {
        id: dragon.id, name: dragon.name, element: dragon.element || 'fire',
        level: dragon.level, position: dragon.position,
        hp: tHp, maxHp: tHp, startHp: tHp,
        att: Math.floor(((dragon.att || 0) + eq.att)),
        def: Math.floor(((dragon.def_stat || 0) + eq.def)),
        spd: (dragon.spd || 5) + (eq.spd || 0),
        critRate: (parseFloat(dragon.crit_rate) + eq.crit_rate) / 100,
        critDmg: (parseFloat(dragon.crit_dmg) + eq.crit_dmg) / 100
    };
}

// Run battle simulation between two teams
function runBattle(atkTeam, defTeam) {
    const battleLog = [];
    let turn = 0;

    while (turn < 50) {
        const atkAlive = atkTeam.filter(c => c.hp > 0);
        const defAlive = defTeam.filter(c => c.hp > 0);
        if (atkAlive.length === 0 || defAlive.length === 0) break;

        turn++;
        const turnOrder = [...atkAlive, ...defAlive].sort((a, b) => {
            if (b.spd !== a.spd) return b.spd - a.spd;
            return a.side === 'atk' ? -1 : 1;
        });

        for (const attacker of turnOrder) {
            if (attacker.hp <= 0) continue;
            const opponents = (attacker.side === 'atk' ? defTeam : atkTeam).filter(c => c.hp > 0);
            if (opponents.length === 0) break;

            const frontAlive = opponents.filter(c => c.position === 'front');
            const targetPool = frontAlive.length > 0 ? frontAlive : opponents;
            const target = targetPool.reduce((a, b) => a.hp < b.hp ? a : b);

            const em = getElementMultiplier(attacker.element, target.element);
            let dmg = Math.max(1, Math.floor(attacker.att * (0.8 + Math.random() * 0.4) * em) - Math.floor(target.def * 0.5));
            let crit = Math.random() < attacker.critRate;
            if (crit) dmg = Math.floor(dmg * attacker.critDmg);
            target.hp -= dmg;

            battleLog.push({
                turn, side: attacker.side, damage: dmg, crit,
                attacker: attacker.name, atkElement: attacker.element, atkSpd: attacker.spd,
                target: target.name, defElement: target.element,
                elemBonus: em !== 1 ? Math.round((em - 1) * 100) : 0,
                atkHp: attacker.hp, defHp: Math.max(0, target.hp)
            });
        }
    }

    const atkAlive = atkTeam.filter(c => c.hp > 0).length;
    const defAlive = defTeam.filter(c => c.hp > 0).length;
    const attackerWins = defAlive === 0 || atkAlive > defAlive;

    return { attackerWins, battleLog, atkAlive, defAlive };
}

/**
 * GET /api/arena/rankings — Full 20-rank leaderboard
 */
router.get('/rankings', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rankings] = await db.query(`
            SELECT dar.rank_position, dar.user_id, u.display_name, u.username,
                   (SELECT COUNT(*) FROM user_dragons WHERE user_id = dar.user_id) as dragon_count,
                   (SELECT MAX(level) FROM user_dragons WHERE user_id = dar.user_id) as max_level,
                   (SELECT element FROM user_dragons WHERE user_id = dar.user_id ORDER BY level DESC, id LIMIT 1) as main_element
            FROM dragon_arena_rankings dar
            JOIN users u ON dar.user_id = u.id
            ORDER BY dar.rank_position ASC
        `);

        // Get user's rank
        const userRank = rankings.find(r => r.user_id === userId);

        res.json({
            rankings: rankings.map(r => ({
                rank: r.rank_position,
                user_id: r.user_id,
                display_name: r.display_name,
                is_bot: (r.username || '').startsWith('arena_bot_'),
                is_current_user: r.user_id === userId,
                dragon_count: r.dragon_count,
                max_level: r.max_level,
                main_element: r.main_element
            })),
            my_rank: userRank ? userRank.rank_position : null
        });
    } catch (err) {
        console.error('Arena rankings error:', err);
        res.status(500).json({ error: 'Lỗi tải bảng xếp hạng' });
    }
});

/**
 * GET /api/arena/my-status — Current user status
 */
router.get('/my-status', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        const [rankRow] = await db.query(
            'SELECT rank_position FROM dragon_arena_rankings WHERE user_id = ?', [userId]
        );
        const [challengeRow] = await db.query(
            'SELECT challenges_used FROM dragon_arena_challenges WHERE user_id = ? AND challenge_date = ?',
            [userId, today]
        );

        // Check unclaimed rewards
        const [unclaimedRewards] = await db.query(`
            SELECT SUM(tickets_earned) as total_tickets, SUM(coins_earned) as total_coins, COUNT(*) as count
            FROM dragon_arena_rewards_log
            WHERE user_id = ? AND claimed = 0
        `, [userId]);

        res.json({
            rank: rankRow.length > 0 ? rankRow[0].rank_position : null,
            challenges_used: challengeRow.length > 0 ? challengeRow[0].challenges_used : 0,
            free_remaining: Math.max(0, 5 - (challengeRow.length > 0 ? challengeRow[0].challenges_used : 0)),
            unclaimed_rewards: {
                tickets: unclaimedRewards[0]?.total_tickets || 0,
                coins: unclaimedRewards[0]?.total_coins || 0,
                count: unclaimedRewards[0]?.count || 0
            }
        });
    } catch (err) {
        console.error('Arena status error:', err);
        res.status(500).json({ error: 'Lỗi' });
    }
});

/**
 * POST /api/arena/challenge — Challenge a rank position
 */
router.post('/challenge', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { target_rank } = req.body;
        const today = new Date().toISOString().split('T')[0];

        if (!target_rank || target_rank < 1 || target_rank > 20) {
            return res.status(400).json({ error: 'Hạng không hợp lệ' });
        }

        // Check user has dragons
        const [myDragons] = await db.query('SELECT COUNT(*) as cnt FROM user_dragons WHERE user_id = ?', [userId]);
        if (myDragons[0].cnt === 0) {
            return res.status(400).json({ error: 'Bạn chưa có rồng!' });
        }

        // Get user's current rank
        const [myRank] = await db.query(
            'SELECT rank_position FROM dragon_arena_rankings WHERE user_id = ?', [userId]
        );

        // If user not in arena, assign them rank 21 (will swap into target on win)
        const currentRank = myRank.length > 0 ? myRank[0].rank_position : null;

        if (currentRank !== null && target_rank >= currentRank) {
            return res.status(400).json({ error: 'Bạn chỉ có thể thách đấu hạng cao hơn (số nhỏ hơn)!' });
        }

        // Check daily limit
        const [challengeRow] = await db.query(
            'SELECT challenges_used FROM dragon_arena_challenges WHERE user_id = ? AND challenge_date = ?',
            [userId, today]
        );
        const used = challengeRow.length > 0 ? challengeRow[0].challenges_used : 0;

        // If over free limit, check coins
        if (used >= 5) {
            const [coins] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
            if ((coins[0]?.chess_coins || 0) < 5000) {
                return res.status(400).json({ error: 'Hết lượt free! Cần 5,000 xu để mua thêm lượt.' });
            }
            // Deduct coins
            await db.query('UPDATE user_currencies SET chess_coins = chess_coins - 5000 WHERE user_id = ?', [userId]);
        }

        // Increment daily challenge count
        await db.query(`
            INSERT INTO dragon_arena_challenges (user_id, challenge_date, challenges_used)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE challenges_used = challenges_used + 1
        `, [userId, today]);

        // Get target's user_id
        const [targetRow] = await db.query(
            'SELECT user_id FROM dragon_arena_rankings WHERE rank_position = ?', [target_rank]
        );
        if (targetRow.length === 0) {
            return res.status(400).json({ error: 'Hạng này chưa có người!' });
        }
        const targetUserId = targetRow[0].user_id;

        // Load teams
        const atkFormation = await loadFormation(userId);
        const defFormation = await loadFormation(targetUserId);

        // Build combatants
        const atkTeam = await Promise.all(atkFormation.map(d => buildCombatant(d, userId)));
        const defTeam = await Promise.all(defFormation.map(d => buildCombatant(d, targetUserId)));

        // Tag sides
        atkTeam.forEach(c => c.side = 'atk');
        defTeam.forEach(c => c.side = 'def');

        // Run battle (arena battles don't affect dragon HP)
        const { attackerWins, battleLog } = runBattle(atkTeam, defTeam);

        // Get names
        const [atkUser] = await db.query('SELECT display_name FROM users WHERE id = ?', [userId]);
        const [defUser] = await db.query('SELECT display_name FROM users WHERE id = ?', [targetUserId]);

        // If attacker wins, swap ranks
        let newRank = currentRank;
        if (attackerWins) {
            if (currentRank !== null) {
                // Swap: target goes to attacker's old rank, attacker goes to target's rank
                await db.query('UPDATE dragon_arena_rankings SET user_id = ? WHERE rank_position = ?', [targetUserId, currentRank]);
                await db.query('UPDATE dragon_arena_rankings SET user_id = ? WHERE rank_position = ?', [userId, target_rank]);
            } else {
                // New player entering arena — take target's rank, target gets pushed to rank 20
                // First push everyone from target_rank to 19 down by 1
                // Actually simpler: just swap target to a new slot or push to bottom
                // Since we have exactly 20 slots, insert user at target_rank, move target to 21 (but max is 20)
                // Best approach: user replaces target, target is removed from rankings
                // OR: user takes target's rank, we need to add user. Let's give user a rank 21 first then swap.
                await db.query(
                    `INSERT INTO dragon_arena_rankings (rank_position, user_id) VALUES (21, ?)
                     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`, [userId]
                );
                await db.query('UPDATE dragon_arena_rankings SET user_id = ? WHERE rank_position = ?', [targetUserId, 21]);
                await db.query('UPDATE dragon_arena_rankings SET user_id = ? WHERE rank_position = ?', [userId, target_rank]);
                // Clean up rank 21 if it exists and is the bot
                await db.query('DELETE FROM dragon_arena_rankings WHERE rank_position > 20');
            }
            newRank = target_rank;
        }

        res.json({
            winner: attackerWins ? 'attacker' : 'defender',
            new_rank: newRank,
            old_rank: currentRank,
            target_rank,
            coins_spent: used >= 5 ? 5000 : 0,
            challenges_remaining: Math.max(0, 5 - (used + 1)),
            battle_log: battleLog,
            atk_team: atkTeam.map(c => ({
                name: c.name, element: c.element, level: c.level,
                hp: Math.max(0, c.hp), maxHp: c.maxHp, startHp: c.startHp,
                att: c.att, def: c.def, spd: c.spd, position: c.position
            })),
            def_team: defTeam.map(c => ({
                name: c.name, element: c.element, level: c.level,
                hp: Math.max(0, c.hp), maxHp: c.maxHp, startHp: c.startHp,
                att: c.att, def: c.def, spd: c.spd, position: c.position
            })),
            attacker: { name: atkUser[0]?.display_name || 'Bạn' },
            defender: { name: defUser[0]?.display_name || 'Đối thủ' }
        });
    } catch (err) {
        console.error('Arena challenge error:', err);
        res.status(500).json({ error: 'Lỗi thách đấu' });
    }
});

/**
 * POST /api/arena/claim-rewards — Claim unclaimed arena rewards
 */
router.post('/claim-rewards', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rewards] = await db.query(`
            SELECT SUM(tickets_earned) as total_tickets, SUM(coins_earned) as total_coins
            FROM dragon_arena_rewards_log
            WHERE user_id = ? AND claimed = 0
        `, [userId]);

        const tickets = rewards[0]?.total_tickets || 0;
        const coins = rewards[0]?.total_coins || 0;

        if (tickets === 0 && coins === 0) {
            return res.status(400).json({ error: 'Không có phần thưởng chưa nhận!' });
        }

        // Award
        await db.query(
            'UPDATE user_currencies SET good_kid_tickets = good_kid_tickets + ?, chess_coins = chess_coins + ? WHERE user_id = ?',
            [tickets, coins, userId]
        );

        // Mark claimed
        await db.query(
            'UPDATE dragon_arena_rewards_log SET claimed = 1 WHERE user_id = ? AND claimed = 0',
            [userId]
        );

        res.json({
            message: `🏟️ Đã nhận thưởng Đấu Trường! +${tickets} 🎫 +${coins.toLocaleString()} 🪙`,
            tickets, coins
        });
    } catch (err) {
        console.error('Arena claim error:', err);
        res.status(500).json({ error: 'Lỗi nhận thưởng' });
    }
});

/**
 * Distribute arena rewards (called by cron every 6 hours)
 */
async function distributeArenaRewards() {
    try {
        const now = new Date();
        const period = `${now.toISOString().split('T')[0]}_${String(now.getHours()).padStart(2, '0')}`;

        const rewards = {
            1: { tickets: 5, coins: 15000 },
            2: { tickets: 4, coins: 10000 },
            3: { tickets: 3, coins: 8000 },
            4: { tickets: 2, coins: 5000 },
            5: { tickets: 2, coins: 4000 },
            6: { tickets: 1, coins: 3000 },
            7: { tickets: 1, coins: 2000 },
            8: { tickets: 1, coins: 1500 },
            9: { tickets: 0, coins: 1000 },
            10: { tickets: 0, coins: 500 }
        };

        // Get top 5 rankings (skip bots)
        const [top5] = await db.query(`
            SELECT dar.rank_position, dar.user_id, u.username
            FROM dragon_arena_rankings dar
            JOIN users u ON dar.user_id = u.id
            WHERE dar.rank_position <= 10 AND u.username NOT LIKE 'arena_bot_%'
            ORDER BY dar.rank_position
        `);

        for (const entry of top5) {
            const reward = rewards[entry.rank_position];
            if (!reward) continue;

            // Check if already rewarded for this period
            const [existing] = await db.query(
                'SELECT id FROM dragon_arena_rewards_log WHERE user_id = ? AND reward_period = ?',
                [entry.user_id, period]
            );
            if (existing.length > 0) continue;

            // Log reward (unclaimed)
            await db.query(`
                INSERT INTO dragon_arena_rewards_log (user_id, rank_position, tickets_earned, coins_earned, reward_period, claimed)
                VALUES (?, ?, ?, ?, ?, 0)
            `, [entry.user_id, entry.rank_position, reward.tickets, reward.coins, period]);

            console.log(`🏟️ Arena reward: User ${entry.user_id} (Rank ${entry.rank_position}) → +${reward.tickets}🎫 +${reward.coins}🪙`);
        }

        console.log(`🏟️ Arena reward distribution complete for period ${period}`);
    } catch (err) {
        console.error('Arena reward distribution error:', err);
    }
}

module.exports = router;
module.exports.distributeArenaRewards = distributeArenaRewards;
