/**
 * Database Migration Script
 * Run: node db/migrate.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
    // Connect without database first to create it if needed
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        charset: 'utf8mb4'
    });

    const dbName = process.env.DB_NAME || 'chess_gamification';

    console.log('🔧 Creating database if not exists...');
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);

    console.log('📋 Creating tables...');

    // ============================================
    // USERS & AUTH
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) DEFAULT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'student') DEFAULT 'student',
            status ENUM('active', 'pending', 'suspended') DEFAULT 'pending',
            avatar_url VARCHAR(500) DEFAULT NULL,
            current_rank VARCHAR(100) DEFAULT 'Tân Binh Trí Tuệ',
            rank_level INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // CURRENCIES
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_currencies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            knowledge_stars INT DEFAULT 0,
            chess_coins INT DEFAULT 0,
            total_stars_earned INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS currency_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            currency_type ENUM('stars', 'coins') NOT NULL,
            amount INT NOT NULL,
            balance_after INT NOT NULL,
            source VARCHAR(50) NOT NULL,
            description VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_type (user_id, currency_type),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // CHESS PUZZLES
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS puzzle_sets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT DEFAULT NULL,
            difficulty ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'beginner',
            play_mode ENUM('first', 'second') DEFAULT 'first',
            puzzle_count INT DEFAULT 0,
            pgn_content LONGTEXT NOT NULL,
            created_by INT DEFAULT NULL,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_active (is_active),
            INDEX idx_difficulty (difficulty)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS puzzles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            puzzle_set_id INT NOT NULL,
            puzzle_index INT NOT NULL,
            fen VARCHAR(100) NOT NULL,
            solution_moves TEXT NOT NULL,
            orientation ENUM('white', 'black') DEFAULT 'white',
            tags VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (puzzle_set_id) REFERENCES puzzle_sets(id) ON DELETE CASCADE,
            UNIQUE KEY unique_set_index (puzzle_set_id, puzzle_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS puzzle_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            puzzle_set_id INT NOT NULL,
            puzzle_index INT NOT NULL,
            solved TINYINT(1) DEFAULT 0,
            attempts INT DEFAULT 0,
            hints_used INT DEFAULT 0,
            stars_earned INT DEFAULT 0,
            best_time_seconds INT DEFAULT NULL,
            solved_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (puzzle_set_id) REFERENCES puzzle_sets(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_puzzle (user_id, puzzle_set_id, puzzle_index),
            INDEX idx_user_set (user_id, puzzle_set_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_elo (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            current_elo INT DEFAULT 800,
            peak_elo INT DEFAULT 800,
            puzzles_solved INT DEFAULT 0,
            puzzles_attempted INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // MILESTONES (Glory Mountain)
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS milestones (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(100) NOT NULL,
            description TEXT DEFAULT NULL,
            stars_required INT NOT NULL DEFAULT 0,
            icon VARCHAR(10) DEFAULT '⭐',
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sort (sort_order),
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS milestone_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            milestone_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT DEFAULT NULL,
            url VARCHAR(500) DEFAULT NULL,
            task_type ENUM('external_link', 'puzzle_set', 'manual') DEFAULT 'manual',
            stars_reward INT DEFAULT 0,
            sort_order INT DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
            INDEX idx_milestone (milestone_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_task_completions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            task_id INT NOT NULL,
            task_type VARCHAR(50) NOT NULL DEFAULT 'milestone',
            stars_earned INT DEFAULT 0,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_task (user_id, task_id, task_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS level_up_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            requested_milestone VARCHAR(100) NOT NULL,
            status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP NULL DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // DAILY / WEEKLY QUESTS
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS quest_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('daily', 'weekly') NOT NULL,
            day_of_week TINYINT DEFAULT NULL COMMENT '1=Mon, 7=Sun, NULL for weekly',
            title VARCHAR(200) NOT NULL,
            url VARCHAR(500) DEFAULT NULL,
            stars_reward INT DEFAULT 1,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_type_day (type, day_of_week),
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_quest_completions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            quest_id INT NOT NULL,
            period_key VARCHAR(20) NOT NULL COMMENT 'e.g. 2024-01-15 for daily, 2024-W03 for weekly',
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (quest_id) REFERENCES quest_templates(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_quest_period (user_id, quest_id, period_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // STREAKS
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_streaks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            current_streak INT DEFAULT 0,
            longest_streak INT DEFAULT 0,
            last_active_date DATE DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // LUCKY WHEEL
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS lucky_wheel_prizes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            label VARCHAR(100) NOT NULL,
            prize_type ENUM('coins', 'stars', 'item', 'physical_prize') NOT NULL,
            prize_value VARCHAR(100) NOT NULL,
            rarity ENUM('common', 'rare', 'epic', 'legendary') DEFAULT 'common',
            weight INT DEFAULT 100,
            color VARCHAR(7) DEFAULT '#3498db',
            is_active TINYINT(1) DEFAULT 1,
            sort_order INT DEFAULT 0,
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS lucky_wheel_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            prize_id INT NOT NULL,
            prize_label VARCHAR(100) NOT NULL,
            spun_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // SHOP & INVENTORY
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS shop_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT DEFAULT NULL,
            cost INT NOT NULL DEFAULT 0,
            cost_type ENUM('coins', 'stars') DEFAULT 'coins',
            item_type ENUM('consumable', 'special_item', 'cosmetic') DEFAULT 'consumable',
            icon_url VARCHAR(500) DEFAULT NULL,
            max_quantity INT DEFAULT NULL COMMENT 'NULL = unlimited',
            is_active TINYINT(1) DEFAULT 1,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_inventory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            item_id INT NOT NULL,
            quantity INT DEFAULT 1,
            acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_item (user_id, item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // DRAGON CAVE (Future)
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_dragons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            dragon_name VARCHAR(100) DEFAULT 'Rồng Con',
            dragon_type ENUM('fire', 'ice', 'earth', 'wind') DEFAULT NULL,
            growth_stage ENUM('egg', 'baby', 'teen', 'adult', 'elder') DEFAULT 'egg',
            experience INT DEFAULT 0,
            happiness INT DEFAULT 100,
            last_fed_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_dragon (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // LEADERBOARD CACHE
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS leaderboard_cache (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50) NOT NULL UNIQUE,
            data JSON NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // PUZZLE SESSIONS (Focus/Memory mode tracking)
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS puzzle_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            puzzle_set_id INT NOT NULL,
            mode ENUM('basic','focus','memory','opening') NOT NULL DEFAULT 'basic',
            puzzles_solved INT DEFAULT 0,
            puzzles_failed INT DEFAULT 0,
            total_time_seconds INT DEFAULT 0,
            accuracy FLOAT DEFAULT 0,
            elo_change INT DEFAULT 0,
            ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_mode (user_id, mode)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // OPENING COURSES (Spaced Repetition)
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS opening_courses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT DEFAULT NULL,
            pgn_content LONGTEXT NOT NULL,
            created_by INT DEFAULT NULL,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS opening_lines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_id INT NOT NULL,
            line_index INT NOT NULL,
            moves_json TEXT NOT NULL,
            FOREIGN KEY (course_id) REFERENCES opening_courses(id) ON DELETE CASCADE,
            UNIQUE KEY unique_course_line (course_id, line_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_opening_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            line_id INT NOT NULL,
            ease_factor FLOAT DEFAULT 2.5,
            interval_days INT DEFAULT 0,
            repetitions INT DEFAULT 0,
            next_review DATE DEFAULT NULL,
            last_reviewed_at TIMESTAMP NULL DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (line_id) REFERENCES opening_lines(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_line (user_id, line_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ============================================
    // ALTER EXISTING TABLES
    // ============================================
    console.log('🔧 Altering existing tables...');

    // Add elo_rating to puzzle_sets
    try {
        await conn.query(`ALTER TABLE puzzle_sets ADD COLUMN elo_rating INT DEFAULT NULL`);
        console.log('  ✅ Added elo_rating to puzzle_sets');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // Add elo_rating to individual puzzles (from PGN [Rating] header)
    try {
        await conn.query(`ALTER TABLE puzzles ADD COLUMN elo_rating INT DEFAULT NULL`);
        console.log('  ✅ Added elo_rating to puzzles');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // Add solve_mode to puzzle_sets
    try {
        await conn.query(`ALTER TABLE puzzle_sets ADD COLUMN solve_mode ENUM('basic','focus','memory','opening') DEFAULT 'basic' AFTER play_mode`);
        console.log('  ✅ Added solve_mode to puzzle_sets');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // Add puzzle integration fields to quest_templates
    try {
        await conn.query(`ALTER TABLE quest_templates ADD COLUMN puzzle_set_id INT DEFAULT NULL`);
        console.log('  ✅ Added puzzle_set_id to quest_templates');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    try {
        await conn.query(`ALTER TABLE quest_templates ADD COLUMN coins_reward INT DEFAULT 0`);
        console.log('  ✅ Added coins_reward to quest_templates');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    try {
        await conn.query(`ALTER TABLE quest_templates ADD COLUMN play_mode ENUM('basic','focus','memory','opening') DEFAULT 'basic'`);
        console.log('  ✅ Added play_mode to quest_templates');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // Add puzzle integration fields to milestone_tasks
    try {
        await conn.query(`ALTER TABLE milestone_tasks ADD COLUMN puzzle_set_id INT DEFAULT NULL`);
        console.log('  ✅ Added puzzle_set_id to milestone_tasks');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    try {
        await conn.query(`ALTER TABLE milestone_tasks ADD COLUMN play_mode ENUM('basic','focus','memory','opening') DEFAULT NULL`);
        console.log('  ✅ Added play_mode to milestone_tasks');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // Add task_group to milestone_tasks for 4 categories
    try {
        await conn.query(`ALTER TABLE milestone_tasks ADD COLUMN task_group ENUM('tactics','middlegame','endgame','competition') DEFAULT 'tactics' AFTER milestone_id`);
        console.log('  ✅ Added task_group to milestone_tasks');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // ============================================
    // ELO HISTORY (for charts — 1 record per user per day)
    // ============================================
    await conn.query(`
        CREATE TABLE IF NOT EXISTS elo_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            elo INT NOT NULL DEFAULT 800,
            puzzles_solved INT DEFAULT 0,
            puzzles_attempted INT DEFAULT 0,
            record_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_date (user_id, record_date),
            INDEX idx_user_date (user_id, record_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Created elo_history table');

    // Add theme to puzzle_sets
    try {
        await conn.query(`ALTER TABLE puzzle_sets ADD COLUMN theme VARCHAR(50) DEFAULT NULL`);
        console.log('  ✅ Added theme to puzzle_sets');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    // Story progress tracking
    await conn.query(`
        CREATE TABLE IF NOT EXISTS story_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            chapter_id INT NOT NULL,
            scene_index INT NOT NULL DEFAULT 0,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_chapter_scene (user_id, chapter_id, scene_index),
            INDEX idx_user_chapter (user_id, chapter_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Created story_progress table');

    console.log('✅ All tables created successfully!');
    await conn.end();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
