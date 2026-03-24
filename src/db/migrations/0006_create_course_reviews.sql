CREATE TABLE IF NOT EXISTS "course_reviews" (
  "id" serial PRIMARY KEY,
  "course_id" integer NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
  "title" varchar(255),
  "body" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_reviews_unique_idx"
  ON "course_reviews" ("course_id", "user_id");
