ALTER TABLE questions ADD COLUMN IF NOT EXISTS double_points BOOLEAN DEFAULT FALSE;
UPDATE questions SET double_points = FALSE WHERE double_points IS NULL;