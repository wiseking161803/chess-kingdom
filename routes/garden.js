const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Seed config: item name -> grow time (ms), sell price, EXP, favorite element
const SEED_CONFIG = {
    // Tier 1: Quick (1-5 min)
    'Hạt Cỏ May': { growMs: 60000, sellPrice: 50, exp: 5, favElem: 'metal', harvest: 'Cỏ May', hIcon: '🌱', tier: 1 },
    'Hạt Húng Quế': { growMs: 120000, sellPrice: 80, exp: 8, favElem: 'wood', harvest: 'Húng Quế', hIcon: '🌿', tier: 1 },
    'Hạt Bạc Hà': { growMs: 180000, sellPrice: 100, exp: 10, favElem: 'water', harvest: 'Bạc Hà', hIcon: '🍃', tier: 1 },
    'Hạt Ớt': { growMs: 240000, sellPrice: 130, exp: 12, favElem: 'fire', harvest: 'Ớt', hIcon: '🌶️', tier: 1 },
    'Hạt Khoai': { growMs: 300000, sellPrice: 120, exp: 10, favElem: 'earth', harvest: 'Khoai Lang', hIcon: '🥔', tier: 1 },

    // Tier 2: Medium (10-20 min)
    'Hạt Cà Rốt': { growMs: 600000, sellPrice: 300, exp: 25, favElem: 'light', harvest: 'Cà Rốt', hIcon: '🥕', tier: 2 },
    'Hạt Cà Tím': { growMs: 600000, sellPrice: 300, exp: 25, favElem: 'dark', harvest: 'Cà Tím', hIcon: '🍆', tier: 2 },
    'Hạt Bắp': { growMs: 900000, sellPrice: 400, exp: 30, favElem: 'metal', harvest: 'Bắp Ngô', hIcon: '🌽', tier: 2 },
    'Hạt Cà Chua': { growMs: 1200000, sellPrice: 500, exp: 35, favElem: 'fire', harvest: 'Cà Chua', hIcon: '🍅', tier: 2 },
    'Hạt Dưa Hấu': { growMs: 1200000, sellPrice: 600, exp: 40, favElem: 'water', harvest: 'Dưa Hấu', hIcon: '🍉', tier: 2 },

    // Tier 3: Long (30-60 min)
    'Hạt Táo': { growMs: 1800000, sellPrice: 1000, exp: 60, favElem: 'wood', harvest: 'Táo', hIcon: '🍎', tier: 3 },
    'Hạt Đào': { growMs: 2400000, sellPrice: 1200, exp: 70, favElem: 'light', harvest: 'Đào Tiên', hIcon: '🍑', tier: 3 },
    'Hạt Nho': { growMs: 2700000, sellPrice: 1500, exp: 80, favElem: 'dark', harvest: 'Nho Tím', hIcon: '🍇', tier: 3 },
    'Hạt Dâu': { growMs: 3000000, sellPrice: 1500, exp: 80, favElem: 'earth', harvest: 'Dâu Tây', hIcon: '🍓', tier: 3 },
    'Hạt Cam': { growMs: 3600000, sellPrice: 2000, exp: 100, favElem: 'fire', harvest: 'Cam Vàng', hIcon: '🍊', tier: 3 },

    // Tier 4: Premium (2-6h)
    'Hạt Xoài': { growMs: 7200000, sellPrice: 4000, exp: 200, favElem: 'metal', harvest: 'Xoài Hoàng Kim', hIcon: '🥭', tier: 4 },
    'Hạt Dừa': { growMs: 10800000, sellPrice: 5000, exp: 250, favElem: 'water', harvest: 'Dừa Xiêm', hIcon: '🥥', tier: 4 },
    'Hạt Sầu Riêng': { growMs: 14400000, sellPrice: 7000, exp: 350, favElem: 'earth', harvest: 'Sầu Riêng', hIcon: '🫠', tier: 4 },
    'Hạt Hoa Sen': { growMs: 18000000, sellPrice: 8000, exp: 400, favElem: 'light', harvest: 'Hoa Sen', hIcon: '🪷', tier: 4 },
    'Hạt Nấm Linh Chi': { growMs: 21600000, sellPrice: 10000, exp: 500, favElem: 'dark', harvest: 'Nấm Linh Chi', hIcon: '🍄', tier: 4 }
};

