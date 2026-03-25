create table if not exists "user_lesson_quiz_attempts" (
  "id" serial primary key,
  "user_id" integer not null references "users"("id") on delete cascade,
  "lesson_quiz_id" integer not null references "lesson_quizzes"("id") on delete cascade,
  "score_obtained" numeric(10, 2) not null default '0',
  "total_score" numeric(10, 2) not null default '0',
  "score_percent" numeric(5, 2) not null default '0',
  "is_passed" boolean not null default false,
  "started_at" timestamp with time zone default now(),
  "finished_at" timestamp with time zone default now()
);

create table if not exists "user_lesson_quiz_answers" (
  "id" serial primary key,
  "attempt_id" integer not null references "user_lesson_quiz_attempts"("id") on delete cascade,
  "lesson_quiz_question_id" integer not null references "lesson_quiz_questions"("id") on delete cascade,
  "answer_given" text,
  "is_correct" boolean not null default false,
  "points_earned" numeric(10, 2) not null default '0'
);
