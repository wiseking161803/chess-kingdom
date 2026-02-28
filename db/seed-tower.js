/**
 * Seed 18-floor Tower milestones
 * Run: node db/seed-tower.js
 */
const db = require('../config/database');

const FLOORS = [
    { sort: 0, title: 'Tân Binh Trí Tuệ', icon: '🌱', stars: 0, desc: 'Bước đầu tiên trên hành trình trở thành Kỳ Vương!' },
    { sort: 1, title: 'Học Viên Kiên Nhẫn', icon: '📚', stars: 100, desc: 'Kiên nhẫn là nền tảng của mọi chiến thắng.' },
    { sort: 2, title: 'Kỵ Sĩ Tập Sự', icon: '🐴', stars: 300, desc: 'Đã bắt đầu hiểu cách di chuyển quân cờ.' },
    { sort: 3, title: 'Chiến Binh Bàn Cờ', icon: '⚔️', stars: 600, desc: 'Sẵn sàng chiến đấu trên bàn cờ.' },
    { sort: 4, title: 'Pháo Thủ Chiến Thuật', icon: '🎯', stars: 1200, desc: 'Nắm vững các chiến thuật cơ bản.' },
    { sort: 5, title: 'Tượng Sĩ Trung Cuộc', icon: '🛡️', stars: 2000, desc: 'Hiểu sâu về trung cuộc và phối hợp quân.' },
    { sort: 6, title: 'Xe Chiến Tàn Cuộc', icon: '🏰', stars: 3500, desc: 'Thành thạo các kỹ thuật tàn cuộc.' },
    { sort: 7, title: 'Hậu Vệ Phòng Thủ', icon: '🔒', stars: 5500, desc: 'Phòng thủ vững chắc, không thể phá vỡ.' },
    { sort: 8, title: 'Kỳ Thủ Thông Minh', icon: '🧠', stars: 8000, desc: 'Tư duy chiến lược vượt trội.' },
    { sort: 9, title: 'Chiến Lược Gia', icon: '📐', stars: 12000, desc: 'Hoạch định chiến lược toàn diện.' },
    { sort: 10, title: 'Sư Phụ Khai Cuộc', icon: '📖', stars: 17000, desc: 'Nắm vững mọi hệ thống khai cuộc.' },
    { sort: 11, title: 'Bậc Thầy Chiến Thuật', icon: '🔥', stars: 23000, desc: 'Chiến thuật đạt đến tầm nghệ thuật.' },
    { sort: 12, title: 'Đại Kiện Tướng Nhí', icon: '🏅', stars: 32000, desc: 'Trình độ vượt xa đồng trang lứa.' },
    { sort: 13, title: 'Huyền Thoại Bàn Cờ', icon: '⚡', stars: 43000, desc: 'Tên tuổi vang danh trên bàn cờ.' },
    { sort: 14, title: 'Vương Giả Trí Tuệ', icon: '💎', stars: 56000, desc: 'Trí tuệ tỏa sáng rực rỡ.' },
    { sort: 15, title: 'Thiên Tài Cờ Vua', icon: '🌟', stars: 72000, desc: 'Thiên phú cờ vua phi thường.' },
    { sort: 16, title: 'Bất Bại Kỳ Vương', icon: '🦁', stars: 88000, desc: 'Không ai có thể đánh bại.' },
    { sort: 17, title: 'Đại Đế Kỳ Vương', icon: '👑', stars: 100000, desc: 'Đỉnh cao tuyệt đối — Đại Đế Kỳ Vương!' }
];

async function seedTower() {
    console.log('🏰 Seeding 18-floor tower...');

    // Deactivate all existing milestones
    await db.query('UPDATE milestones SET is_active = 0');
    console.log('  ↳ Deactivated old milestones');

    // Insert 18 new milestones
    for (const f of FLOORS) {
        const [existing] = await db.query(
            'SELECT id FROM milestones WHERE sort_order = ? AND is_active = 0',
            [f.sort]
        );

        if (existing.length > 0) {
            // Re-activate and update existing
            await db.query(
                'UPDATE milestones SET title = ?, description = ?, stars_required = ?, icon = ?, is_active = 1 WHERE id = ?',
                [f.title, f.desc, f.stars, f.icon, existing[0].id]
            );
            console.log(`  ✅ Updated floor ${f.sort + 1}: ${f.title} (ID: ${existing[0].id})`);
        } else {
            const [result] = await db.query(
                'INSERT INTO milestones (title, description, stars_required, icon, sort_order, is_active) VALUES (?,?,?,?,?,1)',
                [f.title, f.desc, f.stars, f.icon, f.sort]
            );
            console.log(`  ✅ Created floor ${f.sort + 1}: ${f.title} (ID: ${result.insertId})`);
        }
    }

    console.log('🏰 Done! 18 floors seeded.');
    process.exit(0);
}

seedTower().catch(err => {
    console.error('❌ Seed error:', err);
    process.exit(1);
});
