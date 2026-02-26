/**
 * Migration: Achievement Milestone Claims table
 * Tracks which milestones each user has claimed
 */
const db = require('../config/database');

async function up() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS achievement_milestone_claims (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            milestone_key VARCHAR(50) NOT NULL,
            claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_claim (user_id, milestone_key),
            INDEX idx_user (user_id)
        )
    `);
    console.log('✅ achievement_milestone_claims table created');
}

async function down() {
    await db.query('DROP TABLE IF EXISTS achievement_milestone_claims');
    console.log('✅ achievement_milestone_claims table dropped');
}

// Run migration if called directly
if (require.main === module) {
    up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { up, down };
