ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "max_students" integer;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "course_end_at" timestamp with time zone;
