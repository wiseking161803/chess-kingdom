-- Add group_name column to puzzle_sets for organizing puzzles into groups
ALTER TABLE puzzle_sets ADD COLUMN group_name VARCHAR(100) DEFAULT NULL AFTER name;

-- Create index for group filtering
CREATE INDEX idx_puzzle_sets_group ON puzzle_sets(group_name);