// Favorite element EXP multiplier
const FAV_MULTIPLIER = 3;

/**
 * GET /api/garden/plots — Get user's garden plots
 */
router.get('/plots', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Ensure user has at least 1 plot
        await db.query(`
            INSERT IGNORE INTO garden_plots (user_id, slot, status)
            VALUES (?, 0, 'empty')
        `, [userId]);

        const [plots] = await db.query(`
            SELECT gp.*, si.name as seed_name
            FROM garden_plots gp
            LEFT JOIN shop_items si ON gp.seed_item_id = si.id
            WHERE gp.user_id = ?
            ORDER BY gp.slot
        `, [userId]);

        const now = Date.now();
        const enriched = plots.map(p => {
            const config = SEED_CONFIG[p.seed_name];
            let readyIn = null;
            let progress = 0;

            // Auto-update status if ready
            if (p.status === 'watered' && p.harvest_ready_at) {
                const readyAt = new Date(p.harvest_ready_at).getTime();
                if (now >= readyAt) {
                    p.status = 'ready';
                    db.query('UPDATE garden_plots SET status = ? WHERE id = ?', ['ready', p.id]);
                } else {
                    readyIn = Math.ceil((readyAt - now) / 1000);
                    const totalGrow = config?.growMs || 60000;
                    const elapsed = now - new Date(p.watered_at).getTime();
                    progress = Math.min(100, Math.round((elapsed / totalGrow) * 100));
                }
            }

            return {
                id: p.id,
                slot: p.slot,
                status: p.status,
                seed_name: p.seed_name,
                seed_icon: config?.hIcon || '🌱',
                harvest_name: config?.harvest || null,
                harvest_icon: config?.hIcon || null,
                ready_in_seconds: readyIn,
                progress,
                tier: config?.tier || 0
            };
        });

        // Get seed inventory
        const [seeds] = await db.query(`
            SELECT ui.quantity, si.id as item_id, si.name, si.cost, si.description
            FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND si.category = 'garden_seed' AND ui.quantity > 0
            ORDER BY si.sort_order
        `, [userId]);

        // Inject icons from SEED_CONFIG
        const enrichedSeeds = seeds.map(s => ({
            ...s,
            icon: SEED_CONFIG[s.name]?.hIcon || '🌱'
        }));

        res.json({
            plots: enriched,
            seeds: enrichedSeeds,
            max_plots: getMaxPlots(userId)
        });
    } catch (err) {
        console.error('Garden plots error:', err);
        res.status(500).json({ error: 'Lỗi tải vườn' });
    }
});

function getMaxPlots(userId) {
    // Expandable: later can be based on level/purchases
    return 6; // Start with max 6 plots
}

/**
 * POST /api/garden/plant — Plant a seed
 */
router.post('/plant', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { slot, seed_item_id } = req.body;

        // Check plot exists and is empty
        const [plot] = await db.query(
            'SELECT * FROM garden_plots WHERE user_id = ? AND slot = ?', [userId, slot]
        );
        if (plot.length === 0) {
            return res.status(400).json({ error: 'Ô đất không tồn tại!' });
        }
        if (plot[0].status !== 'empty') {
            return res.status(400).json({ error: 'Ô đất đã có cây!' });
        }

        // Check seed in inventory
        const [inv] = await db.query(
            'SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?', [userId, seed_item_id]
        );
        if (inv.length === 0 || inv[0].quantity < 1) {
            return res.status(400).json({ error: 'Không có hạt giống trong kho!' });
        }

        // Deduct seed
        await db.query(
            'UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?',
            [userId, seed_item_id]
        );

        // Plant
        await db.query(`
            UPDATE garden_plots SET seed_item_id = ?, planted_at = NOW(), status = 'planted'
            WHERE user_id = ? AND slot = ?
        `, [seed_item_id, userId, slot]);

        res.json({ message: '🌱 Đã gieo hạt! Tưới nước để cây bắt đầu lớn.' });
    } catch (err) {
        console.error('Garden plant error:', err);
        res.status(500).json({ error: 'Lỗi gieo hạt' });
    }
});

