const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dragon food EXP/stat mappings (by shop item name) — EXP only
const FOOD_EFFECTS = {
    'Cỏ Thần': { exp: 10 },
    'Thịt Nướng': { exp: 30 },
    'Trái Cây Thần': { exp: 60 },
    'Bánh Rồng': { exp: 120 },
    'Ngọc Rồng': { exp: 300 }
};

// Element system — Wu Xing + Light/Dark
const ELEMENTS = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark'];
const ELEMENT_NAMES = {
    metal: '🪙 Kim', wood: '🌿 Mộc', water: '💧 Thủy',
    fire: '🔥 Hỏa', earth: '🪨 Thổ',
    light: '✨ Ánh Sáng', dark: '🌑 Bóng Tối'
};
const RARITY_NAMES = { common: 'Thường', rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại', mythic: 'Thần Thoại' };
const ELEMENT_COLORS = {
    metal: '#C0C0C0', wood: '#2ECC71', water: '#3498DB',
    fire: '#E74C3C', earth: '#D4A574',
    light: '#F1C40F', dark: '#8E44AD'
};

// Element-specific base stats (at Lv.1)
const ELEMENT_BASE_STATS = {
    metal: { hp: 50, att: 10, def: 8, spd: 4 },
    wood: { hp: 65, att: 8, def: 5, spd: 5 },
    water: { hp: 50, att: 9, def: 5, spd: 8 },
    fire: { hp: 45, att: 14, def: 4, spd: 6 },
    earth: { hp: 60, att: 7, def: 9, spd: 3 },
    light: { hp: 55, att: 11, def: 7, spd: 6 },
    dark: { hp: 55, att: 11, def: 7, spd: 6 }
};

// Stat growth per level
const ELEMENT_GROWTH = {
    metal: { hp: 5, att: 2, def: 2, spd: 0.5 },
    wood: { hp: 7, att: 1.5, def: 1, spd: 1 },
    water: { hp: 5, att: 2, def: 1, spd: 1.5 },
    fire: { hp: 4, att: 3, def: 0.5, spd: 1 },
    earth: { hp: 6, att: 1, def: 2, spd: 0.5 },
    light: { hp: 6, att: 2.5, def: 1.5, spd: 1 },
    dark: { hp: 6, att: 2.5, def: 1.5, spd: 1 }
};

// Wu Xing counter: entry beats the next one in cycle
// Metal→Wood→Earth→Water→Fire→Metal
const WUXING_COUNTER = {
    metal: 'wood', wood: 'earth', earth: 'water',
    water: 'fire', fire: 'metal'
};

// Calculate element advantage multiplier
function getElementMultiplier(attackerElement, defenderElement) {
    // Light vs Dark: -10% both
    if ((attackerElement === 'light' && defenderElement === 'dark') ||
        (attackerElement === 'dark' && defenderElement === 'light')) {
        return 0.9;
    }
    // Light/Dark vs Wu Xing elements: +20%
    if ((attackerElement === 'light' || attackerElement === 'dark') &&
        ['metal', 'wood', 'water', 'fire', 'earth'].includes(defenderElement)) {
        return 1.2;
    }
    // Wu Xing counter: +30%
    if (WUXING_COUNTER[attackerElement] === defenderElement) {
        return 1.3;
    }
    return 1.0;
}

// Random element based on rates: 18%×5 + 5%×2
function randomElement() {
    const rand = Math.random() * 100;
    if (rand < 18) return 'metal';
    if (rand < 36) return 'wood';
    if (rand < 54) return 'water';
    if (rand < 72) return 'fire';
    if (rand < 90) return 'earth';
    if (rand < 95) return 'light';
    return 'dark';
}

// EXP required per level: level 1→2 = 100, 2→3 = 200, etc.
function expForLevel(level) { return level * 100; }

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
            'UPDATE user_dragons SET current_hp = ?, last_regen_at = NOW() WHERE user_id = ?',
            [dragon.current_hp, dragon.user_id]
        );
    }
    return dragon;
}

