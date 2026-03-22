ALTER TABLE "enrollments"
  ADD COLUMN IF NOT EXISTS "watch_percent" numeric(5, 2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS "last_accessed_lesson_id" integer;

DO $$
BEGIN
  ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_last_accessed_lesson_id_lessons_id_fk"
    FOREIGN KEY ("last_accessed_lesson_id")
    REFERENCES "lessons"("id")
    ON DELETE SET NULL
    ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

WITH latest_progress AS (
  SELECT
    e.id AS enrollment_id,
    ulp.lesson_id,
    ROW_NUMBER() OVER (
      PARTITION BY e.id
      ORDER BY ulp.updated_at DESC, ulp.lesson_id DESC
    ) AS row_number
  FROM "enrollments" e
  JOIN "lessons" l
    ON l.course_id = e.course_id
  JOIN "user_lesson_progress" ulp
    ON ulp.user_id = e.user_id
   AND ulp.lesson_id = l.id
)
UPDATE "enrollments" e
SET "last_accessed_lesson_id" = latest_progress.lesson_id
FROM latest_progress
WHERE e.id = latest_progress.enrollment_id
  AND latest_progress.row_number = 1
  AND e."last_accessed_lesson_id" IS NULL;

WITH lesson_watch AS (
  SELECT
    e.id AS enrollment_id,
    COALESCE(SUM(GREATEST(COALESCE(v.duration, 0), 0)), 0) AS total_duration,
    COALESCE(
      SUM(
        LEAST(
          GREATEST(COALESCE(v.duration, 0), 0),
          GREATEST(
            CASE
              WHEN COALESCE(ulp.is_completed, false) THEN COALESCE(v.duration, 0)
              ELSE COALESCE(ulp.last_watched_seconds, 0)
            END,
            0
          )
        )
      ),
      0
    ) AS watched_seconds
  FROM "enrollments" e
  LEFT JOIN "lessons" l
    ON l.course_id = e.course_id
  LEFT JOIN "videos" v
    ON v.id = l.video_id
  LEFT JOIN "user_lesson_progress" ulp
    ON ulp.user_id = e.user_id
   AND ulp.lesson_id = l.id
  GROUP BY e.id
)
UPDATE "enrollments" e
SET "watch_percent" = CASE
  WHEN lesson_watch.total_duration <= 0 THEN '0.00'
  ELSE ROUND((lesson_watch.watched_seconds::numeric / lesson_watch.total_duration::numeric) * 100, 2)
END
FROM lesson_watch
WHERE e.id = lesson_watch.enrollment_id;

UPDATE "enrollments"
SET "watch_percent" = COALESCE("watch_percent", '0.00');
