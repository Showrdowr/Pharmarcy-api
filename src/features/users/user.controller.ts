import { FastifyRequest, FastifyReply } from 'fastify';
import { userService } from './user.service.js';
import { CreateUserInput, UpdateUserInput } from './user.schema.js';

export const userController = {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const users = await userService.getAllUsers();
    return reply.send(users);
  },

  async getById(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const user = await userService.getUserById(Number(request.params.id));
    return reply.send({
      success: true,
      data: user,
    });
  },

  async getOverview(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const overview = await userService.getUserOverview(Number(request.params.id));
    return reply.send({
      success: true,
      data: overview,
    });
  },

  async create(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply
  ) {
    const user = await userService.createUser(request.body);
    return reply.status(201).send({
      success: true,
      data: user,
    });
  },

  async update(
    request: FastifyRequest<{ Params: { id: number }; Body: UpdateUserInput }>,
    reply: FastifyReply
  ) {
    const user = await userService.updateUser(Number(request.params.id), request.body);
    return reply.send({
      success: true,
      data: user,
    });
  },

  async delete(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    await userService.deleteUser(Number(request.params.id));
    return reply.send({
      success: true,
    });
  },
};
