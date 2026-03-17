import { db } from '../../db/index.js';
import { orders, orderItems, vouchers, transactions } from '../../db/schema/orders.js';
import { users } from '../../db/schema/users.js';
import { courses } from '../../db/schema/courses.js';
import { eq, desc, and, gte, count, sql } from 'drizzle-orm';

export const ordersRepository = {
  async listOrders(limit: number = 20, offset: number = 0) {
    const result = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        userName: users.fullName,
        userEmail: users.email,
        grandTotal: orders.grandTotal,
        discountAmount: orders.discountAmount,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Get item count for each order
    const ordersWithItems = await Promise.all(
      result.map(async (order) => {
        const itemCount = await db
          .select({ count: count() })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));
        return {
          ...order,
          courses: itemCount[0]?.count ?? 0,
        };
      })
    );

    return ordersWithItems;
  },

  async getOrderStats() {
    const totalResult = await db.select({ count: count() }).from(orders);
    const pendingResult = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'PENDING'));
    const paidResult = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'PAID'));
    const cancelledResult = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'CANCELLED'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrdersResult = await db.select({ count: count() }).from(orders).where(gte(orders.createdAt, today));
    const todayRevenueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.grandTotal}), 0)` })
      .from(orders)
      .where(and(eq(orders.status, 'PAID'), gte(orders.createdAt, today)));

    return {
      total: totalResult[0]?.count ?? 0,
      pending: pendingResult[0]?.count ?? 0,
      paid: paidResult[0]?.count ?? 0,
      cancelled: cancelledResult[0]?.count ?? 0,
      todayOrders: todayOrdersResult[0]?.count ?? 0,
      todayRevenue: parseFloat(todayRevenueResult[0]?.total ?? '0'),
    };
  },

  async getOrderById(id: number) {
    const order = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        userName: users.fullName,
        userEmail: users.email,
        voucherId: orders.voucherId,
        grandTotal: orders.grandTotal,
        discountAmount: orders.discountAmount,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, id))
      .limit(1);

    if (!order[0]) return null;

    // Get order items with course info
    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        courseId: orderItems.courseId,
        courseName: courses.title,
        courseImage: courses.thumbnail,
        priceAtPurchase: orderItems.priceAtPurchase,
      })
      .from(orderItems)
      .innerJoin(courses, eq(orderItems.courseId, courses.id))
      .where(eq(orderItems.orderId, id));

    // Get transactions
    const txns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.orderId, id))
      .orderBy(desc(transactions.createdAt));

    // Get voucher if any
    let voucher = null;
    if (order[0].voucherId) {
      const v = await db.query.vouchers.findFirst({
        where: eq(vouchers.id, order[0].voucherId),
      });
      voucher = v || null;
    }

    return {
      ...order[0],
      grandTotal: parseFloat(order[0].grandTotal),
      discountAmount: parseFloat(order[0].discountAmount || '0'),
      voucher,
      orderItems: items.map(i => ({
        ...i,
        priceAtPurchase: parseFloat(i.priceAtPurchase),
      })),
      transactions: txns.map(t => ({
        ...t,
        amount: parseFloat(t.amount),
      })),
    };
  },

  async getOrdersByUserId(userId: number, limit: number = 20, offset: number = 0) {
    const result = await db
      .select({
        id: orders.id,
        grandTotal: orders.grandTotal,
        discountAmount: orders.discountAmount,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const ordersWithItems = await Promise.all(
      result.map(async (order) => {
        const items = await db
          .select({
            courseId: orderItems.courseId,
            courseName: courses.title,
            priceAtPurchase: orderItems.priceAtPurchase,
          })
          .from(orderItems)
          .innerJoin(courses, eq(orderItems.courseId, courses.id))
          .where(eq(orderItems.orderId, order.id));

        return {
          ...order,
          grandTotal: parseFloat(order.grandTotal),
          discountAmount: parseFloat(order.discountAmount || '0'),
          items: items.map(i => ({
            ...i,
            priceAtPurchase: parseFloat(i.priceAtPurchase),
          })),
        };
      })
    );

    const totalResult = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.userId, userId));

    return {
      orders: ordersWithItems,
      total: totalResult[0]?.count ?? 0,
    };
  },

  async updateStatus(id: number, status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED') {
    const [result] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },
};
