-- Equipment Star System Migration
-- star_level 0-4 = ⭐ gold stars (1-5), star_level 5-9 = 🌟 red stars (1-5)
-- stats multiplier: 1 + (star_level * 0.1) → max 2.0x at star_level 10

ALTER TABLE user_dragon_equipment ADD COLUMN IF NOT EXISTS star_level INT DEFAULT 0;

-- Add column to track last time a defender was raided (for 1-hour shield)
ALTER TABLE user_dragons ADD COLUMN IF NOT EXISTS last_defended_at TIMESTAMP NULL DEFAULT NULL;
