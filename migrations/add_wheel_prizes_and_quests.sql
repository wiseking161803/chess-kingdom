-- ============================================
-- Lucky Wheel: Add coins, tickets, and egg prizes
-- ============================================

-- First clear existing prizes
DELETE FROM lucky_wheel_prizes;

-- Insert new prize pool with desired rates
-- Coins: 1000-50000 xu (1% each tier = ~6% total)
INSERT INTO lucky_wheel_prizes (label, prize_type, prize_value, rarity, weight, color, sort_order, is_active) VALUES
('🪙 1,000 Xu', 'coins', '1000', 'common', 100, '#FFD700', 1, 1),
('🪙 2,000 Xu', 'coins', '2000', 'common', 80, '#FFD700', 2, 1),
('🪙 5,000 Xu', 'coins', '5000', 'common', 50, '#FFA500', 3, 1),
('🪙 10,000 Xu', 'coins', '10000', 'rare', 30, '#FF8C00', 4, 1),
('🪙 20,000 Xu', 'coins', '20000', 'rare', 15, '#FF6347', 5, 1),
('🪙 50,000 Xu', 'coins', '50000', 'epic', 10, '#FF4500', 6, 1);

-- Stars prizes (common)
INSERT INTO lucky_wheel_prizes (label, prize_type, prize_value, rarity, weight, color, sort_order, is_active) VALUES
('⭐ 5 Sao', 'stars', '5', 'common', 200, '#FFD700', 7, 1),
('⭐ 10 Sao', 'stars', '10', 'common', 150, '#FFD700', 8, 1),
('⭐ 20 Sao', 'stars', '20', 'rare', 80, '#FFA500', 9, 1),
('⭐ 50 Sao', 'stars', '50', 'epic', 20, '#FF6347', 10, 1);

-- Tickets (Phiếu Bé Ngoan) — 1% rate each
INSERT INTO lucky_wheel_prizes (label, prize_type, prize_value, rarity, weight, color, sort_order, is_active) VALUES
('🎫 1 Phiếu Bé Ngoan', 'tickets', '1', 'rare', 10, '#9B59B6', 11, 1),
('🎫 2 Phiếu Bé Ngoan', 'tickets', '2', 'epic', 6, '#8E44AD', 12, 1),
('🎫 3 Phiếu Bé Ngoan', 'tickets', '3', 'epic', 3, '#6C3483', 13, 1),
('🎫 5 Phiếu Bé Ngoan', 'tickets', '5', 'legendary', 1, '#D4AF37', 14, 1);

-- Divine Egg — 0.1% rate
INSERT INTO lucky_wheel_prizes (label, prize_type, prize_value, rarity, weight, color, sort_order, is_active) VALUES
('🥚✨ Trứng Thần', 'egg', '1', 'mythic', 1, '#FF00FF', 15, 1);


-- ============================================
-- Daily/Weekly Quest Templates
-- ============================================

-- Daily quests (day_of_week: 1=Mon, 2=Tue, ..., 7=Sun)
-- Login quest: available every day
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('daily', 1, '📱 Đăng nhập hôm nay', 2, 500, 1),
('daily', 2, '📱 Đăng nhập hôm nay', 2, 500, 1),
('daily', 3, '📱 Đăng nhập hôm nay', 2, 500, 1),
('daily', 4, '📱 Đăng nhập hôm nay', 2, 500, 1),
('daily', 5, '📱 Đăng nhập hôm nay', 2, 500, 1),
('daily', 6, '📱 Đăng nhập hôm nay', 2, 500, 1),
('daily', 7, '📱 Đăng nhập hôm nay', 2, 500, 1);

-- Earn 3 stars: every day
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('daily', 1, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1),
('daily', 2, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1),
('daily', 3, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1),
('daily', 4, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1),
('daily', 5, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1),
('daily', 6, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1),
('daily', 7, '⭐ Kiếm ít nhất 3 sao', 3, 1000, 1);

-- Earn 10 stars: every day
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('daily', 1, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1),
('daily', 2, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1),
('daily', 3, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1),
('daily', 4, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1),
('daily', 5, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1),
('daily', 6, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1),
('daily', 7, '🌟 Kiếm ít nhất 10 sao', 5, 3000, 1);

-- Feed dragon: every day
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('daily', 1, '🍖 Cho rồng ăn 1 lần', 1, 500, 1),
('daily', 2, '🍖 Cho rồng ăn 1 lần', 1, 500, 1),
('daily', 3, '🍖 Cho rồng ăn 1 lần', 1, 500, 1),
('daily', 4, '🍖 Cho rồng ăn 1 lần', 1, 500, 1),
('daily', 5, '🍖 Cho rồng ăn 1 lần', 1, 500, 1),
('daily', 6, '🍖 Cho rồng ăn 1 lần', 1, 500, 1),
('daily', 7, '🍖 Cho rồng ăn 1 lần', 1, 500, 1);

-- Complete 1 tower task: every day
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('daily', 1, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1),
('daily', 2, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1),
('daily', 3, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1),
('daily', 4, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1),
('daily', 5, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1),
('daily', 6, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1),
('daily', 7, '🏰 Hoàn thành 1 nhiệm vụ Tháp Kỳ Vương', 3, 2000, 1);

-- Visit garden: every day
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('daily', 1, '🌻 Thu hoạch vườn cây', 1, 500, 1),
('daily', 2, '🌻 Thu hoạch vườn cây', 1, 500, 1),
('daily', 3, '🌻 Thu hoạch vườn cây', 1, 500, 1),
('daily', 4, '🌻 Thu hoạch vườn cây', 1, 500, 1),
('daily', 5, '🌻 Thu hoạch vườn cây', 1, 500, 1),
('daily', 6, '🌻 Thu hoạch vườn cây', 1, 500, 1),
('daily', 7, '🌻 Thu hoạch vườn cây', 1, 500, 1);


-- ============================================
-- Weekly Quests
-- ============================================
INSERT INTO quest_templates (type, day_of_week, title, stars_reward, coins_reward, is_active) VALUES
('weekly', NULL, '📅 Đăng nhập 5 ngày trong tuần', 10, 5000, 1),
('weekly', NULL, '⭐ Kiếm tổng 50 sao trong tuần', 15, 10000, 1),
('weekly', NULL, '🏰 Hoàn thành 5 nhiệm vụ Tháp Kỳ Vương', 10, 8000, 1),
('weekly', NULL, '⚔️ Tham gia 3 trận chiến thế giới', 8, 5000, 1),
('weekly', NULL, '🐉 Cho rồng ăn 5 lần', 5, 3000, 1),
('weekly', NULL, '🌻 Thu hoạch vườn cây 5 lần', 5, 3000, 1),
('weekly', NULL, '🎯 Đạt hạng Top 10 trong Đấu Trường', 20, 15000, 1);
