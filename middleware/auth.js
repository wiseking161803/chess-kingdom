const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Authenticate user via JWT token (from cookie or Authorization header)
 */
async function authenticate(req, res, next) {
    try {
        let token = req.cookies?.token;

        // Fallback to Authorization header
        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                token = parts[1];
            }
        }

        if (!token) {
            return res.status(401).json({ error: 'Chưa đăng nhập' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch fresh user data
        const [rows] = await db.execute(
            'SELECT id, username, display_name, email, role, status, avatar_url FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }

        const user = rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Tài khoản chưa được kích hoạt' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
        }
        return res.status(401).json({ error: 'Token không hợp lệ' });
    }
}

/**
 * Require admin role
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập' });
    }
    next();
}

/**
 * Optional auth — sets req.user if token exists, but doesn't block
 */
async function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.token;
        if (!token && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                token = parts[1];
            }
        }
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [rows] = await db.execute(
                'SELECT id, username, display_name, email, role, status, avatar_url FROM users WHERE id = ? AND status = ?',
                [decoded.userId, 'active']
            );
            if (rows.length > 0) {
                req.user = rows[0];
            }
        }
    } catch (err) {
        // Ignore — optional auth
    }
    next();
}

module.exports = { authenticate, requireAdmin, optionalAuth };
