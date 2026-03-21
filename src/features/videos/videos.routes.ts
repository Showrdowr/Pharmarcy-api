import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { videosController } from './videos.controller.js';
import { videoListQuerySchema, videoIdParamsSchema } from './videos.schema.js';

export async function videosRoutes(app: FastifyInstance) {
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', app.authenticate);

    const typedApp = protectedApp.withTypeProvider<ZodTypeProvider>();

    typedApp.get('/videos', {
      schema: {
        tags: ['Videos'],
        summary: 'List all videos with stats and usage',
        querystring: videoListQuerySchema,
      },
      handler: videosController.listVideos,
    });

    typedApp.get('/videos/:id', {
      schema: {
        tags: ['Videos'],
        summary: 'Get video by ID',
        params: videoIdParamsSchema,
      },
      handler: videosController.getVideo,
    });

    typedApp.post('/videos/:id/sync-status', {
      schema: {
        tags: ['Videos'],
        summary: 'Sync video status from Vimeo',
        params: videoIdParamsSchema,
      },
      handler: videosController.syncVideoStatus,
    });
  });
}
