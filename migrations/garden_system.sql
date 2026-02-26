-- Garden System Migration
-- Creates garden plots, seed items, and harvest tracking

-- Garden plots for each user
CREATE TABLE IF NOT EXISTS garden_plots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    slot INT NOT NULL DEFAULT 0,
    seed_item_id INT DEFAULT NULL,
    planted_at TIMESTAMP NULL,
    watered_at TIMESTAMP NULL,
    harvest_ready_at TIMESTAMP NULL,
    status ENUM('empty', 'planted', 'watered', 'ready', 'withered') DEFAULT 'empty',
    UNIQUE KEY uq_user_slot (user_id, slot),
    INDEX idx_user (user_id)
);

-- Harvest log
CREATE TABLE IF NOT EXISTS garden_harvests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    seed_item_id INT NOT NULL,
    harvest_item_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Harvested crop inventory per user
CREATE TABLE IF NOT EXISTS user_garden_harvest (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    harvest_name VARCHAR(100) NOT NULL,
    harvest_icon VARCHAR(20) DEFAULT '🌱',
    quantity INT DEFAULT 0,
    sell_price INT DEFAULT 0,
    exp_value INT DEFAULT 0,
    fav_element VARCHAR(20) DEFAULT 'fire',
    tier INT DEFAULT 1,
    UNIQUE KEY uq_user_harvest (user_id, harvest_name),
    INDEX idx_user (user_id)
);

-- Insert 20 seed types into shop_items
-- Category 'garden_seed' for identification
-- Tiered by element affinity: each seed has a "favorite_element" for dragon EXP bonus
INSERT INTO shop_items (name, description, category, cost, cost_type, icon, sort_order, is_active)
VALUES
-- Tier 1: Cheap & Fast (1-5 min grow time, low value)
('Hạt Cỏ May', 'Cỏ may mắn, mọc rất nhanh. 🐉 Kim yêu thích', 'garden_seed', 100, 'coins', '🌱', 200, 1),
('Hạt Húng Quế', 'Rau húng thơm ngát. 🐉 Mộc yêu thích', 'garden_seed', 150, 'coins', '🌿', 201, 1),
('Hạt Bạc Hà', 'Bạc hà the mát. 🐉 Thủy yêu thích', 'garden_seed', 200, 'coins', '🍃', 202, 1),
('Hạt Ớt', 'Ớt cay nồng. 🐉 Hỏa yêu thích', 'garden_seed', 250, 'coins', '🌶️', 203, 1),
('Hạt Khoai', 'Khoai lang bổ dưỡng. 🐉 Thổ yêu thích', 'garden_seed', 200, 'coins', '🥔', 204, 1),

-- Tier 2: Medium (10-20 min, moderate value)
('Hạt Cà Rốt', 'Cà rốt giàu vitamin. 🐉 Á.Sáng yêu thích', 'garden_seed', 500, 'coins', '🥕', 210, 1),
('Hạt Cà Tím', 'Cà tím huyền bí. 🐉 B.Tối yêu thích', 'garden_seed', 500, 'coins', '🍆', 211, 1),
('Hạt Bắp', 'Ngô bắp vàng óng. 🐉 Kim yêu thích', 'garden_seed', 600, 'coins', '🌽', 212, 1),
('Hạt Cà Chua', 'Cà chua mọng nước. 🐉 Hỏa yêu thích', 'garden_seed', 700, 'coins', '🍅', 213, 1),
('Hạt Dưa Hấu', 'Dưa hấu mát lạnh. 🐉 Thủy yêu thích', 'garden_seed', 800, 'coins', '🍉', 214, 1),

-- Tier 3: Expensive (30-60 min, high value)
('Hạt Táo', 'Táo rừng quý hiếm. 🐉 Mộc yêu thích', 'garden_seed', 1500, 'coins', '🍎', 220, 1),
('Hạt Đào', 'Đào tiên hồng tươi. 🐉 Á.Sáng yêu thích', 'garden_seed', 1500, 'coins', '🍑', 221, 1),
('Hạt Nho', 'Nho tím huyền thoại. 🐉 B.Tối yêu thích', 'garden_seed', 2000, 'coins', '🍇', 222, 1),
('Hạt Dâu', 'Dâu tây ngọt ngào. 🐉 Thổ yêu thích', 'garden_seed', 2000, 'coins', '🍓', 223, 1),
('Hạt Cam', 'Cam vàng óng ả. 🐉 Hỏa yêu thích', 'garden_seed', 2500, 'coins', '🍊', 224, 1),

-- Tier 4: Premium (2-6h, very high value)
('Hạt Xoài', 'Xoài hoàng kim. 🐉 Kim yêu thích', 'garden_seed', 5000, 'coins', '🥭', 230, 1),
('Hạt Dừa', 'Dừa nhiệt đới. 🐉 Thủy yêu thích', 'garden_seed', 6000, 'coins', '🥥', 231, 1),
('Hạt Sầu Riêng', 'Vua trái cây, sầu riêng hạng nhất. 🐉 Thổ yêu thích', 'garden_seed', 8000, 'coins', '🫠', 232, 1),
('Hạt Hoa Sen', 'Hoa sen thần thánh. 🐉 Á.Sáng yêu thích', 'garden_seed', 10000, 'coins', '🪷', 233, 1),
('Hạt Nấm Linh Chi', 'Nấm linh chi vạn năm. 🐉 B.Tối yêu thích', 'garden_seed', 12000, 'coins', '🍄', 234, 1);
