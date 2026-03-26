WITH duplicate_groups AS (
  SELECT
    "user_id",
    "lesson_id",
    MAX(COALESCE("last_watched_seconds", 0)) AS "max_last_watched_seconds",
    BOOL_OR(COALESCE("is_completed", false)) AS "any_completed",
    MAX(COALESCE("updated_at", now())) AS "latest_updated_at",
    (
      ARRAY_AGG(
        "id"
        ORDER BY COALESCE("updated_at", to_timestamp(0)) DESC, "id" DESC
      )
    )[1] AS "keep_id"
  FROM "user_lesson_progress"
  GROUP BY "user_id", "lesson_id"
  HAVING COUNT(*) > 1
),
updated_duplicates AS (
  UPDATE "user_lesson_progress" AS ulp
  SET
    "last_watched_seconds" = duplicate_groups."max_last_watched_seconds",
    "is_completed" = duplicate_groups."any_completed",
    "updated_at" = duplicate_groups."latest_updated_at"
  FROM duplicate_groups
  WHERE ulp."id" = duplicate_groups."keep_id"
  RETURNING ulp."id"
)
DELETE FROM "user_lesson_progress" AS ulp
USING duplicate_groups
WHERE ulp."user_id" = duplicate_groups."user_id"
  AND ulp."lesson_id" = duplicate_groups."lesson_id"
  AND ulp."id" <> duplicate_groups."keep_id";

CREATE UNIQUE INDEX IF NOT EXISTS "user_lesson_progress_user_lesson_unique_idx"
  ON "user_lesson_progress" ("user_id", "lesson_id");
