import type { FastifyRequest, FastifyReply } from 'fastify';
import { coursesService } from '../courses/courses.service.js';
import type { VideoListQuery, VideoIdParams } from './videos.schema.js';

export const videosController = {
  async listVideos(request: FastifyRequest<{ Querystring: VideoListQuery }>, reply: FastifyReply) {
    const { used, ...rest } = request.query;
    const filters = {
      ...rest,
      used: used === 'true' ? true : used === 'false' ? false : undefined,
    };
    const result = await coursesService.listVideos(filters);
    return reply.send({ success: true, data: result });
  },

  async getVideo(request: FastifyRequest<{ Params: VideoIdParams }>, reply: FastifyReply) {
    const video = await coursesService.getVideo(request.params.id);
    if (!video) {
      return reply.status(404).send({ success: false, message: 'ไม่พบวิดีโอ' });
    }
    return reply.send({ success: true, data: video });
  },

  async syncVideoStatus(request: FastifyRequest<{ Params: VideoIdParams }>, reply: FastifyReply) {
    const result = await coursesService.syncVideoStatus(request.params.id);
    if (!result) {
      return reply.status(404).send({ success: false, message: 'ไม่พบวิดีโอ' });
    }
    return reply.send({ success: true, data: result });
  },
};
