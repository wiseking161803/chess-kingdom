const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Apply HP regen: 1% max HP per minute
async function applyRegen(dragon) {
    if (!dragon) return dragon;
    const now = Date.now();
    const lastRegen = new Date(dragon.last_regen_at).getTime();
    const minutesElapsed = Math.floor((now - lastRegen) / (1000 * 60));
    if (minutesElapsed >= 1 && dragon.current_hp < dragon.hp) {
        const regenAmount = Math.floor(dragon.hp * 0.01 * minutesElapsed);
        dragon.current_hp = Math.min(dragon.hp, dragon.current_hp + regenAmount);
        await db.query(
            'UPDATE user_dragons SET current_hp = ?, last_regen_at = NOW() WHERE id = ?',
            [dragon.current_hp, dragon.id]
        );
    }
    return dragon;
}

// Get user milestone level (highest completed)
async function getMilestoneLevel(userId) {
    try {
        const [rows] = await db.query(
            'SELECT COUNT(*) as lvl FROM user_milestones WHERE user_id = ? AND completed = 1',
            [userId]
        );
        return Math.max(1, rows[0]?.lvl || 1);
    } catch (e) {
        // Table might not exist yet
        return 1;
    }
}

// Get equipment bonuses for a user's dragon (with star multiplier)
// Get equipment bonuses for a user's dragon (with star multiplier + rarity scaling)
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

/**
 * GET /api/world/villages — List villages (other players)
 */
router.get('/villages', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [villages] = await db.query(`
            SELECT
                u.id as user_id, u.display_name,
                ue.current_elo,
                uc.knowledge_stars, uc.total_stars_earned,
                (SELECT MAX(created_at) FROM dragon_battles WHERE defender_id = u.id) as last_battle_at,
                (SELECT MAX(last_defended_at) FROM user_dragons WHERE user_id = u.id) as last_defended_at,
                (SELECT COUNT(*) FROM user_dragons WHERE user_id = u.id) as dragon_count
            FROM users u
            LEFT JOIN user_elo ue ON u.id = ue.user_id
            LEFT JOIN user_currencies uc ON u.id = uc.user_id
            WHERE u.status = 'active' AND u.role = 'student' AND u.id != ?
            ORDER BY ue.current_elo DESC
        `, [userId]);

        // Get milestone levels and calculate lootable coins
        const enriched = [];
        for (const v of villages) {
            const mileLvl = await getMilestoneLevel(v.user_id);

            // Shield check
            let shieldUntil = null;
            const lastDefended = v.last_defended_at || v.last_battle_at;
            if (lastDefended) {
                const shieldEnd = new Date(lastDefended).getTime() + (60 * 60 * 1000);
                if (shieldEnd > Date.now()) {
                    shieldUntil = new Date(shieldEnd).toISOString();
                }
            }

            enriched.push({
                user_id: v.user_id,
                display_name: v.display_name,
                elo: v.current_elo || 800,
                stars: v.total_stars_earned || 0,
                milestone_level: mileLvl,
                has_dragon: (v.dragon_count || 0) > 0,
                shield_until: shieldUntil
            });
        }

        res.json({ villages: enriched });
    } catch (err) {
        console.error('Villages error:', err);
        res.status(500).json({ error: 'Lỗi tải danh sách' });
    }
});

/**
 * POST /api/world/raid — Start a multi-dragon raid battle (5v5)
 */
