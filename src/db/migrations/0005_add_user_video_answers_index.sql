CREATE UNIQUE INDEX IF NOT EXISTS "user_video_answers_user_question_unique_idx"
  ON "user_video_answers" ("user_id", "video_question_id");
