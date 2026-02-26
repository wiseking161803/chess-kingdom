require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        console.log('🌾 Running Garden migration...');
        const sql = fs.readFileSync(path.join(__dirname, 'garden_system.sql'), 'utf8');
        // Split by semicolons, handling multi-line VALUES
        const statements = [];
        let current = '';
        for (const line of sql.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('--')) continue;
            current += line + '\n';
            if (trimmed.endsWith(';')) {
                statements.push(current.trim());
                current = '';
            }
        }
        if (current.trim()) statements.push(current.trim());

        for (const stmt of statements) {
            if (!stmt || stmt.length < 5) continue;
            try {
                await db.query(stmt);
                console.log('✅', stmt.substring(0, 60).replace(/\n/g, ' '));
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    console.log('⏭️ Already exists:', stmt.substring(0, 50));
                } else {
                    console.error('❌', e.message);
                }
            }
        }
        console.log('🌾 Garden migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌', err);
        process.exit(1);
    }
}
run();
