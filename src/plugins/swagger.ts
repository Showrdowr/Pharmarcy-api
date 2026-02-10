import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Pharmacy Academy API',
        description: 'Backend API for Pharmacy Academy Learning Platform',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development server' },
      ],
      tags: [
        { name: 'Users', description: 'User management endpoints' },
        { name: 'Courses', description: 'Course management endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
