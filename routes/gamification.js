const express = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/gamification/stats — Get current user stats
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [currencies] = await db.query('SELECT * FROM user_currencies WHERE user_id = ?', [userId]);
        const [elo] = await db.query('SELECT * FROM user_elo WHERE user_id = ?', [userId]);
        const [streak] = await db.query('SELECT * FROM user_streaks WHERE user_id = ?', [userId]);
        const [user] = await db.query('SELECT current_rank, rank_level FROM users WHERE id = ?', [userId]);

        res.json({
            knowledge_stars: currencies[0]?.knowledge_stars || 0,
            chess_coins: currencies[0]?.chess_coins || 0,
            total_stars_earned: currencies[0]?.total_stars_earned || 0,
            current_elo: elo[0]?.current_elo || 800,
            peak_elo: elo[0]?.peak_elo || 800,
            puzzles_solved: elo[0]?.puzzles_solved || 0,
            current_rank: user[0]?.current_rank || 'Tân Binh Trí Tuệ',
            rank_level: user[0]?.rank_level || 0,
            current_streak: streak[0]?.current_streak || 0,
            longest_streak: streak[0]?.longest_streak || 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy thống kê' });
    }
});

/**
 * GET /api/gamification/stats/chart — Chart data for student dashboard
 */
router.get('/stats/chart', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [eloHistory] = await db.query(
            'SELECT elo, puzzles_solved, puzzles_attempted, record_date FROM elo_history WHERE user_id = ? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY record_date ASC',
            [userId]
        );
        const [dailyPuzzles] = await db.query(`
            SELECT DATE(solved_at) as day, COUNT(*) as solved, SUM(attempts) as attempts
            FROM puzzle_progress
            WHERE user_id = ? AND solved = 1 AND solved_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(solved_at) ORDER BY day ASC
        `, [userId]);
        const [accuracy] = await db.query(
            'SELECT puzzles_solved, puzzles_attempted FROM user_elo WHERE user_id = ?', [userId]
        );
        const [activeDays] = await db.query(`
            SELECT DISTINCT DATE(solved_at) as day FROM puzzle_progress
            WHERE user_id = ? AND solved = 1 AND solved_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY day ASC
        `, [userId]);
        const [streak] = await db.query('SELECT * FROM user_streaks WHERE user_id = ?', [userId]);
        res.json({
            elo_history: eloHistory,
            daily_puzzles: dailyPuzzles,
            accuracy: { solved: accuracy[0]?.puzzles_solved || 0, attempted: accuracy[0]?.puzzles_attempted || 0 },
            active_days: activeDays.map(d => d.day),
            streak: { current: streak[0]?.current_streak || 0, longest: streak[0]?.longest_streak || 0 }
        });
    } catch (err) {
        console.error('Chart data error:', err);
        res.status(500).json({ error: 'Error fetching chart data' });
    }
});

/**
 * GET /api/gamification/milestones — All milestones with user progress
 */
router.get('/milestones', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [milestones] = await db.query(
            'SELECT * FROM milestones WHERE is_active = 1 ORDER BY sort_order ASC'
        );

        const [currencies] = await db.query(
            'SELECT knowledge_stars FROM user_currencies WHERE user_id = ?',
            [userId]
        );
        const userStars = currencies[0]?.knowledge_stars || 0;

        const [user] = await db.query(
            'SELECT rank_level FROM users WHERE id = ?',
            [userId]
        );
        const userRankLevel = user[0]?.rank_level || 0;

        const enrichedMilestones = milestones.map((m, idx) => {
            const prevStars = idx > 0 ? milestones[idx - 1].stars_required : 0;
            let progress = 0;
            if (userStars >= m.stars_required) {
                progress = 100;
            } else if (m.stars_required > prevStars) {
                progress = Math.max(0, Math.min(100, ((userStars - prevStars) / (m.stars_required - prevStars)) * 100));
            }

            let status = 'locked';
            if (m.sort_order < userRankLevel) status = 'completed';
            else if (m.sort_order === userRankLevel) status = 'current';

            return { ...m, progress: Math.round(progress), status };
        });

        res.json({
            milestones: enrichedMilestones,
            user_stars: userStars,
            user_rank_level: userRankLevel
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy milestones' });
    }
});

/**
 * GET /api/gamification/milestones/:id/tasks — Tasks for a milestone
 */
router.get('/milestones/:id/tasks', authenticate, async (req, res) => {
    try {
        const [tasks] = await db.query(
            'SELECT * FROM milestone_tasks WHERE milestone_id = ? AND is_active = 1 ORDER BY task_group, sort_order',
            [req.params.id]
        );

        // Get user completions
        const taskIds = tasks.map(t => t.id);
        let completions = [];
        if (taskIds.length > 0) {
            const placeholders = taskIds.map(() => '?').join(',');
            const [rows] = await db.query(
                `SELECT task_id FROM user_task_completions WHERE user_id = ? AND task_type = 'milestone' AND task_id IN (${placeholders})`,
                [req.user.id, ...taskIds]
            );
            completions = rows.map(r => r.task_id);
        }

        const enrichedTasks = tasks.map(t => ({
            ...t,
            completed: completions.includes(t.id)
        }));

        // Group by task_group
        const groups = { tactics: [], middlegame: [], endgame: [], competition: [] };
        enrichedTasks.forEach(t => {
            const g = t.task_group || 'tactics';
            if (groups[g]) groups[g].push(t);
            else groups.tactics.push(t);
        });

        const groupStats = {};
        for (const [key, list] of Object.entries(groups)) {
            groupStats[key] = { total: list.length, completed: list.filter(t => t.completed).length };
        }

        res.json({ tasks: enrichedTasks, groups, groupStats });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy nhiệm vụ' });
    }
});