/**
 * GET /api/dragon/me — Get user's dragons + equipped items + formations
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get ALL user dragons
        const [dragons] = await db.query('SELECT * FROM user_dragons WHERE user_id = ? ORDER BY id', [userId]);

        if (dragons.length === 0) {
            return res.json({ dragon: null, dragons: [], formations: [] });
        }

        // Apply regen to all dragons
        for (let i = 0; i < dragons.length; i++) {
            dragons[i] = await applyRegen(dragons[i]);
            dragons[i].element_name = ELEMENT_NAMES[dragons[i].element] || dragons[i].element;
            dragons[i].element_color = ELEMENT_COLORS[dragons[i].element] || '#666';
            dragons[i].exp_needed = expForLevel(dragons[i].level);
        }

        const dragon = dragons[0]; // Primary dragon for backward compat

        // Get ALL equipped items with dragon_id
        const [allEquipped] = await db.query(`
            SELECT ude.*, ude.dragon_id, de.name, de.slot, de.rarity, de.icon,
                   de.hp_bonus, de.att_bonus, de.def_bonus, de.crit_rate_bonus, de.crit_dmg_bonus, de.spd_bonus
            FROM user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            WHERE ude.user_id = ? AND ude.is_equipped = true
        `, [userId]);

        // Build equipped map per dragon
        const equippedByDragon = {};
        for (const eq of allEquipped) {
            const did = eq.dragon_id || dragon.id; // fallback to primary dragon
            if (!equippedByDragon[did]) equippedByDragon[did] = {};
            equippedByDragon[did][eq.slot] = eq;
        }

        // Apply per-dragon equipment bonuses (legendary/mythic scale with base stats)
        for (const dr of dragons) {
            const drEquipped = equippedByDragon[dr.id] || {};
            const bonuses = { hp: 0, att: 0, def: 0, spd: 0, crit_rate: 0, crit_dmg: 0 };
            for (const eq of Object.values(drEquipped)) {
                const starMult = 1 + (eq.star_level || 0) * 0.5;
                const rarity = eq.rarity || 'common';
                let hpB = (eq.hp_bonus || 0), attB = (eq.att_bonus || 0), defB = (eq.def_bonus || 0);
                // Legendary: +5% of dragon base stats; Mythic: +8%
                if (rarity === 'legendary') {
                    hpB += Math.floor(dr.hp * 0.05);
                    attB += Math.floor(dr.att * 0.05);
                    defB += Math.floor(dr.def_stat * 0.05);
                } else if (rarity === 'mythic') {
                    hpB += Math.floor(dr.hp * 0.08);
                    attB += Math.floor(dr.att * 0.08);
                    defB += Math.floor(dr.def_stat * 0.08);
                }
                bonuses.hp += Math.floor(hpB * starMult);
                bonuses.att += Math.floor(attB * starMult);
                bonuses.def += Math.floor(defB * starMult);
                bonuses.spd += Math.floor((eq.spd_bonus || 0) * starMult);
                bonuses.crit_rate += (parseFloat(eq.crit_rate_bonus) || 0) * starMult;
                bonuses.crit_dmg += (parseFloat(eq.crit_dmg_bonus) || 0) * starMult;
            }
            dr.eq_bonuses = bonuses;
            dr.total_hp = dr.hp + bonuses.hp;
            dr.total_att = dr.att + bonuses.att;
            dr.total_def = dr.def_stat + bonuses.def;
            dr.total_spd = (dr.spd || 5) + bonuses.spd;
            dr.total_crit_rate = parseFloat(dr.crit_rate) + bonuses.crit_rate;
            dr.total_crit_dmg = parseFloat(dr.crit_dmg) + bonuses.crit_dmg;
        }

        // Equipped map for selected dragon (backward compat)
        const equippedMap = equippedByDragon[dragon.id] || {};

        // Get formations
        const [formations] = await db.query(
            'SELECT slot, dragon_id, position FROM dragon_formations WHERE user_id = ? ORDER BY slot', [userId]
        );

        // Get tickets
        const [currencies] = await db.query('SELECT good_kid_tickets FROM user_currencies WHERE user_id = ?', [userId]);

        // Get active buffs
        const [activeBuffs] = await db.query(
            'SELECT buff_type, expires_at FROM dragon_buffs WHERE user_id = ? AND expires_at > NOW()',
            [userId]
        );

        res.json({
            dragon: {
                ...dragon,
                total_hp: dragon.total_hp,
                total_att: dragon.total_att,
                total_def: dragon.total_def,
                total_crit_rate: dragon.total_crit_rate,
                total_crit_dmg: dragon.total_crit_dmg,
            },
            dragons: dragons,
            formations: formations,
            equipped: equippedMap,
            equipped_by_dragon: equippedByDragon,
            tickets: currencies[0]?.good_kid_tickets || 0,
            active_buffs: activeBuffs,
            element_names: ELEMENT_NAMES,
            element_colors: ELEMENT_COLORS
        });
    } catch (err) {
        console.error('Dragon me error:', err);
        res.status(500).json({ error: 'Lỗi lấy thông tin rồng' });
    }
});

/**
 * POST /api/dragon/create — Hatch a new dragon (multi-dragon allowed)
 */
