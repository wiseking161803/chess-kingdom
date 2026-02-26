// Migration: Add spd column to user_dragons and update existing dragons
const db = require('../config/database');

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

async function migrate() {
    console.log('Adding spd column to user_dragons...');
    try {
        await db.query('ALTER TABLE user_dragons ADD COLUMN spd INT DEFAULT 5 AFTER def_stat');
        console.log('  ✅ spd column added');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('  ⚠️ spd column already exists');
        } else {
            throw e;
        }
    }

    // Fix existing dragons: recalculate stats based on element + level
    console.log('Recalculating existing dragon stats based on element...');
    const [dragons] = await db.query('SELECT id, element, level, tier FROM user_dragons');
    for (const d of dragons) {
        const base = ELEMENT_BASE_STATS[d.element] || ELEMENT_BASE_STATS.fire;
        const growth = ELEMENT_GROWTH[d.element] || ELEMENT_GROWTH.fire;
        const tierMult = 1 + (d.tier || 0);
        const lvl = d.level - 1; // levels above 1

        const hp = Math.floor((base.hp + lvl * growth.hp) * tierMult);
        const att = Math.floor((base.att + lvl * growth.att) * tierMult);
        const def_stat = Math.floor((base.def + lvl * growth.def) * tierMult);
        const spd = Math.floor((base.spd + lvl * growth.spd) * tierMult);

        await db.query(
            'UPDATE user_dragons SET hp = ?, att = ?, def_stat = ?, spd = ?, current_hp = LEAST(current_hp, ?) WHERE id = ?',
            [hp, att, def_stat, spd, hp, d.id]
        );
    }
    console.log(`  ✅ Updated ${dragons.length} dragons`);

    console.log('🎉 Migration complete!');
    process.exit(0);
}

migrate().catch(err => { console.error('Migration error:', err); process.exit(1); });
