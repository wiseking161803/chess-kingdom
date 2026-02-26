-- Dragon Arena Migration
-- Creates arena tables, 20 bot accounts, dragons, and formations

-- Arena rankings table (rank 1 = highest)
CREATE TABLE IF NOT EXISTS dragon_arena_rankings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rank_position INT NOT NULL UNIQUE,
    user_id INT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_rank (rank_position)
);

-- Daily challenge tracking
CREATE TABLE IF NOT EXISTS dragon_arena_challenges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    challenge_date DATE NOT NULL,
    challenges_used INT DEFAULT 0,
    UNIQUE KEY uq_user_date (user_id, challenge_date)
);

-- Arena reward log (6-hourly)
CREATE TABLE IF NOT EXISTS dragon_arena_rewards_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    rank_position INT NOT NULL,
    tickets_earned INT DEFAULT 0,
    coins_earned INT DEFAULT 0,
    reward_period VARCHAR(20) NOT NULL,
    claimed TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_period (user_id, reward_period)
);
