require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Railway runs behind a reverse proxy
app.set('trust proxy', 1);

// Process-level error handlers — prevent crashes
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT]', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason?.message || reason);
});

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const solveLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Quá nhiều request, vui lòng thử lại sau.' }
});
const spinLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Quá nhiều lượt quay, vui lòng thử lại sau.' }
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/puzzles', solveLimiter, require('./routes/puzzles'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/quests', require('./routes/quests'));
app.use('/api/wheel', spinLimiter, require('./routes/wheel'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/dragon', require('./routes/dragon'));
app.use('/api/world', require('./routes/world'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/arena', require('./routes/arena'));
app.use('/api/garden', require('./routes/garden'));
app.use('/api/achievements', require('./routes/achievements'));

// World map page
app.get('/world', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'world.html'));
});

// SPA fallback
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Railway sets PORT automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏰 Chess Training App running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);

    // Daily reward cron — 6:00 AM UTC+7
    try {
        const cron = require('node-cron');
        const { distributeArenaRewards } = require('./routes/arena');

        // 23:00 UTC = 6:00 AM UTC+7
        cron.schedule('0 23 * * *', () => {
            console.log('🏟️ Running daily arena reward distribution (6:00 AM UTC+7)...');
            distributeArenaRewards();
        });

        console.log('🏟️ Daily reward cron scheduled (6:00 AM UTC+7 = 23:00 UTC)');
    } catch (e) {
        console.log('⚠️ node-cron not available, rewards won\'t auto-distribute');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down...');
    process.exit(0);
});
