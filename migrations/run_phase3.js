require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'chess_gamification'
    });

    // 1. Dragon eggs table
    try {
        await c.query(`CREATE TABLE IF NOT EXISTS dragon_eggs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(100) DEFAULT 'Trứng Rồng',
            hatch_at DATETIME NOT NULL,
            hatched TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY(user_id)
        )`);
        console.log('✅ dragon_eggs table');
    } catch (e) { console.log('eggs:', e.message.substring(0, 60)); }

    // 2. Payment orders table
    try {
        await c.query(`CREATE TABLE IF NOT EXISTS payment_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            product_type VARCHAR(50) NOT NULL,
            product_name VARCHAR(200),
            amount_vnd INT NOT NULL,
            status ENUM('pending','confirmed','rejected') DEFAULT 'pending',
            confirmed_by INT NULL,
            confirmed_at DATETIME NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY(user_id),
            KEY(status)
        )`);
        console.log('✅ payment_orders table');
    } catch (e) { console.log('payments:', e.message.substring(0, 60)); }

    // 3. Add membership columns to users
    try {
        await c.query("ALTER TABLE users ADD COLUMN membership_type VARCHAR(50) DEFAULT 'free'");
        console.log('✅ membership_type column');
    } catch (e) { console.log('membership:', e.message.substring(0, 60)); }

    try {
        await c.query("ALTER TABLE users ADD COLUMN membership_expires_at DATETIME NULL");
        console.log('✅ membership_expires_at column');
    } catch (e) { console.log('expires:', e.message.substring(0, 60)); }

    // 4. Monthly cards table
    try {
        await c.query(`CREATE TABLE IF NOT EXISTS monthly_cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            card_type VARCHAR(50),
            days_remaining INT DEFAULT 30,
            daily_coins INT DEFAULT 0,
            daily_tickets INT DEFAULT 0,
            last_claimed DATE NULL,
            expires_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY(user_id)
        )`);
        console.log('✅ monthly_cards table');
    } catch (e) { console.log('cards:', e.message.substring(0, 60)); }

    // 5. Insert shop items: Dragon Egg + Instant Hatch
    try {
        // Check if egg item already exists
        const [existing] = await c.query("SELECT id FROM shop_items WHERE name = 'Trứng Rồng Thần'");
        if (existing.length === 0) {
            await c.query(`INSERT INTO shop_items (name, description, cost, cost_type, category, icon_url, is_active, sort_order) VALUES 
                ('Trứng Rồng Thần', 'Trứng rồng huyền bí — ấp 24h để nở thành rồng nguyên tố ngẫu nhiên!', 1000000, 'coins', 'dragon_egg', '🥚', 1, 100),
                ('Lửa Phượng Hoàng', 'Ngọn lửa thần — ấp trứng rồng nở NGAY LẬP TỨC!', 500000, 'coins', 'dragon_special', '🔥', 1, 101)
            `);
            console.log('✅ shop items: Trứng Rồng + Lửa Phượng Hoàng');
        } else {
            console.log('⏭️ shop items already exist');
        }
    } catch (e) { console.log('shop items:', e.message.substring(0, 60)); }

    await c.end();
    console.log('Done!');
})();