router.post('/create', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;

        // Check max dragons (limit 10)
        const [existing] = await db.query('SELECT COUNT(*) as cnt FROM user_dragons WHERE user_id = ?', [userId]);
        if (existing[0].cnt >= 10) {
            return res.status(400).json({ error: 'Bạn đã có tối đa 10 rồng!' });
        }

        const element = randomElement();
        const baseStats = ELEMENT_BASE_STATS[element] || ELEMENT_BASE_STATS.fire;
        // New dragons start with element-specific base stats
        const [result] = await db.query(
            'INSERT INTO user_dragons (user_id, name, element, hp, att, def_stat, spd, current_hp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, name || 'Rồng Con', element, baseStats.hp, baseStats.att, baseStats.def, baseStats.spd, baseStats.hp]
        );

        res.status(201).json({
            message: `🥚 Trứng rồng đã nở! ${ELEMENT_NAMES[element]}!`,
            dragon_id: result.insertId,
            element: element,
            element_name: ELEMENT_NAMES[element]
        });
    } catch (err) {
        console.error('Dragon create error:', err);
        res.status(500).json({ error: 'Lỗi tạo rồng' });
    }
});

/**
 * POST /api/dragon/feed — Feed dragon with shop food items
 */
router.post('/feed', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { item_id, dragon_id } = req.body;

        // Check dragon exists
        let dragon;
        if (dragon_id) {
            const [drs] = await db.query('SELECT * FROM user_dragons WHERE id = ? AND user_id = ?', [dragon_id, userId]);
            if (drs.length === 0) return res.status(400).json({ error: 'Rồng không tồn tại!' });
            dragon = drs[0];
        } else {
            const [drs] = await db.query('SELECT * FROM user_dragons WHERE user_id = ? ORDER BY id LIMIT 1', [userId]);
            if (drs.length === 0) return res.status(400).json({ error: 'Bạn chưa có rồng!' });
            dragon = drs[0];
        }

        // Check user has the item
        const [inv] = await db.query(`
            SELECT ui.quantity, si.name FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND ui.item_id = ?
        `, [userId, item_id]);

        if (inv.length === 0 || inv[0].quantity <= 0) {
            return res.status(400).json({ error: 'Bạn không có thức ăn này!' });
        }

        const foodName = inv[0].name;
        const effects = FOOD_EFFECTS[foodName];
        if (!effects) {
            return res.status(400).json({ error: 'Đây không phải thức ăn rồng!' });
        }

        // Consume item
        await db.query('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [userId, item_id]);

        // Apply EXP
        let newExp = dragon.exp + effects.exp;
        let newLevel = dragon.level;
        let newHp = dragon.hp;
        let newAtt = dragon.att;
        let newDef = dragon.def_stat;
        let leveledUp = false;

        // Level up check — element-specific growth
        const growth = ELEMENT_GROWTH[dragon.element] || ELEMENT_GROWTH.fire;
        let newSpd = dragon.spd || 5;
        while (newExp >= expForLevel(newLevel)) {
            newExp -= expForLevel(newLevel);
            newLevel++;
            newHp += Math.floor(growth.hp);
            newAtt += Math.floor(growth.att);
            newDef += Math.floor(growth.def);
            newSpd += Math.max(1, Math.floor(growth.spd));
            leveledUp = true;
        }

        // Also add HP gains to current_hp so dragons heal on level-up
        const hpGain = newHp - dragon.hp;
        await db.query(
            'UPDATE user_dragons SET exp = ?, level = ?, hp = ?, att = ?, def_stat = ?, spd = ?, current_hp = LEAST(?, current_hp + ?) WHERE id = ? AND user_id = ?',
            [newExp, newLevel, newHp, newAtt, newDef, newSpd, newHp, hpGain, dragon.id, userId]
        );

        let msg = `🍖 Rồng đã ăn ${foodName}! +${effects.exp} EXP`;
        if (leveledUp) msg += ` 🎉 LEVEL UP → Lv.${newLevel}!`;

        res.json({
            message: msg,
            leveled_up: leveledUp,
            new_level: newLevel,
            new_exp: newExp
        });
    } catch (err) {
        console.error('Feed error:', err);
        res.status(500).json({ error: 'Lỗi cho ăn' });
    }
});

/**
 * GET /api/dragon/equipment — Get all user's equipment
 */
