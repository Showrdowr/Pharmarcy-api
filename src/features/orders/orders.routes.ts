import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ordersController } from './orders.controller.js';
import {
  orderParamsSchema,
  listOrdersQuerySchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  refundOrderSchema,
} from './orders.schema.js';

export async function ordersRoutes(app: FastifyInstance) {
  // User route: GET /orders/my (authenticated, no admin required)
  app.addHook('onRequest', app.authenticate);

  app.withTypeProvider<ZodTypeProvider>().get('/orders/my', {
    schema: {
      tags: ['Orders'],
      summary: 'Get current user order history',
      querystring: listOrdersQuerySchema,
    },
    handler: ordersController.getMyOrders,
  });

  // Admin routes
  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', app.requireRole('admin', 'super_admin'));

    const typedApp = adminApp.withTypeProvider<ZodTypeProvider>();

    typedApp.get('/orders', {
      schema: {
        tags: ['Admin - Orders'],
        summary: 'List all orders with stats (Admin only)',
        querystring: listOrdersQuerySchema,
      },
      handler: ordersController.listOrders,
    });

    typedApp.get('/orders/:id', {
      schema: {
        tags: ['Admin - Orders'],
        summary: 'Get order by ID (Admin only)',
        params: orderParamsSchema,
      },
      handler: ordersController.getOrderById,
    });

    typedApp.put('/orders/:id/status', {
      schema: {
        tags: ['Admin - Orders'],
        summary: 'Update order status (Admin only)',
        params: orderParamsSchema,
        body: updateOrderStatusSchema,
      },
      handler: ordersController.updateStatus,
    });

    typedApp.post('/orders/:id/cancel', {
      schema: {
        tags: ['Admin - Orders'],
        summary: 'Cancel an order (Admin only)',
        params: orderParamsSchema,
        body: cancelOrderSchema,
      },
      handler: ordersController.cancelOrder,
    });

    typedApp.post('/orders/:id/refund', {
      schema: {
        tags: ['Admin - Orders'],
        summary: 'Refund an order (Admin only)',
        params: orderParamsSchema,
        body: refundOrderSchema,
      },
      handler: ordersController.refundOrder,
    });
  });
}
