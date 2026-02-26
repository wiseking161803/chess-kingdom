/**
 * Dragon Arena Migration Runner
 * Creates arena tables + 20 bot accounts with dragons and formations
 * Run: node migrations/dragon_arena_setup.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const ELEMENTS = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark'];
const ELEMENT_BASE_STATS = {
    metal: { hp: 50, att: 10, def: 8, spd: 4 },
    wood: { hp: 65, att: 8, def: 5, spd: 5 },
    water: { hp: 50, att: 9, def: 5, spd: 8 },
    fire: { hp: 45, att: 14, def: 4, spd: 6 },
    earth: { hp: 60, att: 7, def: 9, spd: 3 },
    light: { hp: 55, att: 11, def: 7, spd: 6 },
    dark: { hp: 55, att: 11, def: 7, spd: 6 }
};
const ELEMENT_GROWTH = {
    metal: { hp: 5, att: 2, def: 2, spd: 0.5 },
    wood: { hp: 7, att: 1.5, def: 1, spd: 1 },
    water: { hp: 5, att: 2, def: 1, spd: 1.5 },
    fire: { hp: 4, att: 3, def: 0.5, spd: 1 },
    earth: { hp: 6, att: 1, def: 2, spd: 0.5 },
    light: { hp: 5, att: 2, def: 1.5, spd: 1 },
    dark: { hp: 5, att: 2, def: 1.5, spd: 1 }
};

// Calculate stats at given level
function statsAtLevel(element, level) {
    const base = ELEMENT_BASE_STATS[element];
    const growth = ELEMENT_GROWTH[element];
    const lvl = level - 1; // growth starts from level 2
    return {
        hp: Math.floor(base.hp + growth.hp * lvl),
        att: Math.floor(base.att + growth.att * lvl),
        def: Math.floor(base.def + growth.def * lvl),
        spd: Math.floor(base.spd + growth.spd * lvl)
    };
}

// Bot config: rank -> level
const BOT_CONFIG = [
    { rank: 1, level: 100, name: 'Rồng Hoàng Đế' },
    { rank: 2, level: 100, name: 'Rồng Thần Thánh' },
    { rank: 3, level: 50, name: 'Rồng Chiến Binh' },
    { rank: 4, level: 50, name: 'Rồng Bão Táp' },
    { rank: 5, level: 50, name: 'Rồng Sấm Sét' },
    { rank: 6, level: 10, name: 'Rồng Thủy Tinh' },
    { rank: 7, level: 10, name: 'Rồng Hỏa Diệm' },
    { rank: 8, level: 10, name: 'Rồng Phong Huyền' },
    { rank: 9, level: 10, name: 'Rồng Thổ Địa' },
    { rank: 10, level: 10, name: 'Rồng Kim Cương' },
    { rank: 11, level: 5, name: 'Rồng Lửa Nhỏ' },
    { rank: 12, level: 5, name: 'Rồng Nước Nhỏ' },
    { rank: 13, level: 5, name: 'Rồng Đất Nhỏ' },
    { rank: 14, level: 5, name: 'Rồng Gió Nhỏ' },
    { rank: 15, level: 5, name: 'Rồng Sao Nhỏ' },
    { rank: 16, level: 1, name: 'Rồng Tập Sự A' },
    { rank: 17, level: 1, name: 'Rồng Tập Sự B' },
    { rank: 18, level: 1, name: 'Rồng Tập Sự C' },
    { rank: 19, level: 1, name: 'Rồng Tập Sự D' },
    { rank: 20, level: 1, name: 'Rồng Tập Sự E' }
];

async function run() {
    try {
        console.log('🏟️ Running Dragon Arena migration...');

        // 1. Run SQL schema
        const sql = fs.readFileSync(path.join(__dirname, 'dragon_arena.sql'), 'utf8');
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        for (const stmt of statements) {
            await db.query(stmt);
        }
        console.log('✅ Arena tables created');

        // 2. Create 20 bot accounts
        for (const bot of BOT_CONFIG) {
            const username = `arena_bot_${bot.rank}`;
            const displayName = `🤖 ${bot.name}`;

            // Check if bot already exists
            const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
            let botUserId;

            if (existing.length > 0) {
                botUserId = existing[0].id;
                console.log(`  ⏭️ Bot ${username} already exists (id=${botUserId})`);
            } else {
                // Create bot user (role = 'bot', status = 'active')
                const [result] = await db.query(
                    `INSERT INTO users (username, password_hash, display_name, role, status)
                     VALUES (?, 'BOT_NO_LOGIN', ?, 'student', 'active')`,
                    [username, displayName]
                );
                botUserId = result.insertId;

                // Create currencies
                await db.query(
                    `INSERT IGNORE INTO user_currencies (user_id, chess_coins, knowledge_stars)
                     VALUES (?, 0, 0)`,
                    [botUserId]
                );

                console.log(`  ✅ Created bot: ${displayName} (id=${botUserId}, Lv.${bot.level})`);
            }

            // Create 5 dragons for bot (if not already)
            const [existingDragons] = await db.query(
                'SELECT COUNT(*) as cnt FROM user_dragons WHERE user_id = ?', [botUserId]
            );

            if (existingDragons[0].cnt < 5) {
                // Delete any partial dragons
                await db.query('DELETE FROM user_dragons WHERE user_id = ?', [botUserId]);
                await db.query('DELETE FROM dragon_formations WHERE user_id = ?', [botUserId]);

                for (let i = 0; i < 5; i++) {
                    const elem = ELEMENTS[i % ELEMENTS.length];
                    const stats = statsAtLevel(elem, bot.level);
                    const dragonName = `${bot.name} ${i + 1}`;

                    const [drResult] = await db.query(
                        `INSERT INTO user_dragons (user_id, name, element, level, exp, hp, att, def_stat, spd,
                         current_hp, crit_rate, crit_dmg, last_regen_at)
                         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 5.0, 150.0, NOW())`,
                        [botUserId, dragonName, elem, bot.level,
                            stats.hp, stats.att, stats.def, stats.spd, stats.hp]
                    );

                    // Set formation: first 2 front, rest back
                    await db.query(
                        `INSERT INTO dragon_formations (user_id, slot, dragon_id, position)
                         VALUES (?, ?, ?, ?)`,
                        [botUserId, i, drResult.insertId, i < 2 ? 'front' : 'back']
                    );
                }
                console.log(`  🐉 Created 5 Lv.${bot.level} dragons for ${displayName}`);
            }

            // Insert or update arena ranking
            await db.query(
                `INSERT INTO dragon_arena_rankings (rank_position, user_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE user_id = IF(
                     (SELECT role FROM users WHERE id = dragon_arena_rankings.user_id) = 'bot',
                     VALUES(user_id),
                     dragon_arena_rankings.user_id
                 )`,
                [bot.rank, botUserId]
            );
        }

        console.log('✅ All 20 bots created with rankings');
        console.log('🏟️ Dragon Arena migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration error:', err);
        process.exit(1);
    }
}

run();
