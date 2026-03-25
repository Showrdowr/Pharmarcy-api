do $$
begin
  create type "enrollment_status" as enum ('ACTIVE', 'CANCELLED', 'REFUND_PENDING');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "course_refund_request_status" as enum ('PENDING', 'APPROVED', 'REJECTED');
exception
  when duplicate_object then null;
end $$;

alter table "enrollments"
  add column if not exists "status" "enrollment_status" not null default 'ACTIVE',
  add column if not exists "cancelled_at" timestamp with time zone,
  add column if not exists "cancel_reason" text,
  add column if not exists "source_order_item_id" integer references "order_items"("id") on delete set null;

update "enrollments"
set "status" = 'ACTIVE'
where "status" is null;

create table if not exists "course_refund_requests" (
  "id" serial primary key,
  "user_id" integer not null references "users"("id") on delete cascade,
  "course_id" integer not null references "courses"("id") on delete cascade,
  "enrollment_id" integer not null references "enrollments"("id") on delete cascade,
  "order_item_id" integer references "order_items"("id") on delete set null,
  "status" "course_refund_request_status" not null default 'PENDING',
  "reason" text,
  "admin_note" text,
  "requested_at" timestamp with time zone default now(),
  "resolved_at" timestamp with time zone,
  "resolved_by_admin_id" varchar(255)
);

create unique index if not exists "course_refund_requests_enrollment_unique_idx"
  on "course_refund_requests" ("enrollment_id");
