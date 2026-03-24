DO $$
BEGIN
  CREATE TYPE "video_status" AS ENUM ('PROCESSING', 'READY', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "videos"
  ADD COLUMN IF NOT EXISTS "status" "video_status" NOT NULL DEFAULT 'PROCESSING';

ALTER TABLE "videos"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

ALTER TABLE "video_questions"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

ALTER TABLE "user_video_answers"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS "lesson_documents" (
  "id" serial PRIMARY KEY,
  "lesson_id" integer NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "file_name" varchar(255) NOT NULL,
  "mime_type" varchar(255) NOT NULL,
  "size_bytes" integer NOT NULL,
  "file_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lesson_quizzes" (
  "id" serial PRIMARY KEY,
  "lesson_id" integer NOT NULL UNIQUE REFERENCES "lessons"("id") ON DELETE CASCADE,
  "passing_score_percent" integer NOT NULL DEFAULT 70,
  "max_attempts" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lesson_quiz_questions" (
  "id" serial PRIMARY KEY,
  "lesson_quiz_id" integer NOT NULL REFERENCES "lesson_quizzes"("id") ON DELETE CASCADE,
  "question_text" text NOT NULL,
  "question_type" "question_type" NOT NULL,
  "options" jsonb,
  "correct_answer" text,
  "score_weight" integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "course_related_courses" (
  "id" serial PRIMARY KEY,
  "course_id" integer NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "related_course_id" integer NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_related_courses_unique_idx"
  ON "course_related_courses" ("course_id", "related_course_id");
