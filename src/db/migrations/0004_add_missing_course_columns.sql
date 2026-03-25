-- Add missing columns to courses table that exist in the Drizzle schema but not in the database

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "details" text;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "language" varchar(50);

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "skill_level" varchar(50) DEFAULT 'ALL';

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "has_certificate" boolean DEFAULT false;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "max_students" integer;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "enrollment_deadline" timestamp with time zone;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "course_end_at" timestamp with time zone;

-- Change cpe_credits from integer to numeric to support decimal values like 0.5, 1.5, 2.5
ALTER TABLE "courses"
  ALTER COLUMN "cpe_credits" TYPE numeric(5, 2) USING "cpe_credits"::numeric(5, 2);

ALTER TABLE "courses"
  ALTER COLUMN "cpe_credits" SET DEFAULT 0;
