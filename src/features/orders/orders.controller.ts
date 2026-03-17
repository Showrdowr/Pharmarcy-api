import { FastifyRequest, FastifyReply } from 'fastify';
import { ordersRepository } from './orders.repository.js';
import type { ListOrdersQuery, UpdateOrderStatusInput } from './orders.schema.js';

export const ordersController = {
  async listOrders(
    request: FastifyRequest<{ Querystring: ListOrdersQuery }>,
    reply: FastifyReply
  ) {
    const { page, limit } = request.query;
    const offset = (page - 1) * limit;

    const [ordersList, stats] = await Promise.all([
      ordersRepository.listOrders(limit, offset),
      ordersRepository.getOrderStats(),
    ]);

    const orders = ordersList.map(o => ({
      id: String(o.id),
      orderNumber: `ORD-${String(o.id).padStart(6, '0')}`,
      user: o.userName || 'Unknown',
      userEmail: o.userEmail || '',
      courses: o.courses,
      totalAmount: parseFloat(o.grandTotal),
      status: o.status,
      paymentMethod: o.paymentMethod || '',
      createdAt: o.createdAt,
    }));

    return reply.send({ data: { orders, stats } });
  },

  async getOrderById(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const order = await ordersRepository.getOrderById(request.params.id);

    if (!order) {
      return reply.status(404).send({ success: false, error: 'ไม่พบคำสั่งซื้อ' });
    }

    return reply.send({ data: order });
  },

  async updateStatus(
    request: FastifyRequest<{ Params: { id: number }; Body: UpdateOrderStatusInput }>,
    reply: FastifyReply
  ) {
    const result = await ordersRepository.updateStatus(request.params.id, request.body.status);

    if (!result) {
      return reply.status(404).send({ success: false, error: 'ไม่พบคำสั่งซื้อ' });
    }

    return reply.send({ success: true, data: result });
  },

  async cancelOrder(
    request: FastifyRequest<{ Params: { id: number }; Body: { reason?: string } }>,
    reply: FastifyReply
  ) {
    const result = await ordersRepository.updateStatus(request.params.id, 'CANCELLED');

    if (!result) {
      return reply.status(404).send({ success: false, error: 'ไม่พบคำสั่งซื้อ' });
    }

    return reply.send({ success: true, message: 'ยกเลิกคำสั่งซื้อสำเร็จ' });
  },

  async getMyOrders(
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply
  ) {
    const userId = (request.user as any)?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    const page = request.query.page || 1;
    const limit = request.query.limit || 10;
    const offset = (page - 1) * limit;

    const result = await ordersRepository.getOrdersByUserId(userId, limit, offset);

    const orders = result.orders.map(o => ({
      id: String(o.id),
      orderNumber: `ORD-${String(o.id).padStart(6, '0')}`,
      items: o.items.map(i => ({
        courseId: i.courseId,
        title: i.courseName,
        price: i.priceAtPurchase,
      })),
      subtotal: o.grandTotal + o.discountAmount,
      discount: o.discountAmount,
      total: o.grandTotal,
      paymentMethod: o.paymentMethod || '',
      status: o.status,
      createdAt: o.createdAt,
    }));

    return reply.send({
      data: {
        orders,
        total: result.total,
        page,
        limit,
      },
    });
  },

  async refundOrder(
    request: FastifyRequest<{ Params: { id: number }; Body: { amount: number } }>,
    reply: FastifyReply
  ) {
    const result = await ordersRepository.updateStatus(request.params.id, 'REFUNDED');

    if (!result) {
      return reply.status(404).send({ success: false, error: 'ไม่พบคำสั่งซื้อ' });
    }

    return reply.send({ success: true, message: 'คืนเงินสำเร็จ' });
  },
};
