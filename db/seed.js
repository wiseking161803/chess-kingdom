/**
 * Database Seed Script
 * Run: node db/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'chess_gamification',
        charset: 'utf8mb4'
    });

    console.log('🌱 Seeding database...');

    // ============================================
    // Admin user
    // ============================================
    const adminPassword = await bcrypt.hash('admin123', 10);
    await conn.execute(`
        INSERT IGNORE INTO users (username, display_name, email, password_hash, role, status)
        VALUES ('admin', 'Quản Trị Viên', 'admin@chess.vn', ?, 'admin', 'active')
    `, [adminPassword]);

    // Create currencies for admin
    const [adminRows] = await conn.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    if (adminRows.length > 0) {
        await conn.execute(`INSERT IGNORE INTO user_currencies (user_id) VALUES (?)`, [adminRows[0].id]);
        await conn.execute(`INSERT IGNORE INTO user_elo (user_id) VALUES (?)`, [adminRows[0].id]);
        await conn.execute(`INSERT IGNORE INTO user_streaks (user_id) VALUES (?)`, [adminRows[0].id]);
    }

    // ============================================
    // Demo students
    // ============================================
    const studentPassword = await bcrypt.hash('student123', 10);
    const demoStudents = [
        ['hocvien1', 'Nguyễn Văn An', 'an@chess.vn'],
        ['hocvien2', 'Trần Thị Bích', 'bich@chess.vn'],
        ['hocvien3', 'Lê Minh Cường', 'cuong@chess.vn'],
    ];
    for (const [username, name, email] of demoStudents) {
        await conn.execute(`
            INSERT IGNORE INTO users (username, display_name, email, password_hash, role, status)
            VALUES (?, ?, ?, ?, 'student', 'active')
        `, [username, name, email, studentPassword]);

        const [rows] = await conn.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            await conn.execute(`INSERT IGNORE INTO user_currencies (user_id) VALUES (?)`, [rows[0].id]);
            await conn.execute(`INSERT IGNORE INTO user_elo (user_id) VALUES (?)`, [rows[0].id]);
            await conn.execute(`INSERT IGNORE INTO user_streaks (user_id) VALUES (?)`, [rows[0].id]);
        }
    }

    // ============================================
    // Milestones (Glory Mountain)
    // ============================================
    const milestones = [
        ['Tân Binh Trí Tuệ', 'Bắt đầu hành trình chinh phục cờ vua!', 0, '🌱', 0],
        ['Kỵ Sĩ Tập Sự', 'Đã chứng minh được sự kiên nhẫn đầu tiên.', 100, '🐴', 1],
        ['Chiến Binh Bàn Cờ', 'Biết cách tấn công và phòng thủ cơ bản.', 300, '⚔️', 2],
        ['Pháo Đài Vững Chắc', 'Xây dựng nền tảng vững chắc trong cờ vua.', 600, '🏰', 3],
        ['Mưu Sĩ Thông Minh', 'Bắt đầu suy nghĩ chiến lược sâu hơn.', 1000, '🧠', 4],
        ['Tướng Quân Dũng Mãnh', 'Chỉ huy quân cờ với sự tự tin.', 1500, '👑', 5],
        ['Đại Kiện Tướng Nhí', 'Đỉnh cao của sự rèn luyện!', 2500, '🏆', 6],
        ['Huyền Thoại Cờ Vua', 'Trở thành truyền thuyết cho thế hệ sau.', 4000, '🌟', 7],
        ['Vua Cờ Bất Bại', 'Không ai có thể ngăn cản bạn!', 6000, '👸', 8],
        ['Thần Cờ Vũ Trụ', 'Cấp bậc tối thượng — bậc thầy vĩ đại!', 10000, '🐉', 9],
    ];

    for (const [title, desc, stars, icon, order] of milestones) {
        await conn.execute(`
            INSERT IGNORE INTO milestones (title, description, stars_required, icon, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `, [title, desc, stars, icon, order]);
    }

    // ============================================
    // Lucky Wheel Prizes
    // ============================================
    const prizes = [
        ['1 Xu Cờ', 'coins', '1', 'common', 300, '#3498db'],
        ['5 Xu Cờ', 'coins', '5', 'common', 250, '#2ecc71'],
        ['Một Ly Nước Mía', 'physical_prize', 'sugarcane_juice', 'common', 150, '#f39c12'],
        ['Một Ly Trà Tắc', 'physical_prize', 'kumquat_tea', 'common', 120, '#e67e22'],
        ['20 Xu Cờ', 'coins', '20', 'rare', 80, '#9b59b6'],
        ['Một Ly Trà Sữa', 'physical_prize', 'bubble_tea', 'rare', 50, '#e74c3c'],
        ['Một Chú Gấu Bông', 'physical_prize', 'stuffed_bear', 'epic', 30, '#f1c40f'],
        ['100 Xu Cờ', 'coins', '100', 'epic', 15, '#1abc9c'],
        ['Bàn Phím Cơ', 'physical_prize', 'keyboard', 'legendary', 4, '#e74c3c'],
        ['Chuyến Du Lịch VN', 'physical_prize', 'travel_voucher', 'legendary', 1, '#f1c40f'],
    ];

    for (const [label, type, value, rarity, weight, color] of prizes) {
        await conn.execute(`
            INSERT IGNORE INTO lucky_wheel_prizes (label, prize_type, prize_value, rarity, weight, color)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [label, type, value, rarity, weight, color]);
    }

    // ============================================
    // Shop Items
    // ============================================
    const shopItems = [
        ['Trứng Rồng Huyền Thoại', 'Một quả trứng rồng cổ đại, không biết sẽ nở ra điều gì.', 1000, 'coins', 'special_item', '🥚'],
        ['Thức Ăn cho Rồng', 'Nguồn dinh dưỡng cần thiết để chú rồng lớn nhanh.', 2, 'coins', 'consumable', '🍖'],
        ['Nước Uống cho Rồng', 'Nước suối thần kỳ giúp rồng giải khát.', 1, 'coins', 'consumable', '🧊'],
        ['Đồ Chơi cho Rồng', 'Một món đồ chơi yêu thích giúp rồng giải trí.', 5, 'coins', 'consumable', '🎾'],
        ['Thẻ Miễn Bị Phạt', 'Sử dụng để được miễn một lần bị phạt.', 10, 'coins', 'consumable', '🛡️'],
        ['Lò Ấp Trứng Rồng', 'Thiết bị cần thiết để ấp Trứng Rồng Huyền Thoại.', 50, 'coins', 'special_item', '🔥'],
        ['Tinh Chất Hỏa Long', 'Truyền năng lượng lửa để nở ra Hỏa Long.', 25, 'coins', 'consumable', '🌋'],
        ['Tinh Chất Băng Long', 'Truyền năng lượng băng để nở ra Băng Long.', 25, 'coins', 'consumable', '❄️'],
    ];

    for (const [name, desc, cost, costType, itemType, icon] of shopItems) {
        await conn.execute(`
            INSERT IGNORE INTO shop_items (name, description, cost, cost_type, item_type, icon_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, desc, cost, costType, itemType, icon]);
    }

    // ============================================
    // Sample Daily Quests
    // ============================================
    const dailyQuests = [
        [1, 'Giải 5 bài tập chiến thuật', 2],
        [2, 'Xem 1 video bài giảng', 1],
        [3, 'Chơi 3 ván cờ nhanh', 3],
        [4, 'Ôn lại các đòn phối hợp', 2],
        [5, 'Phân tích 1 ván cờ kinh điển', 2],
        [6, 'Giải 10 bài tập tàn cuộc', 3],
    ];

    for (const [day, title, reward] of dailyQuests) {
        await conn.execute(`
            INSERT IGNORE INTO quest_templates (type, day_of_week, title, stars_reward, is_active)
            VALUES ('daily', ?, ?, ?, 1)
        `, [day, title, reward]);
    }

    // Sample Weekly Quest
    await conn.execute(`
        INSERT IGNORE INTO quest_templates (type, day_of_week, title, stars_reward, is_active)
        VALUES ('weekly', NULL, 'Hoàn thành tất cả nhiệm vụ ngày trong tuần', 10, 1)
    `);

    console.log('✅ Seeding completed!');
    console.log('');
    console.log('📌 Login credentials:');
    console.log('   Admin:   admin / admin123');
    console.log('   Student: hocvien1 / student123');
    console.log('');

    await conn.end();
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
