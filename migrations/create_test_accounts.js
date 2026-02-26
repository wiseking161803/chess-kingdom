// Create 7 test accounts with 5 same-element dragons each
const db = require('../config/database');
const bcrypt = require('bcryptjs');

const ELEMENTS = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark'];
const ELEMENT_NAMES_VN = {
    metal: 'Kim', wood: 'Mộc', water: 'Thủy', fire: 'Hỏa',
    earth: 'Thổ', light: 'Ánh Sáng', dark: 'Bóng Tối'
};
const ELEMENT_DRAGON_NAMES = {
    metal: ['Kim Long', 'Thiết Long', 'Bạch Kim', 'Cương Long', 'Ngân Long'],
    wood: ['Mộc Long', 'Lâm Long', 'Thảo Long', 'Hoa Long', 'Diệp Long'],
    water: ['Thủy Long', 'Hải Long', 'Sóng Long', 'Vũ Long', 'Băng Long'],
    fire: ['Hỏa Long', 'Viêm Long', 'Thiêu Long', 'Nhiệt Long', 'Lửa Long'],
    earth: ['Thổ Long', 'Nham Long', 'Sơn Long', 'Địa Long', 'Thạch Long'],
    light: ['Quang Long', 'Thánh Long', 'Nhật Long', 'Minh Long', 'Thiên Long'],
    dark: ['Ám Long', 'Hắc Long', 'Dạ Long', 'Ảnh Long', 'Ma Long']
};

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
    light: { hp: 6, att: 2.5, def: 1.5, spd: 1 },
    dark: { hp: 6, att: 2.5, def: 1.5, spd: 1 }
};

async function create() {
    const password = await bcrypt.hash('123456', 10);
    const targetLevel = 10;

    for (const element of ELEMENTS) {
        const username = `test_${ELEMENT_NAMES_VN[element].toLowerCase().replace(/\s/g, '')}`;
        const displayName = `Test ${ELEMENT_NAMES_VN[element]}`;
        const names = ELEMENT_DRAGON_NAMES[element];

        console.log(`\nCreating ${displayName}...`);

        // Check if user exists
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        let userId;
        if (existing.length > 0) {
            userId = existing[0].id;
            console.log(`  ⚠️ User exists (id=${userId}), cleaning up dragons/formations...`);
            await db.query('DELETE FROM dragon_formations WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM user_dragons WHERE user_id = ?', [userId]);
        } else {
            const [userResult] = await db.query(
                "INSERT INTO users (username, display_name, password_hash, role, status) VALUES (?, ?, ?, 'student', 'active')",
                [username, displayName, password]
            );
            userId = userResult.insertId;
            console.log(`  ✅ Created user (id=${userId})`);

            // Initialize currencies
            await db.query(
                'INSERT INTO user_currencies (user_id, chess_coins, knowledge_stars) VALUES (?, 100000, 0) ON DUPLICATE KEY UPDATE chess_coins = 100000',
                [userId]
            );

            // Initialize ELO
            await db.query(
                'INSERT INTO user_elo (user_id, current_elo) VALUES (?, 800) ON DUPLICATE KEY UPDATE current_elo = 800',
                [userId]
            );
        }

        // Calculate stats for level 10
        const base = ELEMENT_BASE_STATS[element];
        const growth = ELEMENT_GROWTH[element];
        const lvl = targetLevel - 1;
        const hp = Math.floor(base.hp + lvl * growth.hp);
        const att = Math.floor(base.att + lvl * growth.att);
        const def_stat = Math.floor(base.def + lvl * growth.def);
        const spd = Math.floor(base.spd + lvl * growth.spd);

        // Create 5 dragons
        const dragonIds = [];
        for (let i = 0; i < 5; i++) {
            const [result] = await db.query(
                'INSERT INTO user_dragons (user_id, name, element, level, hp, att, def_stat, spd, current_hp, crit_rate, crit_dmg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 150)',
                [userId, names[i], element, targetLevel, hp, att, def_stat, spd, hp]
            );
            dragonIds.push(result.insertId);
            console.log(`  🐲 ${names[i]} (Lv.${targetLevel}) HP:${hp} ATT:${att} DEF:${def_stat} SPD:${spd}`);
        }

        // Set up formation: 3 front, 2 back
        for (let i = 0; i < 5; i++) {
            const position = i < 3 ? 'front' : 'back';
            await db.query(
                'INSERT INTO dragon_formations (user_id, slot, dragon_id, position) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE dragon_id = ?, position = ?',
                [userId, i, dragonIds[i], position, dragonIds[i], position]
            );
        }
        console.log(`  🏰 Formation set: 3 front, 2 back`);
    }

    console.log('\n🎉 All 7 test accounts created!');
    console.log('Usernames: test_kim, test_mộc, test_thủy, test_hỏa, test_thổ, test_ánhsáng, test_bóngtối');
    console.log('Password: 123456');
    process.exit(0);
}

create().catch(err => { console.error('Error:', err); process.exit(1); });