/**
 * POST /api/garden/water — Water a planted seed
 */
router.post('/water', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { slot } = req.body;

        const [plot] = await db.query(
            'SELECT gp.*, si.name as seed_name FROM garden_plots gp LEFT JOIN shop_items si ON gp.seed_item_id = si.id WHERE gp.user_id = ? AND gp.slot = ?',
            [userId, slot]
        );
        if (plot.length === 0) return res.status(400).json({ error: 'Ô đất không tồn tại!' });
        if (plot[0].status !== 'planted') return res.status(400).json({ error: 'Ô đất chưa gieo hạt hoặc đã tưới!' });

        const config = SEED_CONFIG[plot[0].seed_name];
        if (!config) return res.status(400).json({ error: 'Loại hạt không hợp lệ!' });

        const harvestReadyAt = new Date(Date.now() + config.growMs);
        await db.query(`
            UPDATE garden_plots SET watered_at = NOW(), harvest_ready_at = ?, status = 'watered'
            WHERE user_id = ? AND slot = ?
        `, [harvestReadyAt, userId, slot]);

        const growMins = Math.ceil(config.growMs / 60000);
        res.json({
            message: `💧 Đã tưới nước! Thu hoạch sau ${growMins < 60 ? growMins + ' phút' : Math.round(growMins / 60 * 10) / 10 + ' giờ'}.`,
            harvest_ready_at: harvestReadyAt.toISOString(),
            grow_time_ms: config.growMs
        });
    } catch (err) {
        console.error('Garden water error:', err);
        res.status(500).json({ error: 'Lỗi tưới nước' });
    }
});

/**
 * POST /api/garden/harvest — Harvest a ready crop
 */
router.post('/harvest', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { slot } = req.body;

        const [plot] = await db.query(
            'SELECT gp.*, si.name as seed_name FROM garden_plots gp LEFT JOIN shop_items si ON gp.seed_item_id = si.id WHERE gp.user_id = ? AND gp.slot = ?',
            [userId, slot]
        );
        if (plot.length === 0) return res.status(400).json({ error: 'Ô đất không tồn tại!' });

        // Auto-check readiness
        if (plot[0].status === 'watered') {
            const readyAt = new Date(plot[0].harvest_ready_at).getTime();
            if (Date.now() >= readyAt) {
                plot[0].status = 'ready';
            }
        }

        if (plot[0].status !== 'ready') return res.status(400).json({ error: 'Cây chưa sẵn sàng thu hoạch!' });

        const config = SEED_CONFIG[plot[0].seed_name];
        if (!config) return res.status(400).json({ error: 'Loại cây không hợp lệ!' });

        // Reset plot
        await db.query(`
            UPDATE garden_plots SET seed_item_id = NULL, planted_at = NULL, watered_at = NULL,
            harvest_ready_at = NULL, status = 'empty' WHERE user_id = ? AND slot = ?
        `, [userId, slot]);

        // Log harvest
        await db.query(
            'INSERT INTO garden_harvests (user_id, seed_item_id, harvest_item_name) VALUES (?, ?, ?)',
            [userId, plot[0].seed_item_id, config.harvest]
        );

        // Add harvest to a virtual inventory using a special key
        // We'll add the harvest item as a generic "food" item that can be sold or fed
        // Store in user_garden_inventory
        await db.query(`
            INSERT INTO user_garden_harvest (user_id, harvest_name, harvest_icon, quantity, sell_price, exp_value, fav_element, tier)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = quantity + 1
        `, [userId, config.harvest, config.hIcon, config.sellPrice, config.exp, config.favElem, config.tier]);

        res.json({
            message: `🎉 Thu hoạch ${config.hIcon} ${config.harvest}!`,
            harvest: {
                name: config.harvest,
                icon: config.hIcon,
                sell_price: config.sellPrice,
                exp: config.exp,
                fav_element: config.favElem,
                tier: config.tier
            }
        });
    } catch (err) {
        console.error('Garden harvest error:', err);
        res.status(500).json({ error: 'Lỗi thu hoạch' });
    }
});

