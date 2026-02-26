require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'chess_gamification',
        charset: 'utf8mb4'
    });

    // 1. Add element column to user_dragons
    try {
        await c.query("ALTER TABLE user_dragons ADD COLUMN element VARCHAR(20) DEFAULT 'fire'");
        console.log('✅ element column added');
    } catch (e) {
        console.log('⏭️ element exists:', e.message.substring(0, 60));
    }

    // 2. Drop unique index on user_id to allow multiple dragons
    try {
        await c.query('ALTER TABLE user_dragons DROP INDEX user_id');
        console.log('✅ unique index on user_id dropped (multi-dragon)');
    } catch (e) {
        console.log('⏭️ no unique index:', e.message.substring(0, 60));
    }

    // 3. Create dragon_formations table
    try {
        await c.query(`
            CREATE TABLE IF NOT EXISTS dragon_formations (
                user_id INT NOT NULL,
                slot INT NOT NULL,
                dragon_id INT NOT NULL,
                position ENUM('front','back') NOT NULL DEFAULT 'front',
                PRIMARY KEY(user_id, slot),
                KEY(dragon_id),
                KEY(user_id)
            )
        `);
        console.log('✅ dragon_formations table created');
    } catch (e) {
        console.log('⏭️ formations:', e.message.substring(0, 60));
    }

    await c.end();
    console.log('Done!');
})();
