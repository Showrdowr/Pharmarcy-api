import { pgTable, foreignKey, serial, integer, varchar, text, jsonb, timestamp, numeric, unique, boolean, uuid, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const courseStatus = pgEnum("course_status", ['DRAFT', 'PUBLISHED', 'ARCHIVED'])
export const discountType = pgEnum("discount_type", ['PERCENTAGE', 'FIXED_AMOUNT'])
export const orderStatus = pgEnum("order_status", ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'])
export const questionType = pgEnum("question_type", ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER'])
export const transactionStatus = pgEnum("transaction_status", ['PENDING', 'SUCCESS', 'FAILED'])
export const userRole = pgEnum("user_role", ['member', 'pharmacist', 'admin'])
export const videoProvider = pgEnum("video_provider", ['YOUTUBE', 'VIMEO', 'CLOUDFLARE', 'S3'])
export const videoStatus = pgEnum("video_status", ['PROCESSING', 'READY', 'FAILED'])


export const lessons = pgTable("lessons", {
	id: serial().primaryKey().notNull(),
	courseId: integer("course_id").notNull(),
	videoId: integer("video_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	sequenceOrder: integer("sequence_order").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "lessons_course_id_courses_id_fk"
		}),
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "lessons_video_id_videos_id_fk"
		}),
]);

export const videoQuestions = pgTable("video_questions", {
	id: serial().primaryKey().notNull(),
	lessonId: integer("lesson_id").notNull(),
	questionText: text("question_text").notNull(),
	displayAtSeconds: integer("display_at_seconds").notNull(),
	questionType: questionType("question_type").notNull(),
	options: jsonb(),
	correctAnswer: text("correct_answer"),
}, (table) => [
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "video_questions_lesson_id_lessons_id_fk"
		}),
]);

export const exams = pgTable("exams", {
	id: serial().primaryKey().notNull(),
	courseId: integer("course_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 255 }),
	passingScorePercent: integer("passing_score_percent").notNull(),
	timeLimitMinutes: integer("time_limit_minutes"),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "exams_course_id_courses_id_fk"
		}),
]);

export const videos = pgTable("videos", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }),
	provider: videoProvider().notNull(),
	resourceId: varchar("resource_id", { length: 255 }).notNull(),
	duration: integer(),
	playbackUrl: text("playback_url"),
	status: videoStatus().default('PROCESSING').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	color: varchar({ length: 50 }),
});

export const courses = pgTable("courses", {
	id: serial().primaryKey().notNull(),
	categoryId: integer("category_id"),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	authorName: varchar("author_name", { length: 255 }),
	price: numeric({ precision: 10, scale:  2 }),
	thumbnail: text(),
	thumbnailMimeType: varchar("thumbnail_mime_type", { length: 255 }),
	previewVideoId: integer("preview_video_id"),
	cpeCredits: integer("cpe_credits").default(0),
	conferenceCode: varchar("conference_code", { length: 255 }),
	status: courseStatus().default('DRAFT').notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	subcategoryId: integer("subcategory_id"),
}, (table) => [
	foreignKey({
			columns: [table.previewVideoId],
			foreignColumns: [videos.id],
			name: "courses_preview_video_id_videos_id_fk"
		}),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "courses_category_id_categories_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.subcategoryId],
			foreignColumns: [subcategories.id],
			name: "courses_subcategory_id_subcategories_id_fk"
		}).onDelete("set null"),
]);

export const cartItems = pgTable("cart_items", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	courseId: integer("course_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cart_items_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "cart_items_course_id_courses_id_fk"
		}),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	voucherId: integer("voucher_id"),
	grandTotal: numeric("grand_total", { precision: 10, scale:  2 }).notNull(),
	paymentMethod: varchar("payment_method", { length: 255 }),
	discountAmount: numeric("discount_amount", { precision: 10, scale:  2 }).default('0.00'),
	status: orderStatus().default('PENDING').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.voucherId],
			foreignColumns: [vouchers.id],
			name: "orders_voucher_id_vouchers_id_fk"
		}),
]);

export const vouchers = pgTable("vouchers", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	discountType: discountType("discount_type").notNull(),
	discountValue: numeric("discount_value", { precision: 10, scale:  2 }).notNull(),
	usageLimit: integer("usage_limit"),
	minOrderAmount: numeric("min_order_amount", { precision: 10, scale:  2 }).default('0.00'),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true),
}, (table) => [
	unique("vouchers_code_unique").on(table.code),
]);

export const examQuestions = pgTable("exam_questions", {
	id: serial().primaryKey().notNull(),
	examId: integer("exam_id").notNull(),
	questionText: text("question_text").notNull(),
	questionType: questionType("question_type").notNull(),
	options: jsonb(),
	scoreWeight: integer("score_weight").notNull(),
	correctAnswer: text("correct_answer"),
}, (table) => [
	foreignKey({
			columns: [table.examId],
			foreignColumns: [exams.id],
			name: "exam_questions_exam_id_exams_id_fk"
		}),
]);

export const orderItems = pgTable("order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	courseId: integer("course_id").notNull(),
	priceAtPurchase: numeric("price_at_purchase", { precision: 10, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "order_items_course_id_courses_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	fullName: varchar("full_name", { length: 255 }),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	role: userRole().default('member').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	professionalLicenseNumber: varchar("professional_license_number", { length: 100 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	resetOtp: varchar("reset_otp", { length: 6 }),
	resetOtpExpiresAt: timestamp("reset_otp_expires_at", { mode: 'string' }),
	failedAttempts: integer("failed_attempts").default(0),
	lastFailedAt: timestamp("last_failed_at", { mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const enrollments = pgTable("enrollments", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	courseId: integer("course_id").notNull(),
	progressPercent: numeric("progress_percent", { precision: 5, scale:  2 }).default('0.00'),
	isCompleted: boolean("is_completed").default(false),
	enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "enrollments_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "enrollments_course_id_courses_id_fk"
		}),
]);

export const certificates = pgTable("certificates", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	courseId: integer("course_id").notNull(),
	certificateCode: varchar("certificate_code", { length: 255 }).notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "certificates_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "certificates_course_id_courses_id_fk"
		}),
	unique("certificates_certificate_code_unique").on(table.certificateCode),
]);

