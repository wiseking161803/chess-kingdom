const db = require('../config/database');

async function run() {
    try {
        // Update gacha weights: 64% common, 30% rare, 5% epic, 1% legendary
        await db.query(`
            UPDATE dragon_equipment SET weight = CASE
                WHEN rarity = 'common' THEN 64
                WHEN rarity = 'rare' THEN 30
                WHEN rarity = 'epic' THEN 5
                WHEN rarity = 'legendary' THEN 1
                ELSE weight
            END
        `);
        console.log('✅ Gacha weights updated: 64/30/5/1');

        // Boost epic + legendary stats (triple base, double crit)
        await db.query(`
            UPDATE dragon_equipment
            SET hp_bonus = hp_bonus * 3,
                att_bonus = att_bonus * 3,
                def_bonus = def_bonus * 3,
                crit_rate_bonus = LEAST(crit_rate_bonus * 2, 50),
                crit_dmg_bonus = LEAST(crit_dmg_bonus * 2, 100)
            WHERE rarity IN ('epic', 'legendary')
        `);
        console.log('✅ Epic/Legendary stats boosted (3x base, 2x crit)');

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

run();
