const db = require('./config/database');
(async () => {
    try {
        // Find users without dragons
        const [users] = await db.query(`
            SELECT u.id, u.display_name FROM users u
            LEFT JOIN user_dragons d ON u.id = d.user_id
            WHERE d.id IS NULL AND u.status = 'active'
        `);
        console.log('Users without dragons:', users.map(u => `${u.display_name}(${u.id})`).join(', '));

        const dragonNames = ['Lửa Đỏ', 'Băng Xanh', 'Sấm Vàng', 'Gió Lục', 'Bóng Tối'];
        let idx = 0;
        for (const user of users) {
            const name = dragonNames[idx % dragonNames.length];
            const level = 2 + Math.floor(Math.random() * 3); // Level 2-4
            const hp = 100 + (level - 1) * 5;
            const att = 10 + (level - 1) * 2;
            const def = 3 + (level - 1) * 1;
            await db.query(
                'INSERT INTO user_dragons (user_id, name, level, exp, hp, att, def_stat, crit_rate, crit_dmg, current_hp, last_regen_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',
                [user.id, name, level, 0, hp, att, def, 5, 150, hp]
            );
            console.log(`Created dragon "${name}" Lv.${level} for ${user.display_name} (HP:${hp} ATT:${att} DEF:${def})`);
            idx++;
        }

        // Also give tester accounts some coins so there's something to steal
        const [testers] = await db.query("SELECT id, display_name FROM users WHERE role = 'student'");
        for (const t of testers) {
            await db.query('UPDATE user_currencies SET chess_coins = GREATEST(chess_coins, 20000) WHERE user_id = ?', [t.id]);
        }
        console.log('Ensured testers have at least 20,000 coins');

        // Verify
        const [all] = await db.query('SELECT d.user_id, u.display_name, d.name, d.level, d.hp, d.att, d.def_stat, d.current_hp FROM user_dragons d JOIN users u ON d.user_id = u.id');
        console.log('\nAll dragons:');
        all.forEach(d => console.log(`  ${d.display_name}: "${d.name}" Lv.${d.level} HP:${d.current_hp}/${d.hp} ATT:${d.att} DEF:${d.def_stat}`));
    } catch(e) { console.error(e.message); }
    process.exit(0);
})();
