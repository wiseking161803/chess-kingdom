// Migration: Add tier column to user_dragons and create user_items table for evolution
const db = require('../config/database');

async function migrate() {
    console.log('Adding tier column to user_dragons...');
    try {
        await db.query('ALTER TABLE user_dragons ADD COLUMN tier INT DEFAULT 0 AFTER level');
        console.log('  ✅ tier column added');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('  ⚠️ tier column already exists');
        } else {
            throw e;
        }
    }

    console.log('Creating user_items table...');
    await db.query(`
        CREATE TABLE IF NOT EXISTS user_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            item_type VARCHAR(50) NOT NULL,
            item_name VARCHAR(100) NOT NULL,
            quantity INT DEFAULT 1,
            obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('  ✅ user_items table ready');

    console.log('🎉 Migration complete!');
    process.exit(0);
}

migrate().catch(err => { console.error('Migration error:', err); process.exit(1); });
