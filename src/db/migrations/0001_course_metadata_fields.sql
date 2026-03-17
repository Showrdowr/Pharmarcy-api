DO $$
BEGIN
    CREATE TYPE course_skill_level AS ENUM ('ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS language varchar(50),
    ADD COLUMN IF NOT EXISTS skill_level course_skill_level NOT NULL DEFAULT 'ALL',
    ADD COLUMN IF NOT EXISTS has_certificate boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS enrollment_deadline timestamptz;
