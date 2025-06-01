-- Add points column with default value 1000
ALTER TABLE questions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 1000;

-- Add double_points column with default value false
ALTER TABLE questions ADD COLUMN IF NOT EXISTS double_points BOOLEAN DEFAULT FALSE;

-- Add question_type column with default value 'multiple_choice'
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) DEFAULT 'multiple_choice';

-- Add column for random question order to quizzes table
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS random_questions BOOLEAN DEFAULT FALSE;

-- Create achievements table if it doesn't exist
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_achievements junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_achievements (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id),
  game_session_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, achievement_id, game_session_id)
);

-- Update any existing NULL values to defaults
UPDATE questions SET points = 1000 WHERE points IS NULL;
UPDATE questions SET double_points = FALSE WHERE double_points IS NULL;
UPDATE questions SET question_type = 'multiple_choice' WHERE question_type IS NULL;
UPDATE quizzes SET random_questions = FALSE WHERE random_questions IS NULL; 