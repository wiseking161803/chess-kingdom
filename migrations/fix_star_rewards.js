const db = require('../config/database');
(async () => {
    await db.query("DELETE FROM lucky_wheel_prizes WHERE prize_type='stars'");
    console.log('Deleted star prizes from wheel');
    await db.query('UPDATE quest_templates SET stars_reward = 0');
    console.log('Set all quest stars_reward = 0');
    const [r] = await db.query('SELECT COUNT(*) as c FROM lucky_wheel_prizes');
    console.log('Remaining wheel prizes:', r[0].c);
    process.exit(0);
})();