/**
 * POST /api/gamification/milestones/:taskId/complete — Complete a milestone task
 */
router.post('/milestones/:taskId/complete', authenticate, async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user.id;

        const [tasks] = await db.query('SELECT * FROM milestone_tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
        }

        const task = tasks[0];

        // Check if already completed
        const [existing] = await db.query(
            'SELECT id FROM user_task_completions WHERE user_id = ? AND task_id = ? AND task_type = ?',
            [userId, taskId, 'milestone']
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Nhiệm vụ đã hoàn thành' });
        }

        // Mark complete
        await db.query(
            'INSERT INTO user_task_completions (user_id, task_id, task_type, stars_earned) VALUES (?,?,?,?)',
            [userId, taskId, 'milestone', task.stars_reward || 0]
        );

        // Award stars
        if (task.stars_reward > 0) {
            await db.query(
                'UPDATE user_currencies SET knowledge_stars = knowledge_stars + ?, total_stars_earned = total_stars_earned + ? WHERE user_id = ?',
                [task.stars_reward, task.stars_reward, userId]
            );

            const [curr] = await db.query('SELECT knowledge_stars FROM user_currencies WHERE user_id = ?', [userId]);
            await db.query(
                'INSERT INTO currency_transactions (user_id, currency_type, amount, balance_after, source, description) VALUES (?,?,?,?,?,?)',
                [userId, 'stars', task.stars_reward, curr[0]?.knowledge_stars || 0, 'milestone_task', task.title]
            );
        }

        res.json({
            message: `Hoàn thành: ${task.title}`,
            stars_earned: task.stars_reward
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi hoàn thành nhiệm vụ' });
    }
});

/**
 * POST /api/gamification/request-levelup — Request rank up
 */
router.post('/request-levelup', authenticate, async (req, res) => {
    try {
        const { milestone_title } = req.body;
        const userId = req.user.id;

        // Check if already pending
        const [existing] = await db.query(
            'SELECT id FROM level_up_requests WHERE user_id = ? AND status = ?',
            [userId, 'pending']
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Bạn đã có yêu cầu đang chờ xử lý' });
        }

        await db.query(
            'INSERT INTO level_up_requests (user_id, requested_milestone) VALUES (?,?)',
            [userId, milestone_title]
        );

        res.json({ message: 'Yêu cầu thăng cấp đã được gửi! Vui lòng chờ admin phê duyệt.' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi gửi yêu cầu' });
    }
});

// ============================================
// ADMIN MILESTONE CRUD
// ============================================

/**
 * POST /api/gamification/admin/milestones — Create milestone
 */
router.post('/admin/milestones', authenticate, requireAdmin, async (req, res) => {
    try {
        const { title, description, stars_required, icon, sort_order } = req.body;

        const [result] = await db.query(
            'INSERT INTO milestones (title, description, stars_required, icon, sort_order) VALUES (?,?,?,?,?)',
            [title, description, stars_required || 0, icon || '⭐', sort_order || 0]
        );

        res.status(201).json({ message: 'Đã tạo milestone', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tạo milestone' });
    }
});

/**
 * PUT /api/gamification/admin/milestones/:id — Update milestone
 */
router.put('/admin/milestones/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { title, description, stars_required, icon, sort_order } = req.body;

        await db.query(
            'UPDATE milestones SET title = ?, description = ?, stars_required = ?, icon = ?, sort_order = ? WHERE id = ?',
            [title, description, stars_required, icon, sort_order, req.params.id]
        );

        res.json({ message: 'Đã cập nhật milestone' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật' });
    }
});

/**
 * DELETE /api/gamification/admin/milestones/:id
 */
router.delete('/admin/milestones/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE milestones SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Đã xóa milestone' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa' });
    }
});

// MILESTONE TASKS CRUD
router.post('/admin/milestones/:milestoneId/tasks', authenticate, requireAdmin, async (req, res) => {
    try {
        const { title, description, url, task_type, stars_reward, sort_order, puzzle_set_id, play_mode, task_group } = req.body;

        const [result] = await db.query(
            'INSERT INTO milestone_tasks (milestone_id, task_group, title, description, url, task_type, stars_reward, sort_order, puzzle_set_id, play_mode) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [req.params.milestoneId, task_group || 'tactics', title, description, url, task_type || 'manual', stars_reward || 0, sort_order || 0, puzzle_set_id || null, play_mode || null]
        );

        res.status(201).json({ message: 'Đã tạo nhiệm vụ', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tạo nhiệm vụ' });
    }
});

router.put('/admin/tasks/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { title, description, url, task_type, stars_reward, sort_order, puzzle_set_id, play_mode, task_group } = req.body;

        await db.query(
            'UPDATE milestone_tasks SET task_group = ?, title = ?, description = ?, url = ?, task_type = ?, stars_reward = ?, sort_order = ?, puzzle_set_id = ?, play_mode = ? WHERE id = ?',
            [task_group || 'tactics', title, description, url, task_type, stars_reward, sort_order, puzzle_set_id || null, play_mode || null, req.params.id]
        );

        res.json({ message: 'Đã cập nhật nhiệm vụ' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật' });
    }
});

router.delete('/admin/tasks/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE milestone_tasks SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Đã xóa nhiệm vụ' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa' });
    }
});

module.exports = router;
