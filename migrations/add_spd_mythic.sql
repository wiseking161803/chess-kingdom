-- Migration: Add SPD bonus to equipment + Mythic tier
-- Run: mysql -u root chess_kingdom < migrations/add_spd_mythic.sql

-- 1. Add spd_bonus column if not exists
ALTER TABLE dragon_equipment ADD COLUMN IF NOT EXISTS spd_bonus INT DEFAULT 0;

-- 2. Modify rarity enum to include mythic
ALTER TABLE dragon_equipment MODIFY COLUMN rarity ENUM('common','rare','epic','legendary','mythic') NOT NULL;

-- 3. Update existing equipment with SPD values based on rarity
UPDATE dragon_equipment SET spd_bonus = FLOOR(RAND() * 2) WHERE rarity = 'common' AND spd_bonus = 0;
UPDATE dragon_equipment SET spd_bonus = 1 + FLOOR(RAND() * 2) WHERE rarity = 'rare' AND spd_bonus = 0;
UPDATE dragon_equipment SET spd_bonus = 2 + FLOOR(RAND() * 2) WHERE rarity = 'epic' AND spd_bonus = 0;
UPDATE dragon_equipment SET spd_bonus = 3 + FLOOR(RAND() * 3) WHERE rarity = 'legendary' AND spd_bonus = 0;

-- 4. Add Mythic tier equipment (6 items, one per slot)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, spd_bonus, weight) VALUES
('Mũ Thiên Đế', 'hat', 'mythic', '🌌', 100, 5, 20, 5, 0, 6, 2),
('Mắt Thần Linh', 'glasses', 'mythic', '👁️‍🗨️', 20, 15, 5, 15, 10, 5, 2),
('Thần Kiếm Tối Thượng', 'sword', 'mythic', '🗡️', 0, 40, 5, 5, 25, 7, 2),
('Thần Giáp Vĩnh Cửu', 'armor', 'mythic', '🛡️', 80, 5, 40, 0, 0, 4, 2),
('Quần Long Vương', 'pants', 'mythic', '👑', 70, 5, 30, 3, 0, 5, 2),
('Giày Thần Tốc', 'shoes', 'mythic', '💫', 20, 25, 20, 5, 0, 8, 2);
