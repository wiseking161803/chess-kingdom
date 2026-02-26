/**
 * Migration: Update shop prices and buff descriptions
 * - Lửa Phượng Hoàng: 500000 → 100000
 * - Thần Hộ Giáp: → 50000, +50% DEF all dragons 24h
 * - Cuồng Nộ Rồng: → 50000, +50% ATT all dragons 24h
 */
const db = require('../config/database');

async function run() {
    try {
        // Update Lửa Phượng Hoàng price
        await db.query(
            "UPDATE shop_items SET cost = 100000 WHERE name = 'Lửa Phượng Hoàng'"
        );
        console.log('✅ Lửa Phượng Hoàng → 100,000 xu');

        // Update Thần Hộ Giáp price and description
        await db.query(
            "UPDATE shop_items SET cost = 50000, description = 'Tăng 50% DEF cho TẤT CẢ rồng trong 24 giờ (cả tấn công lẫn phòng thủ)' WHERE name = 'Thần Hộ Giáp'"
        );
        console.log('✅ Thần Hộ Giáp → 50,000 xu, +50% DEF all dragons 24h');

        // Update Cuồng Nộ Rồng price and description  
        await db.query(
            "UPDATE shop_items SET cost = 50000, description = 'Tăng 50% ATT cho TẤT CẢ rồng trong 24 giờ' WHERE name = 'Cuồng Nộ Rồng'"
        );
        console.log('✅ Cuồng Nộ Rồng → 50,000 xu, +50% ATT all dragons 24h');

        console.log('\n🎉 Shop prices updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

run();