/**
 * GET /api/garden/harvest-inventory — Get harvested items
 */
router.get('/harvest-inventory', authenticate, async (req, res) => {
    try {
        const [items] = await db.query(
            'SELECT * FROM user_garden_harvest WHERE user_id = ? AND quantity > 0 ORDER BY tier, harvest_name',
            [req.user.id]
        );
        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi' });
    }
});

/**
 * POST /api/garden/sell — Sell harvest for coins
 */
router.post('/sell', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { harvest_name, quantity = 1 } = req.body;

        const [item] = await db.query(
            'SELECT * FROM user_garden_harvest WHERE user_id = ? AND harvest_name = ? AND quantity >= ?',
            [userId, harvest_name, quantity]
        );
        if (item.length === 0) return res.status(400).json({ error: 'Không đủ nông sản!' });

        const totalCoins = item[0].sell_price * quantity;

        // Deduct
        await db.query(
            'UPDATE user_garden_harvest SET quantity = quantity - ? WHERE user_id = ? AND harvest_name = ?',
            [quantity, userId, harvest_name]
        );

        // Add coins
        await db.query(
            'UPDATE user_currencies SET chess_coins = chess_coins + ? WHERE user_id = ?',
            [totalCoins, userId]
        );

        res.json({
            message: `💰 Bán ${item[0].harvest_icon} ${harvest_name} x${quantity} → +${totalCoins.toLocaleString()} xu!`,
            coins_earned: totalCoins
        });
    } catch (err) {
        console.error('Garden sell error:', err);
        res.status(500).json({ error: 'Lỗi bán' });
    }
});

/**
 * POST /api/garden/feed-dragon — Feed harvest to dragon for EXP
 */