router.get('/equipment', authenticate, async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT ude.id as user_equip_id, ude.is_equipped, ude.obtained_at, ude.star_level,
                   de.id as equip_id, de.name, de.slot, de.rarity, de.icon,
                   de.hp_bonus, de.att_bonus, de.def_bonus, de.crit_rate_bonus, de.crit_dmg_bonus, de.spd_bonus
            FROM user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            WHERE ude.user_id = ?
            ORDER BY de.slot, FIELD(de.rarity, 'mythic', 'legendary', 'epic', 'rare', 'common'), ude.star_level DESC
        `, [req.user.id]);

        res.json({ equipment: items });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy trang bị' });
    }
});

/**
 * POST /api/dragon/equip — Equip an item
 */
router.post('/equip', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { user_equip_id, dragon_id } = req.body;

        if (!dragon_id) return res.status(400).json({ error: 'Chưa chọn rồng để trang bị!' });

        // Verify dragon belongs to user
        const [dragonCheck] = await db.query('SELECT id FROM user_dragons WHERE id = ? AND user_id = ?', [dragon_id, userId]);
        if (dragonCheck.length === 0) return res.status(400).json({ error: 'Rồng không hợp lệ!' });

        // Get the item
        const [items] = await db.query(`
            SELECT ude.*, de.slot, de.name FROM user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            WHERE ude.id = ? AND ude.user_id = ?
        `, [user_equip_id, userId]);

        if (items.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy trang bị' });
        }

        const item = items[0];

        // Unequip current item in same slot for THIS dragon
        await db.query(`
            UPDATE user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            SET ude.is_equipped = false, ude.dragon_id = NULL
            WHERE ude.user_id = ? AND de.slot = ? AND ude.is_equipped = true AND ude.dragon_id = ?
        `, [userId, item.slot, dragon_id]);

        // Equip new item to this dragon
        await db.query('UPDATE user_dragon_equipment SET is_equipped = true, dragon_id = ? WHERE id = ?', [dragon_id, user_equip_id]);

        res.json({ message: `⚔️ Đã trang bị: ${item.name}` });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi trang bị' });
    }
});

/**
 * POST /api/dragon/unequip — Unequip an item
 */
router.post('/unequip', authenticate, async (req, res) => {
    try {
        const { user_equip_id } = req.body;
        await db.query(
            'UPDATE user_dragon_equipment SET is_equipped = false, dragon_id = NULL WHERE id = ? AND user_id = ?',
            [user_equip_id, req.user.id]
        );
        res.json({ message: 'Đã tháo trang bị' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tháo trang bị' });
    }
});

/**
 * GET /api/dragon/gacha/pool — View gacha pool
 */
router.get('/gacha/pool', authenticate, async (req, res) => {
    try {
        const [pool] = await db.query('SELECT * FROM dragon_equipment ORDER BY slot, FIELD(rarity, "common", "rare", "epic", "legendary")');
        res.json({ pool });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi' });
    }
});

/**
 * POST /api/dragon/gacha — Pull gacha (costs 10 tickets)
 */
router.post('/gacha', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { multi } = req.body; // if multi=true, pull 10 items (1 guaranteed epic)
        const COST = multi ? 10 : 1;

        // Check tickets
        const [currencies] = await db.query('SELECT good_kid_tickets FROM user_currencies WHERE user_id = ?', [userId]);
        const tickets = currencies[0]?.good_kid_tickets || 0;

        if (tickets < COST) {
            return res.status(400).json({
                error: `Không đủ phiếu! Cần ${COST} phiếu, bạn có ${tickets} phiếu.`
            });
        }

        // Get all equipment with weights
        const [pool] = await db.query('SELECT * FROM dragon_equipment');
        if (pool.length === 0) {
            return res.status(500).json({ error: 'Pool trống' });
        }

        const rarityLabels = { common: '🟢 Thường', rare: '🔵 Hiếm', epic: '🟣 Sử Thi', legendary: '🟡 Huyền Thoại', mythic: '🔴 Thần Thoại' };

        // Helper: weighted random pick
        function weightedPick() {
            const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
            let random = Math.random() * totalWeight;
            let picked = pool[0];
            for (const item of pool) {
                random -= item.weight;
                if (random <= 0) { picked = item; break; }
            }
            return picked;
        }

        let results = [];

        if (multi) {
            // 10-ticket pull: 9 normal + 1 guaranteed epic (sử thi)
            for (let i = 0; i < 9; i++) {
                results.push(weightedPick());
            }
            // 10th item: guaranteed epic
            const epics = pool.filter(p => p.rarity === 'epic');
            if (epics.length > 0) {
                results.push(epics[Math.floor(Math.random() * epics.length)]);
            } else {
                // fallback if no epics exist
                const rares = pool.filter(p => p.rarity === 'rare');
                results.push(rares.length > 0 ? rares[Math.floor(Math.random() * rares.length)] : weightedPick());
            }
            // Shuffle so guaranteed isn't always last
            for (let i = results.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [results[i], results[j]] = [results[j], results[i]];
            }
        } else {
            results.push(weightedPick());
        }

        // Deduct tickets
        await db.query('UPDATE user_currencies SET good_kid_tickets = good_kid_tickets - ? WHERE user_id = ?', [COST, userId]);

        // Add all items to user's equipment and log
        for (const selected of results) {
            await db.query('INSERT INTO user_dragon_equipment (user_id, equipment_id) VALUES (?, ?)', [userId, selected.id]);
            await db.query('INSERT INTO gacha_history (user_id, equipment_id) VALUES (?, ?)', [userId, selected.id]);
        }

        // Log currency transaction
        const [curr] = await db.query('SELECT good_kid_tickets FROM user_currencies WHERE user_id = ?', [userId]);
        const bestItem = results.reduce((best, r) => {
            const order = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
            return (order[r.rarity] || 0) > (order[best.rarity] || 0) ? r : best;
        }, results[0]);
        await db.query(
            'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
            [userId, 'tickets', -COST, curr[0]?.good_kid_tickets || 0, 'gacha', `Gacha${multi ? ' x10' : ''}: ${bestItem.name}`]
        );

        const prizesWithLabels = results.map(s => ({
            ...s,
            rarity_label: rarityLabels[s.rarity] || s.rarity
        }));

        if (multi) {
            res.json({
                prizes: prizesWithLabels,
                remaining_tickets: curr[0]?.good_kid_tickets || 0,
                message: `✨ Bạn nhận được ${results.length} trang bị! Có 1 🟣 Sử Thi chắc chắn!`
            });
        } else {
            res.json({
                prize: prizesWithLabels[0],
                remaining_tickets: curr[0]?.good_kid_tickets || 0,
                message: `✨ Bạn nhận được: ${results[0].icon} ${results[0].name} (${rarityLabels[results[0].rarity]})!`
            });
        }
    } catch (err) {
        console.error('Gacha error:', err);
        res.status(500).json({ error: 'Lỗi gacha' });
    }
});

/**
 * GET /api/dragon/food — Get dragon food from inventory
 */
router.get('/food', authenticate, async (req, res) => {
    try {
        const [food] = await db.query(`
            SELECT ui.item_id, ui.quantity, si.name, si.icon_url, si.description
            FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND si.category = 'dragon_food' AND ui.quantity > 0
        `, [req.user.id]);

        res.json({ food });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy thức ăn' });
    }
});

/**
 * POST /api/dragon/use-item — Use potion or buff item
 */
router.post('/use-item', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { item_id } = req.body;

        // Get item from inventory
        const [inv] = await db.query(
            'SELECT ui.quantity, si.name, si.category FROM user_inventory ui JOIN shop_items si ON ui.item_id = si.id WHERE ui.user_id = ? AND ui.item_id = ? AND ui.quantity > 0',
            [userId, item_id]
        );
        if (inv.length === 0) return res.status(400).json({ error: 'Không có vật phẩm này!' });

        const item = inv[0];
        const [dragons] = await db.query('SELECT * FROM user_dragons WHERE user_id = ?', [userId]);
        if (dragons.length === 0) return res.status(400).json({ error: 'Chưa có rồng!' });
        const dragon = dragons[0];

        let msg = '';
        if (item.category === 'dragon_potion') {
            // Healing potions
            const healMap = {
                'Thuốc Hồi Nhỏ': 100, 'Thuốc Hồi Vừa': 200,
                'Thuốc Hồi Lớn': 500, 'Thuốc Hồi Siêu': 1000
            };
            const healAmount = healMap[item.name];
            if (healAmount) {
                const newHp = Math.min(dragon.hp, dragon.current_hp + healAmount);
                await db.query('UPDATE user_dragons SET current_hp = ? WHERE user_id = ?', [newHp, userId]);
                msg = `💚 Hồi ${healAmount} HP! (${dragon.current_hp} → ${newHp})`;
            } else if (item.name === 'Tinh Chất Hồi Phục') {
                const healPct = Math.floor(dragon.hp * 0.5);
                const newHp = Math.min(dragon.hp, dragon.current_hp + healPct);
                await db.query('UPDATE user_dragons SET current_hp = ? WHERE user_id = ?', [newHp, userId]);
                msg = `✨ Hồi 50% HP! (${dragon.current_hp} → ${newHp})`;
            } else {
                return res.status(400).json({ error: 'Vật phẩm không hợp lệ' });
            }
        } else if (item.category === 'dragon_buff') {
            const buffMap = {
                'Thần Hộ Giáp': { type: 'def_boost_50', duration: 24 },
                'Cuồng Nộ Rồng': { type: 'att_boost_100', duration: 24 }
            };
            const buff = buffMap[item.name];
            if (!buff) return res.status(400).json({ error: 'Vật phẩm không hợp lệ' });

            // Check if already has this buff
            const [existing] = await db.query(
                'SELECT id FROM dragon_buffs WHERE user_id = ? AND buff_type = ? AND expires_at > NOW()',
                [userId, buff.type]
            );
            if (existing.length > 0) return res.status(400).json({ error: 'Buff này đang còn hiệu lực!' });

            await db.query(
                'INSERT INTO dragon_buffs (user_id, buff_type, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
                [userId, buff.type, buff.duration]
            );
            msg = `🛡️ Kích hoạt ${item.name} trong ${buff.duration}h!`;
        } else {
            return res.status(400).json({ error: 'Vật phẩm không dùng được ở đây' });
        }

        // Consume item
        await db.query('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [userId, item_id]);

        res.json({ message: msg });
    } catch (err) {
        console.error('Use-item error:', err);
        res.status(500).json({ error: 'Lỗi sử dụng vật phẩm' });
    }
});

/**
 * POST /api/dragon/merge — Merge two identical equipment items
 * Requires two items with same equipment_id and same star_level
 * Result: one item deleted, the other gains +1 star_level
 * star_level 0-4 = gold stars, 5-9 = red stars (max 9)
 */
router.post('/merge', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { target_id, material_id } = req.body;

        if (!target_id || !material_id || target_id === material_id) {
            return res.status(400).json({ error: 'Chọn 2 trang bị khác nhau!' });
        }

        // Get both items
        const [items] = await db.query(`
            SELECT ude.id, ude.equipment_id, ude.is_equipped, ude.star_level,
                   de.name, de.icon, de.rarity
            FROM user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            WHERE ude.id IN (?, ?) AND ude.user_id = ?
        `, [target_id, material_id, userId]);

        if (items.length !== 2) {
            return res.status(404).json({ error: 'Không tìm thấy trang bị!' });
        }

        const target = items.find(i => i.id === target_id);
        const material = items.find(i => i.id === material_id);

        if (!target || !material) {
            return res.status(404).json({ error: 'Không tìm thấy trang bị!' });
        }

        // Must be same equipment type
        if (target.equipment_id !== material.equipment_id) {
            return res.status(400).json({ error: 'Hai trang bị phải cùng loại!' });
        }

        // Must be same star level
        if (target.star_level !== material.star_level) {
            return res.status(400).json({ error: 'Hai trang bị phải cùng số sao!' });
        }

        // Max star level is 10
        if (target.star_level >= 10) {
            return res.status(400).json({ error: 'Trang bị đã đạt cấp sao tối đa! (⭐10)' });
        }

        // Material must not be equipped
        if (material.is_equipped) {
            return res.status(400).json({ error: 'Hãy tháo trang bị nguyên liệu trước!' });
        }

        // Perform merge: delete material, upgrade target
        await db.query('DELETE FROM user_dragon_equipment WHERE id = ? AND user_id = ?', [material_id, userId]);
        await db.query('UPDATE user_dragon_equipment SET star_level = star_level + 1 WHERE id = ? AND user_id = ?', [target_id, userId]);

        const newStarLevel = target.star_level + 1;

        res.json({
            message: `✨ Ghép thành công! ${target.icon} ${target.name} → ⭐×${newStarLevel} (+${newStarLevel * 50}% chỉ số)`,
            new_star_level: newStarLevel
        });
    } catch (err) {
        console.error('Merge error:', err);
        res.status(500).json({ error: 'Lỗi ghép trang bị' });
    }
});

/**
 * POST /api/dragon/set-formation — Set battle formation (5 slots: 2 front + 3 back)
 */
router.post('/set-formation', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { formation } = req.body;
        // formation = [{ slot: 0, dragon_id: X, position: 'front' }, ...]

        if (!Array.isArray(formation) || formation.length === 0 || formation.length > 5) {
            return res.status(400).json({ error: 'Đội hình phải từ 1-5 rồng!' });
        }

        // Validate: max 2 front, max 3 back
        const frontCount = formation.filter(f => f.position === 'front').length;
        const backCount = formation.filter(f => f.position === 'back').length;
        if (frontCount > 2) return res.status(400).json({ error: 'Tối đa 2 rồng hàng trước!' });
        if (backCount > 3) return res.status(400).json({ error: 'Tối đa 3 rồng hàng sau!' });

        // Validate dragon ownership
        const dragonIds = formation.map(f => f.dragon_id);
        const [owned] = await db.query(
            `SELECT id FROM user_dragons WHERE user_id = ? AND id IN (${dragonIds.map(() => '?').join(',')})`,
            [userId, ...dragonIds]
        );
        if (owned.length !== dragonIds.length) {
            return res.status(400).json({ error: 'Rồng không hợp lệ!' });
        }

        // Clear old formation and insert new
        await db.query('DELETE FROM dragon_formations WHERE user_id = ?', [userId]);
        for (const f of formation) {
            await db.query(
                'INSERT INTO dragon_formations (user_id, slot, dragon_id, position) VALUES (?, ?, ?, ?)',
                [userId, f.slot, f.dragon_id, f.position]
            );
        }

        res.json({ message: '⚔️ Đã lưu đội hình chiến đấu!' });
    } catch (err) {
        console.error('Formation error:', err);
        res.status(500).json({ error: 'Lỗi lưu đội hình' });
    }
});

/**
 * GET /api/dragon/inventory — Get all usable items (potions + buffs)
 */
router.get('/inventory', authenticate, async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT ui.item_id, ui.quantity, si.name, si.description, si.category, si.icon_url, si.cost
            FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND ui.quantity > 0
            AND si.category IN ('dragon_potion', 'dragon_buff', 'dragon_food')
            ORDER BY si.category, si.cost
        `, [req.user.id]);

        // Get active buffs
        const [buffs] = await db.query(
            'SELECT buff_type, expires_at FROM dragon_buffs WHERE user_id = ? AND expires_at > NOW()',
            [req.user.id]
        );

        res.json({ items, active_buffs: buffs });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy kho đồ' });
    }
});
/**
 * POST /api/dragon/buy-egg — Buy a dragon egg (24h hatch)
 */
