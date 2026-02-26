-- Dragon & Gacha System — Phase 1 Migration
-- Run this against the chess_training database

-- 1. Add good_kid_tickets to user_currencies
ALTER TABLE user_currencies ADD COLUMN IF NOT EXISTS good_kid_tickets INT DEFAULT 0;

-- 2. User dragons (1 per user)
CREATE TABLE IF NOT EXISTS user_dragons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  name VARCHAR(50) DEFAULT 'Rồng Con',
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  hp INT DEFAULT 100,
  att INT DEFAULT 10,
  def INT DEFAULT 5,
  crit_rate DECIMAL(5,2) DEFAULT 5.00,
  crit_dmg DECIMAL(5,2) DEFAULT 150.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dragon equipment pool (gacha items)
CREATE TABLE IF NOT EXISTS dragon_equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slot ENUM('hat','sword','armor','pants','glasses','shoes') NOT NULL,
  rarity ENUM('common','rare','epic','legendary') NOT NULL,
  icon VARCHAR(10) DEFAULT '🎁',
  hp_bonus INT DEFAULT 0,
  att_bonus INT DEFAULT 0,
  def_bonus INT DEFAULT 0,
  crit_rate_bonus DECIMAL(5,2) DEFAULT 0,
  crit_dmg_bonus DECIMAL(5,2) DEFAULT 0,
  weight INT DEFAULT 100
);

-- 4. User's obtained equipment
CREATE TABLE IF NOT EXISTS user_dragon_equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  equipment_id INT NOT NULL,
  is_equipped BOOLEAN DEFAULT false,
  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_equip (equipment_id)
);

-- 5. Gacha history
CREATE TABLE IF NOT EXISTS gacha_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  equipment_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
);

-- 6. Daily leaderboard rewards
CREATE TABLE IF NOT EXISTS daily_leaderboard_rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  reward_date DATE NOT NULL,
  rank_position INT NOT NULL,
  tickets_earned INT DEFAULT 0,
  coins_earned INT DEFAULT 0,
  UNIQUE KEY unique_daily (user_id, reward_date),
  INDEX idx_date (reward_date)
);

-- =============================================
-- SEED: Gacha Equipment Pool (24 items: 6 slots × 4 rarities)
-- =============================================

-- Hat (Nón)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, weight) VALUES
('Nón Lá Cũ', 'hat', 'common', '🎩', 5, 0, 0, 0, 0, 50),
('Nón Kỵ Sĩ', 'hat', 'rare', '🪖', 15, 0, 2, 0, 0, 30),
('Mũ Hoàng Gia', 'hat', 'epic', '👑', 30, 0, 5, 0, 0, 15),
('Vương Miện Rồng Thiêng', 'hat', 'legendary', '💎', 60, 0, 10, 3, 0, 5);

-- Sword (Kiếm)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, weight) VALUES
('Kiếm Gỗ', 'sword', 'common', '🗡️', 0, 3, 0, 0, 0, 50),
('Kiếm Thép', 'sword', 'rare', '⚔️', 0, 8, 0, 0, 0, 30),
('Kiếm Phượng Hoàng', 'sword', 'epic', '🔥', 0, 15, 0, 0, 5, 15),
('Thần Kiếm Rồng Lửa', 'sword', 'legendary', '⚡', 0, 25, 0, 0, 15, 5);

-- Armor (Áo giáp)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, weight) VALUES
('Áo Vải', 'armor', 'common', '👕', 5, 0, 3, 0, 0, 50),
('Áo Giáp Sắt', 'armor', 'rare', '🛡️', 10, 0, 8, 0, 0, 30),
('Giáp Rồng Xanh', 'armor', 'epic', '💙', 20, 0, 15, 0, 0, 15),
('Thần Giáp Bất Diệt', 'armor', 'legendary', '🌟', 40, 0, 25, 0, 0, 5);

-- Pants (Quần)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, weight) VALUES
('Quần Vải Thô', 'pants', 'common', '👖', 5, 0, 2, 0, 0, 50),
('Quần Chiến Binh', 'pants', 'rare', '🩳', 10, 0, 5, 0, 0, 30),
('Quần Kỵ Sĩ Bóng Đêm', 'pants', 'epic', '🌙', 25, 0, 10, 0, 0, 15),
('Quần Thần Long', 'pants', 'legendary', '✨', 50, 0, 18, 0, 0, 5);

-- Glasses (Kính)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, weight) VALUES
('Kính Cũ', 'glasses', 'common', '👓', 0, 0, 0, 2, 0, 50),
('Kính Thông Thái', 'glasses', 'rare', '🥽', 0, 0, 0, 4, 0, 30),
('Kính Phù Thủy', 'glasses', 'epic', '🔮', 0, 5, 0, 7, 0, 15),
('Mắt Rồng Thần', 'glasses', 'legendary', '👁️', 0, 10, 0, 10, 0, 5);

-- Shoes (Giày)
INSERT INTO dragon_equipment (name, slot, rarity, icon, hp_bonus, att_bonus, def_bonus, crit_rate_bonus, crit_dmg_bonus, weight) VALUES
('Giày Rơm', 'shoes', 'common', '👟', 0, 3, 2, 0, 0, 50),
('Giày Chiến Binh', 'shoes', 'rare', '🥾', 0, 6, 4, 0, 0, 30),
('Giày Gió Lốc', 'shoes', 'epic', '💨', 0, 12, 8, 0, 0, 15),
('Giày Rồng Sấm Sét', 'shoes', 'legendary', '⚡', 0, 20, 15, 0, 0, 5);

-- =============================================
-- SEED: Dragon Food items in shop
-- =============================================
INSERT INTO shop_items (name, description, icon_url, cost, cost_type, category, sort_order, is_active) VALUES
('Cỏ Thần', 'Cho rồng ăn +5 EXP', '🌿', 100, 'coins', 'dragon_food', 100, 1),
('Thịt Nướng', 'Cho rồng ăn +15 EXP', '🍖', 300, 'coins', 'dragon_food', 101, 1),
('Trái Cây Thần', 'Cho rồng ăn +30 EXP', '🍎', 600, 'coins', 'dragon_food', 102, 1),
('Bánh Rồng', 'Cho rồng ăn +50 EXP, +2 HP', '🍰', 1000, 'coins', 'dragon_food', 103, 1),
('Ngọc Rồng', 'Cho rồng ăn +100 EXP, +5 HP, +1 ATT', '💎', 2500, 'coins', 'dragon_food', 104, 1);