router.post('/feed-dragon', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { harvest_name, dragon_id, quantity = 1 } = req.body;

        const [item] = await db.query(
            'SELECT * FROM user_garden_harvest WHERE user_id = ? AND harvest_name = ? AND quantity >= ?',
            [userId, harvest_name, quantity]
        );
        if (item.length === 0) return res.status(400).json({ error: 'Không đủ nông sản!' });

        // Get dragon
        const [dragon] = await db.query(
            'SELECT * FROM user_dragons WHERE id = ? AND user_id = ?', [dragon_id, userId]
        );
        if (dragon.length === 0) return res.status(400).json({ error: 'Rồng không tồn tại!' });

        // Calculate EXP
        const baseExp = item[0].exp_value * quantity;
        const isFavorite = dragon[0].element === item[0].fav_element;
        const totalExp = isFavorite ? baseExp * FAV_MULTIPLIER : baseExp;

        // Deduct
        await db.query(
            'UPDATE user_garden_harvest SET quantity = quantity - ? WHERE user_id = ? AND harvest_name = ?',
            [quantity, userId, harvest_name]
        );

        // Add EXP to dragon
        await db.query(
            'UPDATE user_dragons SET exp = exp + ? WHERE id = ?', [totalExp, dragon_id]
        );

        // Check level up
        const newExp = (dragon[0].exp || 0) + totalExp;
        const expPerLevel = 50 + dragon[0].level * 25;
        let levelUps = 0;
        let currentExp = newExp;
        let currentLevel = dragon[0].level;
        while (currentExp >= (50 + currentLevel * 25)) {
            currentExp -= (50 + currentLevel * 25);
            currentLevel++;
            levelUps++;
        }

        if (levelUps > 0) {
            // Recalculate stats at new level (simplified)
            const ELEMENT_BASE_STATS = {
                metal: { hp: 50, att: 10, def: 8, spd: 4 }, wood: { hp: 65, att: 8, def: 5, spd: 5 },
                water: { hp: 50, att: 9, def: 5, spd: 8 }, fire: { hp: 45, att: 14, def: 4, spd: 6 },
                earth: { hp: 60, att: 7, def: 9, spd: 3 }, light: { hp: 55, att: 11, def: 7, spd: 6 },
                dark: { hp: 55, att: 11, def: 7, spd: 6 }
            };
            const ELEMENT_GROWTH = {
                metal: { hp: 5, att: 2, def: 2, spd: 0.5 }, wood: { hp: 7, att: 1.5, def: 1, spd: 1 },
                water: { hp: 5, att: 2, def: 1, spd: 1.5 }, fire: { hp: 4, att: 3, def: 0.5, spd: 1 },
                earth: { hp: 6, att: 1, def: 2, spd: 0.5 }, light: { hp: 5, att: 2, def: 1.5, spd: 1 },
                dark: { hp: 5, att: 2, def: 1.5, spd: 1 }
            };
            const base = ELEMENT_BASE_STATS[dragon[0].element] || ELEMENT_BASE_STATS.fire;
            const growth = ELEMENT_GROWTH[dragon[0].element] || ELEMENT_GROWTH.fire;
            const lvl = currentLevel - 1;
            const newHp = Math.floor(base.hp + growth.hp * lvl);
            const newAtt = Math.floor(base.att + growth.att * lvl);
            const newDef = Math.floor(base.def + growth.def * lvl);
            const newSpd = Math.floor(base.spd + growth.spd * lvl);

            await db.query(
                'UPDATE user_dragons SET level = ?, exp = ?, hp = ?, att = ?, def_stat = ?, spd = ?, current_hp = ? WHERE id = ?',
                [currentLevel, currentExp, newHp, newAtt, newDef, newSpd, newHp, dragon_id]
            );
        } else {
            await db.query('UPDATE user_dragons SET exp = ? WHERE id = ?', [currentExp, dragon_id]);
        }

        let msg = `${item[0].harvest_icon} Cho ${dragon[0].name} ăn ${harvest_name} x${quantity} → +${totalExp} EXP`;
        if (isFavorite) msg += ' 🌟 Món khoái khẩu x3!';
        if (levelUps > 0) msg += ` 🎉 Lên Lv.${currentLevel}!`;

        res.json({
            message: msg,
            exp_gained: totalExp,
            is_favorite: isFavorite,
            level_ups: levelUps,
            new_level: currentLevel
        });
    } catch (err) {
        console.error('Garden feed error:', err);
        res.status(500).json({ error: 'Lỗi cho ăn' });
    }
});

/**
 * POST /api/garden/unlock-plot — Unlock additional garden plot
 */
router.post('/unlock-plot', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [plots] = await db.query(
            'SELECT COUNT(*) as cnt FROM garden_plots WHERE user_id = ?', [userId]
        );
        const currentPlots = plots[0].cnt;
        const maxPlots = getMaxPlots();

        if (currentPlots >= maxPlots) {
            return res.status(400).json({ error: `Đã đạt tối đa ${maxPlots} ô đất!` });
        }

        // Cost: 2000 * (slotNumber + 1)
        const cost = 2000 * (currentPlots + 1);

        const [bal] = await db.query('SELECT chess_coins FROM user_currencies WHERE user_id = ?', [userId]);
        if ((bal[0]?.chess_coins || 0) < cost) {
            return res.status(400).json({ error: `Cần ${cost.toLocaleString()} xu để mở ô đất tiếp theo!` });
        }

        await db.query('UPDATE user_currencies SET chess_coins = chess_coins - ? WHERE user_id = ?', [cost, userId]);
        await db.query('INSERT INTO garden_plots (user_id, slot, status) VALUES (?, ?, ?)', [userId, currentPlots, 'empty']);

        res.json({
            message: `🌾 Mở ô đất #${currentPlots + 1}! (-${cost.toLocaleString()} xu)`,
            new_slot: currentPlots,
            cost
        });
    } catch (err) {
        console.error('Garden unlock error:', err);
        res.status(500).json({ error: 'Lỗi mở ô đất' });
    }
});

module.exports = router;