router.post('/buy-egg', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check max dragons (10) + pending eggs
        const [dragons] = await db.query('SELECT COUNT(*) as cnt FROM user_dragons WHERE user_id = ?', [userId]);
        const [pendingEggs] = await db.query('SELECT COUNT(*) as cnt FROM dragon_eggs WHERE user_id = ? AND hatched = 0', [userId]);
        if (dragons[0].cnt + pendingEggs[0].cnt >= 10) {
            return res.status(400).json({ error: 'Tối đa 10 rồng + trứng!' });
        }

        // Find the egg shop item
        const [eggItems] = await db.query("SELECT * FROM shop_items WHERE category = 'dragon_egg' AND is_active = 1 LIMIT 1");
        if (eggItems.length === 0) return res.status(400).json({ error: 'Không tìm thấy trứng trong shop!' });
        const eggItem = eggItems[0];

        // Check balance
        const [currencies] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
        if ((currencies[0]?.chess_coins || 0) < eggItem.cost) {
            return res.status(400).json({ error: `Không đủ xu! Cần ${eggItem.cost.toLocaleString()} xu.` });
        }

        // Deduct coins
        await db.query('UPDATE user_currencies SET chess_coins = chess_coins - ? WHERE user_id = ?', [eggItem.cost, userId]);

        // Create egg with 24h hatch time
        const { name } = req.body;
        await db.query(
            'INSERT INTO dragon_eggs (user_id, name, hatch_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
            [userId, name || 'Trứng Rồng']
        );

        res.json({ message: '🥚 Đã mua Trứng Rồng Thần! Ấp 24h để nở...' });
    } catch (err) {
        console.error('Buy egg error:', err);
        res.status(500).json({ error: 'Lỗi mua trứng' });
    }
});

