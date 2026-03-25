DO $$
BEGIN
  CREATE TYPE "course_audience" AS ENUM ('all', 'general', 'pharmacist');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "audience" "course_audience" DEFAULT 'all';

UPDATE "courses"
SET "audience" = 'all'
WHERE "audience" IS NULL;

ALTER TABLE "courses"
  ALTER COLUMN "audience" SET DEFAULT 'all';

ALTER TABLE "courses"
  ALTER COLUMN "audience" SET NOT NULL;
