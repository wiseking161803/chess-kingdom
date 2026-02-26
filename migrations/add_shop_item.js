const db = require('../config/database');

(async () => {
    try {
        // Add category column to shop_items if not exists
        try {
            await db.query("ALTER TABLE shop_items ADD COLUMN category VARCHAR(50) DEFAULT NULL AFTER item_type");
            console.log('  ✅ Added category column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('  ⚠️ category column already exists');
            else throw e;
        }

        // Add daily_limit and weekly_limit if not exists
        try { await db.query("ALTER TABLE shop_items ADD COLUMN daily_limit INT DEFAULT NULL"); } catch (e) { /* ignore */ }
        try { await db.query("ALTER TABLE shop_items ADD COLUMN weekly_limit INT DEFAULT NULL"); } catch (e) { /* ignore */ }

        // Insert Ngọc Thăng Thiên
        await db.query(`
            INSERT INTO shop_items (name, description, cost, cost_type, item_type, category, icon_url, is_active, sort_order)
            VALUES ('Ngọc Thăng Thiên', 'Vật phẩm thăng cấp rồng. Cần rồng Lv.100 + 1 rồng cùng hệ để thăng cấp!', 500000, 'coins', 'special_item', 'dragon_evolve', '💎', 1, 100)
        `);
        console.log('✅ Ngọc Thăng Thiên added to shop!');
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
})();
