const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Real-money product catalog
const PRODUCTS = [
    { id: 'membership_month', name: 'Hộ Chiếu Vương Quốc — Tháng', type: 'membership', price: 250000, duration_days: 30, desc: 'Mở khóa toàn bộ khu vực trong 30 ngày' },
    { id: 'membership_year', name: 'Hộ Chiếu Vương Quốc — Năm', type: 'membership', price: 2000000, duration_days: 365, desc: 'Mở khóa toàn bộ khu vực trong 1 năm' },
    { id: 'membership_lifetime', name: 'Hộ Chiếu Vương Quốc — Trọn Đời', type: 'membership', price: 5000000, duration_days: 99999, desc: 'Mở khóa vĩnh viễn toàn bộ khu vực' },
    { id: 'card_basic', name: 'Thẻ Hiệp Sĩ', type: 'monthly_card', price: 50000, daily_coins: 5000, daily_tickets: 1, duration_days: 30, desc: '5.000 xu + 1 phiếu bé ngoan mỗi ngày × 30 ngày' },
    { id: 'card_premium', name: 'Thẻ Đại Hiệp', type: 'monthly_card', price: 200000, daily_coins: 20000, daily_tickets: 5, duration_days: 30, desc: '20.000 xu + 5 phiếu bé ngoan mỗi ngày × 30 ngày' },
    { id: 'coins_100k', name: 'Túi Xu Bạc', type: 'coins', price: 100000, coins: 100000, desc: '100.000 xu' },
    { id: 'coins_500k', name: 'Túi Xu Vàng', type: 'coins', price: 500000, coins: 600000, desc: '600.000 xu (bonus +20%)' },
    { id: 'coins_1m', name: 'Rương Xu Hoàng Kim', type: 'coins', price: 1000000, coins: 1500000, desc: '1.500.000 xu (bonus +50%)' },
    { id: 'coins_2m', name: 'Kho Báu Rồng Thần', type: 'coins', price: 2000000, coins: 5000000, desc: '5.000.000 xu (bonus +150%)' }
];

/**
 * GET /api/payment/products — List real-money products
 */
router.get('/products', authenticate, (req, res) => {
    res.json({ products: PRODUCTS });
});

/**
 * POST /api/payment/create-order — Create a payment order
 */
router.post('/create-order', authenticate, async (req, res) => {
    try {
        const { product_id } = req.body;
        const product = PRODUCTS.find(p => p.id === product_id);
        if (!product) return res.status(400).json({ error: 'Sản phẩm không hợp lệ' });

        const [result] = await db.query(
            'INSERT INTO payment_orders (user_id, product_type, product_name, amount_vnd) VALUES (?, ?, ?, ?)',
            [req.user.id, product.id, product.name, product.price]
        );

        res.json({
            order_id: result.insertId,
            product,
            message: `Đơn hàng #${result.insertId} — ${product.name} (${product.price.toLocaleString()}đ)`
        });
    } catch (err) {
        console.error('Order error:', err);
        res.status(500).json({ error: 'Lỗi tạo đơn hàng' });
    }
});

/**
 * GET /api/payment/my-orders — User's order history
 */
router.get('/my-orders', authenticate, async (req, res) => {
    try {
        const [orders] = await db.query(
            'SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        res.json({ orders });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy đơn hàng' });
    }
});

/**
 * GET /api/payment/pending — Admin: list pending orders
 */
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT po.*, u.display_name, u.username
            FROM payment_orders po
            JOIN users u ON po.user_id = u.id
            WHERE po.status = 'pending'
            ORDER BY po.created_at DESC
        `);
        res.json({ orders });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy đơn hàng' });
    }
});

/**
 * PUT /api/payment/:id/confirm — Admin: confirm a payment
 */
router.put('/:id/confirm', authenticate, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const [orders] = await db.query('SELECT * FROM payment_orders WHERE id = ? AND status = ?', [orderId, 'pending']);
        if (orders.length === 0) return res.status(400).json({ error: 'Đơn hàng không hợp lệ' });

        const order = orders[0];
        const product = PRODUCTS.find(p => p.id === order.product_type);
        if (!product) return res.status(400).json({ error: 'Sản phẩm không tìm thấy' });

        // Deliver rewards based on product type
        if (product.type === 'membership') {
            await db.query(
                `UPDATE users SET membership_type = 'premium', membership_expires_at = DATE_ADD(IFNULL(membership_expires_at, NOW()), INTERVAL ? DAY) WHERE id = ?`,
                [product.duration_days, order.user_id]
            );
        } else if (product.type === 'monthly_card') {
            await db.query(
                'INSERT INTO monthly_cards (user_id, card_type, daily_coins, daily_tickets, days_remaining, expires_at) VALUES (?, ?, ?, ?, 30, DATE_ADD(NOW(), INTERVAL 30 DAY))',
                [order.user_id, product.id, product.daily_coins, product.daily_tickets]
            );
        } else if (product.type === 'coins') {
            await db.query('UPDATE user_currencies SET chess_coins = chess_coins + ? WHERE user_id = ?', [product.coins, order.user_id]);
        }

        // Update order status
        await db.query(
            'UPDATE payment_orders SET status = ?, confirmed_by = ?, confirmed_at = NOW() WHERE id = ?',
            ['confirmed', req.user.id, orderId]
        );

        res.json({ message: `✅ Đã xác nhận đơn #${orderId} — ${product.name}` });
    } catch (err) {
        console.error('Confirm error:', err);
        res.status(500).json({ error: 'Lỗi xác nhận' });
    }
});

/**
 * PUT /api/payment/:id/reject — Admin: reject a payment
 */
router.put('/:id/reject', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE payment_orders SET status = ? WHERE id = ? AND status = ?', ['rejected', req.params.id, 'pending']);
        res.json({ message: `❌ Đã từ chối đơn #${req.params.id}` });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi từ chối' });
    }
});

/**
 * GET /api/payment/check-membership — Check user membership status
 */
router.get('/check-membership', authenticate, async (req, res) => {
    try {
        const [users] = await db.query('SELECT membership_type, membership_expires_at FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];
        const isPremium = user.membership_type === 'premium' && (
            !user.membership_expires_at || new Date(user.membership_expires_at) > new Date()
        );
        res.json({ is_premium: isPremium, membership_type: user.membership_type, expires_at: user.membership_expires_at });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi kiểm tra membership' });
    }
});

module.exports = router;
module.exports.PRODUCTS = PRODUCTS;
