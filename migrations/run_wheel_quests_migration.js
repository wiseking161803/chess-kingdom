/**
 * Migration: Add wheel prizes (coins, tickets, egg) and daily/weekly quests
 */
const db = require('../config/database');

async function run() {
    console.log('🔄 Running migration...');

    // ============ WHEEL PRIZES ============
    // First extend prize_type ENUM to include tickets and egg
    console.log('  Extending prize_type and rarity columns...');
    try {
        await db.query("ALTER TABLE lucky_wheel_prizes MODIFY COLUMN prize_type VARCHAR(50) NOT NULL DEFAULT 'coins'");
        await db.query("ALTER TABLE lucky_wheel_prizes MODIFY COLUMN rarity VARCHAR(50) NOT NULL DEFAULT 'common'");
    } catch (e) {
        console.log('  Column alter note:', e.message);
    }

    console.log('  Clearing old wheel prizes...');
    await db.query('DELETE FROM lucky_wheel_prizes');

    console.log('  Adding new wheel prizes...');
    const prizes = [
        ['🪙 1,000 Xu', 'coins', '1000', 'common', 100, '#FFD700', 1],
        ['🪙 2,000 Xu', 'coins', '2000', 'common', 80, '#FFD700', 2],
        ['🪙 5,000 Xu', 'coins', '5000', 'common', 50, '#FFA500', 3],
        ['🪙 10,000 Xu', 'coins', '10000', 'rare', 30, '#FF8C00', 4],
        ['🪙 20,000 Xu', 'coins', '20000', 'rare', 15, '#FF6347', 5],
        ['🪙 50,000 Xu', 'coins', '50000', 'epic', 10, '#FF4500', 6],
        ['⭐ 5 Sao', 'stars', '5', 'common', 200, '#FFD700', 7],
        ['⭐ 10 Sao', 'stars', '10', 'common', 150, '#FFD700', 8],
        ['⭐ 20 Sao', 'stars', '20', 'rare', 80, '#FFA500', 9],
        ['⭐ 50 Sao', 'stars', '50', 'epic', 20, '#FF6347', 10],
        ['🎫 1 Phiếu Bé Ngoan', 'tickets', '1', 'rare', 10, '#9B59B6', 11],
        ['🎫 2 Phiếu Bé Ngoan', 'tickets', '2', 'epic', 6, '#8E44AD', 12],
        ['🎫 3 Phiếu Bé Ngoan', 'tickets', '3', 'epic', 3, '#6C3483', 13],
        ['🎫 5 Phiếu Bé Ngoan', 'tickets', '5', 'legendary', 1, '#D4AF37', 14],
        ['🥚✨ Trứng Thần', 'egg', '1', 'mythic', 1, '#FF00FF', 15],
    ];

    for (const p of prizes) {
        await db.query(
            'INSERT INTO lucky_wheel_prizes (label, prize_type, prize_value, rarity, weight, color, sort_order, is_active) VALUES (?,?,?,?,?,?,?,1)',
            p
        );
    }
    console.log(`  ✅ Added ${prizes.length} wheel prizes`);

    // ============ QUEST TEMPLATES ============
    // Check if day_of_week column exists
    const [cols] = await db.query('DESCRIBE quest_templates');
    const colNames = cols.map(c => c.Field);
    console.log('  quest_templates columns:', colNames.join(', '));

    if (!colNames.includes('day_of_week')) {
        console.log('  Adding day_of_week column...');
        await db.query('ALTER TABLE quest_templates ADD COLUMN day_of_week INT NULL AFTER type');
    }

    // Check existing quest count
    const [existing] = await db.query('SELECT COUNT(*) as c FROM quest_templates');
    console.log(`  Existing quests: ${existing[0].c}`);

    // Add daily quests (for all 7 days)
    const dailyQuests = [
        '📱 Đăng nhập hôm nay',
        '⭐ Kiếm ít nhất 3 sao',
        '🌟 Kiếm ít nhất 10 sao',
        '🍖 Cho rồng ăn 1 lần',
        '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương',
        '🌻 Thu hoạch vườn cây',
    ];
    const dailyRewards = [
        [2, 500], [3, 1000], [5, 3000], [1, 500], [3, 2000], [1, 500]
    ];

    let added = 0;
    for (let qi = 0; qi < dailyQuests.length; qi++) {
        for (let day = 1; day <= 7; day++) {
            // Check if already exists
            const [ex] = await db.query(
                'SELECT id FROM quest_templates WHERE type = ? AND title = ? AND day_of_week = ?',
                ['daily', dailyQuests[qi], day]
            );
            if (ex.length === 0) {
                await db.query(
                    'INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES (?,?,?,?,?,1)',
                    ['daily', day, dailyQuests[qi], dailyRewards[qi][0], dailyRewards[qi][1]]
                );
                added++;
            }
        }
    }
    console.log(`  ✅ Added ${added} daily quests`);

    // Weekly quests
    const weeklyQuests = [
        ['📅 Đăng nhập 5 ngày trong tuần', 10, 5000],
        ['⭐ Kiếm tổng 50 sao trong tuần', 15, 10000],
        ['🏰 Hoàn thành 5 nhiệm vụ Tháp Kỳ Vương', 10, 8000],
        ['⚔️ Tham gia 3 trận chiến thế giới', 8, 5000],
        ['🐉 Cho rồng ăn 5 lần', 5, 3000],
        ['🌻 Thu hoạch vườn cây 5 lần', 5, 3000],
        ['🎯 Đạt hạng Top 10 trong Đấu Trường', 20, 15000],
    ];

    let wAdded = 0;
    for (const wq of weeklyQuests) {
        const [ex] = await db.query(
            'SELECT id FROM quest_templates WHERE type = ? AND title = ?',
            ['weekly', wq[0]]
        );
        if (ex.length === 0) {
            await db.query(
                'INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES (?,NULL,?,?,?,1)',
                ['weekly', wq[0], wq[1], wq[2]]
            );
            wAdded++;
        }
    }
    console.log(`  ✅ Added ${wAdded} weekly quests`);

    // ============ FIX DUPLICATE DRAGON NAMES ============
    console.log('  Fixing duplicate dragon names...');
    const [allDragons] = await db.query('SELECT id, user_id, name FROM user_dragons ORDER BY user_id, id');
    const userNames = {};
    let dupeFixed = 0;
    for (const d of allDragons) {
        const key = `${d.user_id}_${d.name}`;
        if (!userNames[key]) {
            userNames[key] = 1;
        } else {
            userNames[key]++;
            const newName = `${d.name} (${userNames[key]})`;
            await db.query('UPDATE user_dragons SET name = ? WHERE id = ?', [newName, d.id]);
            dupeFixed++;
        }
    }
    console.log(`  ✅ Fixed ${dupeFixed} duplicate dragon names`);

    console.log('🎉 Migration complete!');
    process.exit(0);
}

run().catch(e => { console.error('❌ Migration failed:', e); process.exit(1); });
