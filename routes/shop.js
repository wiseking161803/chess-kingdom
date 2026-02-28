const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/shop/items — List shop items
 */
router.get('/items', authenticate, async (req, res) => {
    try {
        const [items] = await db.query(
            'SELECT * FROM shop_items WHERE is_active = 1 ORDER BY sort_order, cost'
        );

        // Get user inventory to check owned items
        const [inventory] = await db.query(
            'SELECT item_id, quantity FROM user_inventory WHERE user_id = ?',
            [req.user.id]
        );
        const inventoryMap = {};
        for (const inv of inventory) {
            inventoryMap[inv.item_id] = inv.quantity;
        }

        const enriched = items.map(item => ({
            ...item,
            owned_quantity: inventoryMap[item.id] || 0
        }));

        // Get user balance
        const [currencies] = await db.query(
            'SELECT knowledge_stars, chess_coins FROM user_currencies WHERE user_id = ?',
            [req.user.id]
        );

        res.json({
            items: enriched,
            balance: {
                stars: currencies[0]?.knowledge_stars || 0,
                coins: currencies[0]?.chess_coins || 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy danh sách' });
    }
});

/**
 * POST /api/shop/purchase — Buy an item
 */
router.post('/purchase', authenticate, async (req, res) => {
    try {
        const { item_id, quantity = 1 } = req.body;
        const userId = req.user.id;

        const [items] = await db.query('SELECT * FROM shop_items WHERE id = ? AND is_active = 1', [item_id]);
        if (items.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy vật phẩm' });
        }

        const item = items[0];
        const totalCost = item.cost * quantity;

        // Check balance
        const [currencies] = await db.query(
            'SELECT knowledge_stars, chess_coins FROM user_currencies WHERE user_id = ?',
            [userId]
        );
        const balance = currencies[0] || { knowledge_stars: 0, chess_coins: 0 };

        if (item.cost_type === 'coins' && balance.chess_coins < totalCost) {
            return res.status(400).json({ error: `Không đủ xu! Cần ${totalCost} xu, bạn có ${balance.chess_coins} xu.` });
        }
        if (item.cost_type === 'stars' && balance.knowledge_stars < totalCost) {
            return res.status(400).json({ error: `Không đủ sao! Cần ${totalCost} sao, bạn có ${balance.knowledge_stars} sao.` });
        }

        // Check max quantity for special items
        if (item.max_quantity) {
            const [inv] = await db.query(
                'SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?',
                [userId, item_id]
            );
            if (inv.length > 0 && inv[0].quantity + quantity > item.max_quantity) {
                return res.status(400).json({ error: `Bạn chỉ có thể sở hữu tối đa ${item.max_quantity} ${item.name}` });
            }
        }

        // Check daily purchase limit
        if (item.daily_limit) {
            const today = new Date().toISOString().split('T')[0];
            const [dayPurchases] = await db.query(
                `SELECT COALESCE(SUM(ABS(ct.amount) / ?), 0) as bought
                 FROM currency_transactions ct
                 WHERE ct.user_id = ? AND ct.source = 'shop_purchase'
                   AND ct.description LIKE ? AND DATE(ct.created_at) = ?`,
                [item.cost, userId, `%${item.name}%`, today]
            );
            if (dayPurchases[0].bought + quantity > item.daily_limit) {
                return res.status(400).json({ error: `Bạn chỉ có thể mua ${item.daily_limit} ${item.name}/ngày!` });
            }
        }

        // Check weekly purchase limit
        if (item.weekly_limit) {
            const [weekPurchases] = await db.query(
                `SELECT COALESCE(SUM(ABS(ct.amount) / ?), 0) as bought
                 FROM currency_transactions ct
                 WHERE ct.user_id = ? AND ct.source = 'shop_purchase'
                   AND ct.description LIKE ? AND ct.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
                [item.cost, userId, `%${item.name}%`]
            );
            if (weekPurchases[0].bought + quantity > item.weekly_limit) {
                return res.status(400).json({ error: `Bạn chỉ có thể mua ${item.weekly_limit} ${item.name}/tuần!` });
            }
        }

        // Deduct cost
        const col = item.cost_type === 'stars' ? 'knowledge_stars' : 'chess_coins';
        await db.query(
            `UPDATE user_currencies SET ${col} = ${col} - ? WHERE user_id = ?`,
            [totalCost, userId]
        );

        // Log transaction
        const [curr] = await db.query(`SELECT ${col} as balance FROM user_currencies WHERE user_id = ?`, [userId]);
        await db.query(
            'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
            [userId, item.cost_type, -totalCost, curr[0]?.balance || 0, 'shop_purchase', `Mua ${item.name} x${quantity}`]
        );

        // Add to inventory (skip for dragon_egg — handle separately)
        if (item.category === 'dragon_egg') {
            // Create egg in dragon_eggs table for hatching
            for (let i = 0; i < quantity; i++) {
                await db.query(
                    'INSERT INTO dragon_eggs (user_id, name, hatch_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
                    [userId, item.name || 'Trứng Rồng']
                );
            }
        } else {
            await db.query(`
                INSERT INTO user_inventory (user_id, item_id, quantity)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE quantity = quantity + ?
            `, [userId, item_id, quantity, quantity]);
        }

        res.json({
            message: item.category === 'dragon_egg'
                ? `🥚 Đã mua ${item.name}! Ấp 24h để nở rồng!`
                : `Đã mua ${item.name} x${quantity}!`,
            cost: totalCost,
            item: item.name
        });
    } catch (err) {
        console.error('Purchase error:', err);
        res.status(500).json({ error: 'Lỗi mua hàng' });
    }
});

/**
 * GET /api/shop/inventory — User's unified inventory (items + eggs + equipment)
 */
router.get('/inventory', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Shop items from user_inventory
        const [items] = await db.query(`
            SELECT ui.quantity, ui.acquired_at, si.id as item_id, si.name, si.description,
                   si.icon_url, si.category, si.cost, si.cost_type
            FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = ? AND ui.quantity > 0
            ORDER BY ui.acquired_at DESC
        `, [userId]);

        // 2. Pending dragon eggs
        const [eggs] = await db.query(
            'SELECT id, name, hatch_at, hatched, created_at FROM dragon_eggs WHERE user_id = ? AND hatched = 0 ORDER BY hatch_at',
            [userId]
        );

        // 3. Unequipped equipment (not assigned to any dragon)
        const [equipment] = await db.query(`
            SELECT ude.id as user_eq_id, de.*
            FROM user_dragon_equipment ude
            JOIN dragon_equipment de ON ude.equipment_id = de.id
            WHERE ude.user_id = ? AND ude.dragon_id IS NULL
            ORDER BY de.rarity DESC, de.name
        `, [userId]);

        res.json({
            inventory: items,
            eggs: eggs.map(e => ({
                ...e,
                ready: new Date(e.hatch_at) <= new Date(),
                time_left: Math.max(0, Math.floor((new Date(e.hatch_at) - new Date()) / 1000))
            })),
            equipment
        });
    } catch (err) {
        console.error('Inventory error:', err);
        res.status(500).json({ error: 'Lỗi lấy kho' });
    }
});

module.exports = router;
