/**
 * Migration: Rebalance all 30 equipment stats
 * Stats now increase progressively: common < rare < epic < legendary < mythic
 * 
 * Run: node migrations/rebalance_equipment.js
 */
const db = require('../config/database');

async function run() {
    console.log('🔧 Rebalancing 30 equipment items...\n');

    // Equipment stats by slot and rarity (progressively stronger)
    const updates = [
        // === HAT (Mũ/Nón) — Primary: HP, Secondary: DEF, SPD ===
        { name: 'Nón Lá Cũ', hp: 5, att: 0, def: 2, crit_rate: 0, crit_dmg: 0, spd: 1 },
        { name: 'Nón Kỵ Sĩ', hp: 18, att: 0, def: 6, crit_rate: 0, crit_dmg: 0, spd: 2 },
        { name: 'Mũ Hoàng Gia', hp: 40, att: 0, def: 14, crit_rate: 0, crit_dmg: 0, spd: 3 },
        { name: 'Vương Miện Rồng Thiêng', hp: 75, att: 0, def: 25, crit_rate: 3, crit_dmg: 0, spd: 5 },
        { name: 'Mũ Thiên Đế', hp: 130, att: 5, def: 40, crit_rate: 5, crit_dmg: 5, spd: 7 },

        // === SWORD (Kiếm) — Primary: ATT, Secondary: CRIT DMG, SPD ===
        { name: 'Kiếm Gỗ', hp: 0, att: 3, def: 0, crit_rate: 0, crit_dmg: 0, spd: 1 },
        { name: 'Kiếm Thép', hp: 0, att: 9, def: 0, crit_rate: 0, crit_dmg: 3, spd: 1 },
        { name: 'Kiếm Phượng Hoàng', hp: 0, att: 20, def: 0, crit_rate: 2, crit_dmg: 8, spd: 2 },
        { name: 'Thần Kiếm Rồng Lửa', hp: 0, att: 35, def: 0, crit_rate: 4, crit_dmg: 18, spd: 4 },
        { name: 'Thần Kiếm Tối Thượng', hp: 0, att: 55, def: 5, crit_rate: 6, crit_dmg: 30, spd: 6 },

        // === ARMOR (Áo giáp) — Primary: DEF, HP ===
        { name: 'Áo Vải', hp: 5, att: 0, def: 3, crit_rate: 0, crit_dmg: 0, spd: 1 },
        { name: 'Áo Giáp Sắt', hp: 15, att: 0, def: 10, crit_rate: 0, crit_dmg: 0, spd: 1 },
        { name: 'Giáp Rồng Xanh', hp: 30, att: 0, def: 22, crit_rate: 0, crit_dmg: 0, spd: 2 },
        { name: 'Thần Giáp Bất Diệt', hp: 55, att: 0, def: 38, crit_rate: 0, crit_dmg: 0, spd: 3 },
        { name: 'Thần Giáp Vĩnh Cửu', hp: 100, att: 5, def: 60, crit_rate: 0, crit_dmg: 0, spd: 5 },

        // === PANTS (Quần) — Primary: HP, DEF, SPD ===
        { name: 'Quần Vải Thô', hp: 4, att: 0, def: 2, crit_rate: 0, crit_dmg: 0, spd: 1 },
        { name: 'Quần Chiến Binh', hp: 12, att: 0, def: 7, crit_rate: 0, crit_dmg: 0, spd: 2 },
        { name: 'Quần Kỵ Sĩ Bóng Đêm', hp: 28, att: 0, def: 15, crit_rate: 0, crit_dmg: 0, spd: 3 },
        { name: 'Quần Thần Long', hp: 55, att: 0, def: 28, crit_rate: 2, crit_dmg: 0, spd: 5 },
        { name: 'Quần Long Vương', hp: 95, att: 5, def: 45, crit_rate: 3, crit_dmg: 0, spd: 7 },

        // === GLASSES (Kính) — Primary: CRIT, CRIT DMG ===
        { name: 'Kính Cũ', hp: 0, att: 0, def: 0, crit_rate: 1.5, crit_dmg: 0, spd: 0 },
        { name: 'Kính Thông Thái', hp: 0, att: 0, def: 0, crit_rate: 3, crit_dmg: 3, spd: 1 },
        { name: 'Kính Phù Thủy', hp: 0, att: 5, def: 0, crit_rate: 5, crit_dmg: 8, spd: 2 },
        { name: 'Mắt Rồng Thần', hp: 0, att: 10, def: 0, crit_rate: 8, crit_dmg: 15, spd: 3 },
        { name: 'Mắt Thần Linh', hp: 10, att: 18, def: 5, crit_rate: 12, crit_dmg: 25, spd: 5 },

        // === SHOES (Giày) — Primary: SPD, ATT, DEF ===
        { name: 'Giày Rơm', hp: 0, att: 2, def: 1, crit_rate: 0, crit_dmg: 0, spd: 2 },
        { name: 'Giày Chiến Binh', hp: 0, att: 5, def: 3, crit_rate: 0, crit_dmg: 0, spd: 3 },
        { name: 'Giày Gió Lốc', hp: 0, att: 10, def: 6, crit_rate: 0, crit_dmg: 0, spd: 5 },
        { name: 'Giày Rồng Sấm Sét', hp: 0, att: 18, def: 12, crit_rate: 2, crit_dmg: 0, spd: 7 },
        { name: 'Giày Thần Tốc', hp: 15, att: 28, def: 18, crit_rate: 4, crit_dmg: 5, spd: 10 },
    ];

    let updated = 0;
    for (const u of updates) {
        const [result] = await db.query(
            `UPDATE dragon_equipment SET 
                hp_bonus = ?, att_bonus = ?, def_bonus = ?, 
                crit_rate_bonus = ?, crit_dmg_bonus = ?, spd_bonus = ?
             WHERE name = ?`,
            [u.hp, u.att, u.def, u.crit_rate, u.crit_dmg, u.spd, u.name]
        );
        if (result.affectedRows > 0) {
            console.log(`  ✅ ${u.name}: HP+${u.hp} ATT+${u.att} DEF+${u.def} CRIT+${u.crit_rate}% CDMG+${u.crit_dmg}% SPD+${u.spd}`);
            updated++;
        } else {
            console.log(`  ⚠️ ${u.name}: NOT FOUND`);
        }
    }

    console.log(`\n✅ Updated ${updated}/${updates.length} items`);
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
