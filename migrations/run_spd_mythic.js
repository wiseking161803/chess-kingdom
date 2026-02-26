require('dotenv').config();
const db = require('../config/database');

async function run() {
    try {
        try {
            await db.query('ALTER TABLE dragon_equipment ADD COLUMN spd_bonus INT DEFAULT 0');
            console.log('Added spd_bonus');
        } catch (e) {
            if (e.message.includes('Duplicate')) console.log('spd_bonus exists');
            else throw e;
        }

        await db.query(`ALTER TABLE dragon_equipment MODIFY COLUMN rarity ENUM('common','rare','epic','legendary','mythic') NOT NULL`);
        console.log('Rarity enum updated');

        await db.query(`UPDATE dragon_equipment SET spd_bonus=FLOOR(RAND()*2) WHERE rarity='common' AND spd_bonus=0`);
        await db.query(`UPDATE dragon_equipment SET spd_bonus=1+FLOOR(RAND()*2) WHERE rarity='rare' AND spd_bonus=0`);
        await db.query(`UPDATE dragon_equipment SET spd_bonus=2+FLOOR(RAND()*2) WHERE rarity='epic' AND spd_bonus=0`);
        await db.query(`UPDATE dragon_equipment SET spd_bonus=3+FLOOR(RAND()*3) WHERE rarity='legendary' AND spd_bonus=0`);
        console.log('SPD values set');

        const [existing] = await db.query(`SELECT id FROM dragon_equipment WHERE rarity='mythic'`);
        if (existing.length === 0) {
            await db.query(`INSERT INTO dragon_equipment (name,slot,rarity,icon,hp_bonus,att_bonus,def_bonus,crit_rate_bonus,crit_dmg_bonus,spd_bonus,weight) VALUES 
                ('Mũ Thiên Đế','hat','mythic','🌌',100,5,20,5,0,6,2),
                ('Mắt Thần Linh','glasses','mythic','👁️',20,15,5,15,10,5,2),
                ('Thần Kiếm Tối Thượng','sword','mythic','🗡️',0,40,5,5,25,7,2),
                ('Thần Giáp Vĩnh Cửu','armor','mythic','🛡️',80,5,40,0,0,4,2),
                ('Quần Long Vương','pants','mythic','👑',70,5,30,3,0,5,2),
                ('Giày Thần Tốc','shoes','mythic','💫',20,25,20,5,0,8,2)`);
            console.log('Mythic items added');
        } else {
            console.log('Mythic items exist');
        }

        const [items] = await db.query('SELECT name, rarity, spd_bonus FROM dragon_equipment ORDER BY FIELD(rarity,"common","rare","epic","legendary","mythic"), slot');
        for (const i of items) console.log(`  ${i.rarity} | ${i.name} | SPD:${i.spd_bonus}`);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
run();
