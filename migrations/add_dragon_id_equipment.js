// Migration: Add dragon_id to user_dragon_equipment for per-dragon equipment
const db = require('../config/database');

async function migrate() {
    console.log('Adding dragon_id column to user_dragon_equipment...');

    // Add column if not exists
    try {
        await db.query('ALTER TABLE user_dragon_equipment ADD COLUMN dragon_id INT DEFAULT NULL AFTER user_id');
        console.log('  ✅ Column added');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('  ⚠️ Column already exists');
        } else {
            throw e;
        }
    }

    // Also fix all existing dragons: set current_hp = hp where current_hp is 0 or null
    await db.query('UPDATE user_dragons SET current_hp = hp WHERE current_hp = 0 OR current_hp IS NULL');
    console.log('  ✅ Fixed current_hp for existing dragons');

    console.log('🎉 Migration complete!');
    process.exit(0);
}

migrate().catch(err => { console.error('Migration error:', err); process.exit(1); });