/**
 * GET /api/dragon/eggs — List pending eggs
 */
router.get('/eggs', authenticate, async (req, res) => {
    try {
        const [eggs] = await db.query(
            'SELECT * FROM dragon_eggs WHERE user_id = ? AND hatched = 0 ORDER BY hatch_at',
            [req.user.id]
        );

        // Check if user has instant hatch item
        const [instantItems] = await db.query(`
            SELECT ui.quantity FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND si.category = 'dragon_special' AND ui.quantity > 0
        `, [req.user.id]);

        res.json({
            eggs: eggs.map(e => ({
                ...e,
                ready: new Date(e.hatch_at) <= new Date(),
                remaining_ms: Math.max(0, new Date(e.hatch_at) - Date.now())
            })),
            has_instant_hatch: instantItems.length > 0 && instantItems[0].quantity > 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy danh sách trứng' });
    }
});

/**
 * POST /api/dragon/hatch-egg — Hatch a ready egg or use instant-hatch item
 */
router.post('/hatch-egg', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { egg_id, use_instant } = req.body;

        const [eggs] = await db.query('SELECT * FROM dragon_eggs WHERE id = ? AND user_id = ? AND hatched = 0', [egg_id, userId]);
        if (eggs.length === 0) return res.status(400).json({ error: 'Trứng không hợp lệ!' });
        const egg = eggs[0];

        const isReady = new Date(egg.hatch_at) <= new Date();

        if (!isReady && !use_instant) {
            const remainMs = new Date(egg.hatch_at) - Date.now();
            const hours = Math.floor(remainMs / 3600000);
            const mins = Math.floor((remainMs % 3600000) / 60000);
            return res.status(400).json({ error: `⏳ Trứng chưa sẵn sàng! Còn ${hours}h ${mins}p` });
        }

        // If using instant hatch, consume the item
        if (!isReady && use_instant) {
            const [instantItem] = await db.query(`
                SELECT ui.item_id, ui.quantity FROM user_inventory ui
                JOIN shop_items si ON ui.item_id = si.id
                WHERE ui.user_id = ? AND si.category = 'dragon_special' AND ui.quantity > 0
            `, [userId]);
            if (instantItem.length === 0) {
                return res.status(400).json({ error: 'Bạn không có Lửa Phượng Hoàng!' });
            }
            await db.query('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [userId, instantItem[0].item_id]);
        }

        // Hatch the egg → create dragon
        const element = randomElement();
        await db.query('INSERT INTO user_dragons (user_id, name, element) VALUES (?, ?, ?)', [userId, egg.name || 'Rồng Con', element]);
        await db.query('UPDATE dragon_eggs SET hatched = 1 WHERE id = ?', [egg_id]);

        res.json({
            message: `🐉 ${egg.name} đã nở! ${ELEMENT_NAMES[element]}!`,
            element, element_name: ELEMENT_NAMES[element]
        });
    } catch (err) {
        console.error('Hatch error:', err);
        res.status(500).json({ error: 'Lỗi ấp trứng' });
    }
});
/**
 * POST /api/dragon/evolve — Evolve a dragon at max level
 * Requirements: dragon at level 100, a duplicate same-element dragon, and Ngọc Thăng Thiên item
 */
router.post('/evolve', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { dragon_id } = req.body;

        if (!dragon_id) return res.status(400).json({ error: 'Chưa chọn rồng!' });

        // Get target dragon
        const [dragons] = await db.query('SELECT * FROM user_dragons WHERE id = ? AND user_id = ?', [dragon_id, userId]);
        if (dragons.length === 0) return res.status(404).json({ error: 'Không tìm thấy rồng!' });

        const dragon = dragons[0];

        // Must be level 100
        if (dragon.level < 100) {
            return res.status(400).json({ error: `Rồng phải đạt Lv.100 để thăng cấp! (hiện tại: Lv.${dragon.level})` });
        }

        // Find a duplicate same-element dragon
        const [duplicates] = await db.query(
            'SELECT id, name FROM user_dragons WHERE user_id = ? AND element = ? AND id != ? ORDER BY level ASC LIMIT 1',
            [userId, dragon.element, dragon_id]
        );
        if (duplicates.length === 0) {
            return res.status(400).json({ error: `Cần 1 rồng cùng hệ ${ELEMENT_NAMES[dragon.element]} để hiến tế thăng cấp!` });
        }

        // Check for Ngọc Thăng Thiên in inventory (via shop_items join)
        const [items] = await db.query(`
            SELECT ui.id, ui.item_id, ui.quantity FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND si.category = 'dragon_evolve' AND ui.quantity > 0
            LIMIT 1
        `, [userId]);
        if (items.length === 0) {
            return res.status(400).json({ error: 'Cần vật phẩm "Ngọc Thăng Thiên" từ Chợ Phiên để thăng cấp! (500,000 xu)' });
        }

        const currentTier = dragon.tier || 0;
        const newTier = currentTier + 1;

        // Consume: delete duplicate dragon, decrement item
        await db.query('DELETE FROM user_dragons WHERE id = ? AND user_id = ?', [duplicates[0].id, userId]);
        if (items[0].quantity <= 1) {
            await db.query('DELETE FROM user_inventory WHERE id = ?', [items[0].id]);
        } else {
            await db.query('UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ?', [items[0].id]);
        }

        // Evolve: reset level, boost base stats by 100% per tier
        const baseMult = 1 + newTier;
        await db.query(`
            UPDATE user_dragons SET
                tier = ?,
                level = 1,
                exp = 0,
                hp = FLOOR(50 * ?),
                att = FLOOR(10 * ?),
                def_stat = FLOOR(5 * ?),
                current_hp = FLOOR(50 * ?)
            WHERE id = ? AND user_id = ?
        `, [newTier, baseMult, baseMult, baseMult, baseMult, dragon_id, userId]);

        const tierNames = ['', 'Phi Long', 'Thần Long', 'Thánh Long', 'Thiên Long'];
        const tierName = tierNames[newTier] || `Cấp ${newTier}`;

        res.json({
            message: `🐲✨ ${dragon.name} đã thăng cấp thành ${tierName}! Chỉ số gốc x${baseMult}!`,
            new_tier: newTier,
            tier_name: tierName,
            sacrificed: duplicates[0].name
        });
    } catch (err) {
        console.error('Evolve error:', err);
        res.status(500).json({ error: 'Lỗi thăng cấp rồng' });
    }
});

module.exports = router;
module.exports.getElementMultiplier = getElementMultiplier;
module.exports.ELEMENT_NAMES = ELEMENT_NAMES;
module.exports.ELEMENT_COLORS = ELEMENT_COLORS;
module.exports.ELEMENT_BASE_STATS = ELEMENT_BASE_STATS;
module.exports.ELEMENT_GROWTH = ELEMENT_GROWTH;
