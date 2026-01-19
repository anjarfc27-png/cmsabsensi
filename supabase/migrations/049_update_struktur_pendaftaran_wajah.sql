-- Update face_enrollments table structure
-- Add missing columns if they don't exist

-- Add enrollment_date column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'face_enrollments' 
        AND column_name = 'enrollment_date'
    ) THEN
        ALTER TABLE face_enrollments 
        ADD COLUMN enrollment_date TIMESTAMPTZ DEFAULT now() NOT NULL;
    END IF;
END $$;

-- Add updated_at column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'face_enrollments' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE face_enrollments 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
    END IF;
END $$;

-- Make sure is_active column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'face_enrollments' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE face_enrollments 
        ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
END $$;

-- Show current structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'face_enrollments'
ORDER BY ordinal_position;
