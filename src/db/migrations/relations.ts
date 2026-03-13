import { relations } from "drizzle-orm/relations";
import { courses, lessons, videos, videoQuestions, exams, categories, subcategories, users, cartItems, orders, vouchers, examQuestions, orderItems, enrollments, certificates, userLessonProgress, userVideoAnswers, userExamAttempts, userExamAnswers, transactions, adminUser, adminLoginLogs, adminAuditLogs, adminUserRoles, roles, rolePermissions, permissions } from "./schema";

export const lessonsRelations = relations(lessons, ({one, many}) => ({
	course: one(courses, {
		fields: [lessons.courseId],
		references: [courses.id]
	}),
	video: one(videos, {
		fields: [lessons.videoId],
		references: [videos.id]
	}),
	videoQuestions: many(videoQuestions),
	userLessonProgresses: many(userLessonProgress),
}));

export const coursesRelations = relations(courses, ({one, many}) => ({
	lessons: many(lessons),
	exams: many(exams),
	video: one(videos, {
		fields: [courses.previewVideoId],
		references: [videos.id]
	}),
	category: one(categories, {
		fields: [courses.categoryId],
		references: [categories.id]
	}),
	subcategory: one(subcategories, {
		fields: [courses.subcategoryId],
		references: [subcategories.id]
	}),
	cartItems: many(cartItems),
	orderItems: many(orderItems),
	enrollments: many(enrollments),
	certificates: many(certificates),
}));

export const videosRelations = relations(videos, ({many}) => ({
	lessons: many(lessons),
	courses: many(courses),
}));

export const videoQuestionsRelations = relations(videoQuestions, ({one, many}) => ({
	lesson: one(lessons, {
		fields: [videoQuestions.lessonId],
		references: [lessons.id]
	}),
	userVideoAnswers: many(userVideoAnswers),
}));

export const examsRelations = relations(exams, ({one, many}) => ({
	course: one(courses, {
		fields: [exams.courseId],
		references: [courses.id]
	}),
	examQuestions: many(examQuestions),
	userExamAttempts: many(userExamAttempts),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	courses: many(courses),
	subcategories: many(subcategories),
}));

export const subcategoriesRelations = relations(subcategories, ({one, many}) => ({
	courses: many(courses),
	category: one(categories, {
		fields: [subcategories.categoryId],
		references: [categories.id]
	}),
}));

export const cartItemsRelations = relations(cartItems, ({one}) => ({
	user: one(users, {
		fields: [cartItems.userId],
		references: [users.id]
	}),
	course: one(courses, {
		fields: [cartItems.courseId],
		references: [courses.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	cartItems: many(cartItems),
	orders: many(orders),
	enrollments: many(enrollments),
	certificates: many(certificates),
	userLessonProgresses: many(userLessonProgress),
	userVideoAnswers: many(userVideoAnswers),
	userExamAttempts: many(userExamAttempts),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	voucher: one(vouchers, {
		fields: [orders.voucherId],
		references: [vouchers.id]
	}),
	orderItems: many(orderItems),
	transactions: many(transactions),
}));

export const vouchersRelations = relations(vouchers, ({many}) => ({
	orders: many(orders),
}));

export const examQuestionsRelations = relations(examQuestions, ({one, many}) => ({
	exam: one(exams, {
		fields: [examQuestions.examId],
		references: [exams.id]
	}),
	userExamAnswers: many(userExamAnswers),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	course: one(courses, {
		fields: [orderItems.courseId],
		references: [courses.id]
	}),
}));

export const enrollmentsRelations = relations(enrollments, ({one}) => ({
	user: one(users, {
		fields: [enrollments.userId],
		references: [users.id]
	}),
	course: one(courses, {
		fields: [enrollments.courseId],
		references: [courses.id]
	}),
}));

export const certificatesRelations = relations(certificates, ({one}) => ({
	user: one(users, {
		fields: [certificates.userId],
		references: [users.id]
	}),
	course: one(courses, {
		fields: [certificates.courseId],
		references: [courses.id]
	}),
}));

export const userLessonProgressRelations = relations(userLessonProgress, ({one}) => ({
	user: one(users, {
		fields: [userLessonProgress.userId],
		references: [users.id]
	}),
	lesson: one(lessons, {
		fields: [userLessonProgress.lessonId],
		references: [lessons.id]
	}),
}));

export const userVideoAnswersRelations = relations(userVideoAnswers, ({one}) => ({
	user: one(users, {
		fields: [userVideoAnswers.userId],
		references: [users.id]
	}),
	videoQuestion: one(videoQuestions, {
		fields: [userVideoAnswers.videoQuestionId],
		references: [videoQuestions.id]
	}),
}));

export const userExamAttemptsRelations = relations(userExamAttempts, ({one, many}) => ({
	user: one(users, {
		fields: [userExamAttempts.userId],
		references: [users.id]
	}),
	exam: one(exams, {
		fields: [userExamAttempts.examId],
		references: [exams.id]
	}),
	userExamAnswers: many(userExamAnswers),
}));

export const userExamAnswersRelations = relations(userExamAnswers, ({one}) => ({
	userExamAttempt: one(userExamAttempts, {
		fields: [userExamAnswers.attemptId],
		references: [userExamAttempts.id]
	}),
	examQuestion: one(examQuestions, {
		fields: [userExamAnswers.examQuestionId],
		references: [examQuestions.id]
	}),
}));

export const transactionsRelations = relations(transactions, ({one}) => ({
	order: one(orders, {
		fields: [transactions.orderId],
		references: [orders.id]
	}),
}));

export const adminLoginLogsRelations = relations(adminLoginLogs, ({one}) => ({
	adminUser: one(adminUser, {
		fields: [adminLoginLogs.adminId],
		references: [adminUser.id]
	}),
}));

export const adminUserRelations = relations(adminUser, ({many}) => ({
	adminLoginLogs: many(adminLoginLogs),
	adminAuditLogs: many(adminAuditLogs),
	adminUserRoles: many(adminUserRoles),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({one}) => ({
	adminUser: one(adminUser, {
		fields: [adminAuditLogs.adminId],
		references: [adminUser.id]
	}),
}));

export const adminUserRolesRelations = relations(adminUserRoles, ({one}) => ({
	adminUser: one(adminUser, {
		fields: [adminUserRoles.adminId],
		references: [adminUser.id]
	}),
	role: one(roles, {
		fields: [adminUserRoles.roleId],
		references: [roles.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	adminUserRoles: many(adminUserRoles),
	rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));