router.post('/raid', authenticate, async (req, res) => {
    try {
        const attackerId = req.user.id;
        const { defender_id } = req.body;

        if (!defender_id || defender_id === attackerId) {
            return res.status(400).json({ error: 'Mục tiêu không hợp lệ' });
        }

        // Shield check
        const [shieldCheck] = await db.query(`
            SELECT MAX(created_at) as last_attack FROM dragon_battles
            WHERE defender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `, [defender_id]);
        if (shieldCheck[0]?.last_attack) {
            const shieldEnd = new Date(shieldCheck[0].last_attack).getTime() + (60 * 60 * 1000);
            const remainMs = shieldEnd - Date.now();
            if (remainMs > 0) {
                const remainMin = Math.ceil(remainMs / 60000);
                return res.status(400).json({ error: `🛡️ Làng này đang được bảo vệ! Còn ${remainMin} phút nữa.` });
            }
        }

        // Load formations helper — max 2 front, rest back
        async function loadFormation(userId) {
            const [allDragons] = await db.query('SELECT * FROM user_dragons WHERE user_id = ? ORDER BY id', [userId]);
            if (allDragons.length === 0) return [];
            const [formation] = await db.query(
                'SELECT slot, dragon_id, position FROM dragon_formations WHERE user_id = ? ORDER BY slot', [userId]
            );
            let team = [];
            if (formation.length > 0) {
                // Enforce max 2 front: if user set more, move extras to back
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
                    if (dr) team.push({ ...await applyRegen(dr), position: f.position });
                }
            }
            // Default: first 2 front, rest back
            if (team.length === 0) {
                for (let i = 0; i < allDragons.length; i++) {
                    const dr = await applyRegen(allDragons[i]);
                    team.push({ ...dr, position: i < 2 ? 'front' : 'back' });
                }
            }
            return team;
        }

        const atkTeam = await loadFormation(attackerId);
        const defTeam = await loadFormation(defender_id);
        if (atkTeam.length === 0) return res.status(400).json({ error: 'Bạn chưa có rồng!' });
        if (defTeam.length === 0) return res.status(400).json({ error: 'Đối thủ chưa có rồng!' });
        if (!atkTeam.some(d => d.current_hp > 0)) {
            return res.status(400).json({ error: 'Rồng của bạn hết HP! Hãy dùng thuốc hồi.' });
        }

        // Buffs (ATT/DEF only)
        const [atkBuffs] = await db.query('SELECT buff_type FROM dragon_buffs WHERE user_id = ? AND expires_at > NOW()', [attackerId]);
        const [defBuffs] = await db.query('SELECT buff_type FROM dragon_buffs WHERE user_id = ? AND expires_at > NOW()', [defender_id]);
        let atkAttM = 1, atkDefM = 1, defAttM = 1, defDefM = 1;
        for (const b of atkBuffs) { if (b.buff_type === 'att_boost_100') atkAttM += 0.5; if (b.buff_type === 'def_boost_50') atkDefM += 0.5; }
        for (const b of defBuffs) { if (b.buff_type === 'att_boost_100') defAttM += 0.5; if (b.buff_type === 'def_boost_50') defDefM += 0.5; }

        const { getElementMultiplier } = require('./dragon');

        // Per-dragon equipment bonuses computed inside buildC
        async function buildCWithEquip(dragon, userId, attM, defM, side) {
            const eq = await getEquipmentBonuses(userId, dragon.id, { hp: dragon.hp, att: dragon.att, def: dragon.def_stat });
            const tHp = (dragon.hp || 0) + eq.hp;
            const startHp = dragon.current_hp > 0 ? dragon.current_hp : tHp;
            return {
                id: dragon.id, name: dragon.name, element: dragon.element || 'fire',
                level: dragon.level, position: dragon.position, side,
                hp: startHp, maxHp: tHp, startHp: startHp,
                att: Math.floor(((dragon.att || 0) + eq.att) * attM),
                def: Math.floor(((dragon.def_stat || 0) + eq.def) * defM),
                spd: (dragon.spd || 5) + (eq.spd || 0),
                critRate: (parseFloat(dragon.crit_rate) + eq.crit_rate) / 100,
                critDmg: (parseFloat(dragon.crit_dmg) + eq.crit_dmg) / 100
            };
        }

        const atkC = await Promise.all(atkTeam.map(d => buildCWithEquip(d, attackerId, atkAttM, atkDefM, 'atk')));
        const defC = await Promise.all(defTeam.map(d => buildCWithEquip(d, defender_id, defAttM, defDefM, 'def')));

        // Battle: ALL alive dragons attack each turn, ordered by SPD
        const battleLog = [];
        let turn = 0;

        while (turn < 50) {
            const atkAlive = atkC.filter(c => c.hp > 0);
            const defAlive = defC.filter(c => c.hp > 0);
            if (atkAlive.length === 0 || defAlive.length === 0) break;

            turn++;
            // Gather alive dragons, sort by SPD desc (attacker goes first on tie)
            const turnOrder = [...atkAlive, ...defAlive].sort((a, b) => {
                if (b.spd !== a.spd) return b.spd - a.spd;
                return a.side === 'atk' ? -1 : 1;
            });

            for (const attacker of turnOrder) {
                if (attacker.hp <= 0) continue; // died this turn
                // Re-check opponents alive (critical: someone may have died this turn)
                const opponents = (attacker.side === 'atk' ? defC : atkC).filter(c => c.hp > 0);
                if (opponents.length === 0) break;

                // Check if battle is over (one side wiped)
                const atkStillAlive = atkC.filter(c => c.hp > 0).length;
                const defStillAlive = defC.filter(c => c.hp > 0).length;
                if (atkStillAlive === 0 || defStillAlive === 0) break;

                // Target priority: front row first, then back row
                // Within same row, target lowest HP
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
                    attacker: attacker.name, attackerId: attacker.id,
                    atkElement: attacker.element, atkSpd: attacker.spd,
                    target: target.name, targetId: target.id,
                    defElement: target.element,
                    elemBonus: em !== 1 ? Math.round((em - 1) * 100) : 0,
                    atkHp: attacker.hp, defHp: Math.max(0, target.hp)
                });
            }
        }

        const atkAlive = atkC.filter(c => c.hp > 0).length;
        const defAlive = defC.filter(c => c.hp > 0).length;
        // Attacker wins if defender team is wiped out.
        // If time runs out (50 turns), whoever has more alive wins. Tie = defender wins (home advantage).
        const attackerWins = defAlive === 0 ? true : (atkAlive === 0 ? false : atkAlive > defAlive);
        const winnerId = attackerWins ? attackerId : defender_id;

        // Update all dragon HP
        for (const c of atkC) await db.query('UPDATE user_dragons SET current_hp = ?, last_regen_at = NOW() WHERE id = ?', [Math.max(0, c.hp), c.id]);
        for (const c of defC) await db.query('UPDATE user_dragons SET current_hp = ?, last_regen_at = NOW(), last_defended_at = NOW() WHERE id = ?', [Math.max(0, c.hp), c.id]);

        // Coin theft — new formula based on attacker level
        let coinsStolen = 0;
        if (attackerWins) {
            const atkMileLvl = await getMilestoneLevel(attackerId);
            const defMileLvl = await getMilestoneLevel(defender_id);
            const [defCurr] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [defender_id]);
            const defCoins = defCurr[0]?.chess_coins || 0;

            // Base: max(5%*coins, 5000). Each attacker level: +1% and +5000
            const stealPct = 0.05 + (atkMileLvl - 1) * 0.01;
            const stealFlat = 5000 * atkMileLvl;
            const maxSteal = Math.max(Math.floor(defCoins * stealPct), stealFlat);

            // Cap at 10000 * defender level
            const defCap = 10000 * defMileLvl;
            coinsStolen = Math.min(maxSteal, defCap, defCoins);
            coinsStolen = Math.max(0, coinsStolen);

            if (coinsStolen > 0) {
                await db.query('UPDATE user_currencies SET chess_coins = chess_coins - ? WHERE user_id = ?', [coinsStolen, defender_id]);
                await db.query('UPDATE user_currencies SET chess_coins = chess_coins + ? WHERE user_id = ?', [coinsStolen, attackerId]);
            }
        }

        await db.query('INSERT INTO dragon_battles (attacker_id, defender_id, winner_id, coins_stolen, battle_log) VALUES (?,?,?,?,?)',
            [attackerId, defender_id, winnerId, coinsStolen, JSON.stringify(battleLog)]);

        const [atkUser] = await db.query('SELECT display_name FROM users WHERE id = ?', [attackerId]);
        const [defUser] = await db.query('SELECT display_name FROM users WHERE id = ?', [defender_id]);

        res.json({
            winner: attackerWins ? 'attacker' : 'defender',
            coins_stolen: coinsStolen,
            battle_log: battleLog,
            atk_team: atkC.map(c => ({ id: c.id, name: c.name, element: c.element, level: c.level, hp: Math.max(0, c.hp), maxHp: c.maxHp, startHp: c.startHp || c.maxHp, att: c.att, def: c.def, spd: c.spd, position: c.position })),
            def_team: defC.map(c => ({ id: c.id, name: c.name, element: c.element, level: c.level, hp: Math.max(0, c.hp), maxHp: c.maxHp, startHp: c.startHp || c.maxHp, att: c.att, def: c.def, spd: c.spd, position: c.position })),
            attacker: {
                name: atkUser[0]?.display_name || 'Bạn',
                dragon_name: atkC[0].name, dragon_level: atkC[0].level,
                max_hp: atkC[0].maxHp, start_hp: atkTeam[0].current_hp || atkC[0].maxHp,
                end_hp: Math.max(0, atkC[0].hp)
            },
            defender: {
                name: defUser[0]?.display_name || 'Đối thủ',
                dragon_name: defC[0].name, dragon_level: defC[0].level,
                max_hp: defC[0].maxHp, start_hp: defTeam[0].current_hp > 0 ? defTeam[0].current_hp : defC[0].maxHp,
                end_hp: Math.max(0, defC[0].hp)
            }
        });
    } catch (err) {
        console.error('Raid error:', err);
        res.status(500).json({ error: 'Lỗi chiến đấu' });
    }
});

/**
 * GET /api/world/battle-history — Recent battles
 */
router.get('/battle-history', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [battles] = await db.query(`
            SELECT db.id, db.attacker_id, db.defender_id, db.winner_id, db.coins_stolen, db.created_at,
                   a.display_name as attacker_name, d.display_name as defender_name
            FROM dragon_battles db
            JOIN users a ON db.attacker_id = a.id
            JOIN users d ON db.defender_id = d.id
            WHERE db.attacker_id = ? OR db.defender_id = ?
            ORDER BY db.created_at DESC LIMIT 20
        `, [userId, userId]);

        res.json({ battles, user_id: userId });
    } catch (err) {
        console.error('History error:', err);
        res.status(500).json({ error: 'Lỗi tải lịch sử' });
    }
});

module.exports = router;
