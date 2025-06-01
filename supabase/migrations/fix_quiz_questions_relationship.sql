-- Fix relationship between quizzes and questions tables

-- First check if tables exist
DO $$
DECLARE
  quizzes_exists BOOLEAN;
  questions_exists BOOLEAN;
  question_options_exists BOOLEAN;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'quizzes'
  ) INTO quizzes_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'questions'
  ) INTO questions_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'question_options'
  ) INTO question_options_exists;
  
  -- If both tables exist, check and fix the relationship
  IF quizzes_exists AND questions_exists THEN
    -- Check if quiz_id column exists in questions table
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'questions' 
      AND column_name = 'quiz_id'
    ) THEN
      -- Add quiz_id column
      ALTER TABLE public.questions ADD COLUMN quiz_id UUID;
      
      -- Add foreign key constraint if needed
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'questions' 
        AND ccu.table_name = 'quizzes'
      ) THEN
        ALTER TABLE public.questions ADD CONSTRAINT questions_quiz_id_fkey 
          FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
      END IF;
      
      RAISE NOTICE 'Added quiz_id column to questions table';
    END IF;
    
    -- Create index for better performance if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'questions' AND indexname = 'questions_quiz_id_idx'
    ) THEN
      CREATE INDEX questions_quiz_id_idx ON public.questions(quiz_id);
      RAISE NOTICE 'Created index on questions.quiz_id';
    END IF;
  END IF;
  
  -- Fix relationship between questions and question_options if needed
  IF questions_exists AND question_options_exists THEN
    -- Check if question_id column exists in question_options table
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'question_options' 
      AND column_name = 'question_id'
    ) THEN
      -- Add question_id column
      ALTER TABLE public.question_options ADD COLUMN question_id UUID;
      
      -- Add foreign key constraint if needed
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'question_options' 
        AND ccu.table_name = 'questions'
      ) THEN
        ALTER TABLE public.question_options ADD CONSTRAINT question_options_question_id_fkey 
          FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
      END IF;
      
      RAISE NOTICE 'Added question_id column to question_options table';
    END IF;
    
    -- Create index for better performance if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'question_options' AND indexname = 'question_options_question_id_idx'
    ) THEN
      CREATE INDEX question_options_question_id_idx ON public.question_options(question_id);
      RAISE NOTICE 'Created index on question_options.question_id';
    END IF;
  END IF;
  
  -- In case the tables don't exist yet, create basic structure
  IF NOT quizzes_exists THEN
    CREATE TABLE public.quizzes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      description TEXT,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      random_questions BOOLEAN DEFAULT FALSE
    );
    
    CREATE INDEX quizzes_created_by_idx ON public.quizzes(created_by);
    RAISE NOTICE 'Created quizzes table';
  END IF;
  
  IF NOT questions_exists THEN
    CREATE TABLE public.questions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      points INTEGER DEFAULT 1000,
      double_points BOOLEAN DEFAULT FALSE,
      question_type VARCHAR(20) DEFAULT 'multiple_choice',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
    );
    
    CREATE INDEX questions_quiz_id_idx ON public.questions(quiz_id);
    RAISE NOTICE 'Created questions table';
  END IF;
  
  IF NOT question_options_exists THEN
    CREATE TABLE public.question_options (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
    );
    
    CREATE INDEX question_options_question_id_idx ON public.question_options(question_id);
    RAISE NOTICE 'Created question_options table';
  END IF;
END $$; 