export const userLessonProgress = pgTable("user_lesson_progress", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	lessonId: integer("lesson_id").notNull(),
	lastWatchedSeconds: integer("last_watched_seconds").default(0),
	isCompleted: boolean("is_completed").default(false),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_lesson_progress_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "user_lesson_progress_lesson_id_lessons_id_fk"
		}),
]);

export const userVideoAnswers = pgTable("user_video_answers", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	videoQuestionId: integer("video_question_id").notNull(),
	answerGiven: text("answer_given"),
	isCorrect: boolean("is_correct"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_video_answers_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.videoQuestionId],
			foreignColumns: [videoQuestions.id],
			name: "user_video_answers_video_question_id_video_questions_id_fk"
		}),
]);

export const userExamAttempts = pgTable("user_exam_attempts", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	examId: integer("exam_id").notNull(),
	scoreObtained: numeric("score_obtained", { precision: 10, scale:  2 }),
	totalScore: numeric("total_score", { precision: 10, scale:  2 }),
	isPassed: boolean("is_passed"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_exam_attempts_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.examId],
			foreignColumns: [exams.id],
			name: "user_exam_attempts_exam_id_exams_id_fk"
		}),
]);

export const userExamAnswers = pgTable("user_exam_answers", {
	id: serial().primaryKey().notNull(),
	attemptId: integer("attempt_id").notNull(),
	examQuestionId: integer("exam_question_id").notNull(),
	isCorrect: boolean("is_correct"),
	pointsEarned: numeric("points_earned", { precision: 10, scale:  2 }),
}, (table) => [
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [userExamAttempts.id],
			name: "user_exam_answers_attempt_id_user_exam_attempts_id_fk"
		}),
	foreignKey({
			columns: [table.examQuestionId],
			foreignColumns: [examQuestions.id],
			name: "user_exam_answers_exam_question_id_exam_questions_id_fk"
		}),
]);

export const transactions = pgTable("transactions", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	transactionRefId: varchar("transaction_ref_id", { length: 255 }).notNull(),
	gateway: varchar({ length: 255 }),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	status: transactionStatus().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "transactions_order_id_orders_id_fk"
		}),
	unique("transactions_transaction_ref_id_unique").on(table.transactionRefId),
]);

export const subcategories = pgTable("subcategories", {
	id: serial().primaryKey().notNull(),
	categoryId: integer("category_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	color: varchar({ length: 50 }),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "subcategories_category_id_categories_id_fk"
		}).onDelete("cascade"),
]);

export const adminLoginLogs = pgTable("admin_login_logs", {
	id: uuid().primaryKey().notNull(),
	adminId: uuid("admin_id"),
	status: varchar({ length: 20 }).notNull(),
	ipAddress: varchar("ip_address", { length: 100 }),
	userAgent: text("user_agent"),
	createAt: timestamp("create_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [adminUser.id],
			name: "admin_login_logs_admin_id_admin_user_id_fk"
		}).onDelete("cascade"),
]);

export const adminUser = pgTable("admin_user", {
	id: uuid().primaryKey().notNull(),
	username: varchar({ length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	createAt: timestamp("create_at", { mode: 'string' }).defaultNow(),
	updateAt: timestamp("update_at", { mode: 'string' }).defaultNow(),
	failedAttempts: integer("failed_attempts").default(0),
	lastFailedAt: timestamp("last_failed_at", { mode: 'string' }),
	department: varchar({ length: 100 }),
	major: varchar({ length: 100 }),
}, (table) => [
	unique("admin_user_username_unique").on(table.username),
	unique("admin_user_email_unique").on(table.email),
]);

export const roles = pgTable("roles", {
	id: uuid().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	createAt: timestamp("create_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("roles_name_unique").on(table.name),
]);

export const permissions = pgTable("permissions", {
	id: uuid().primaryKey().notNull(),
	code: varchar({ length: 100 }).notNull(),
	description: text(),
	createAt: timestamp("create_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("permissions_code_unique").on(table.code),
]);

export const adminAuditLogs = pgTable("admin_audit_logs", {
	id: uuid().primaryKey().notNull(),
	adminId: uuid("admin_id").notNull(),
	action: varchar({ length: 100 }).notNull(),
	targetTable: varchar("target_table", { length: 100 }),
	targetId: uuid("target_id"),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	ipAddress: varchar("ip_address", { length: 100 }),
	createAt: timestamp("create_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [adminUser.id],
			name: "admin_audit_logs_admin_id_admin_user_id_fk"
		}).onDelete("set null"),
]);

export const adminUserRoles = pgTable("admin_user_roles", {
	adminId: uuid("admin_id").notNull(),
	roleId: uuid("role_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [adminUser.id],
			name: "admin_user_roles_admin_id_admin_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "admin_user_roles_role_id_roles_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.adminId, table.roleId], name: "admin_user_roles_admin_id_role_id_pk"}),
]);

export const rolePermissions = pgTable("role_permissions", {
	roleId: uuid("role_id").notNull(),
	permissionId: uuid("permission_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_roles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.roleId, table.permissionId], name: "role_permissions_role_id_permission_id_pk"}),
]);
