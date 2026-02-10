import { FastifyRequest, FastifyReply } from 'fastify';
import { userService } from './user.service.js';
import { CreateUserInput, UpdateUserInput } from './user.schema.js';

export const userController = {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const users = await userService.getAllUsers();
    return reply.send(users);
  },

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = await userService.getUserById(request.params.id);
    return reply.send(user);
  },

  async create(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply
  ) {
    const user = await userService.createUser(request.body);
    return reply.status(201).send(user);
  },

  async update(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserInput }>,
    reply: FastifyReply
  ) {
    const user = await userService.updateUser(request.params.id, request.body);
    return reply.send(user);
  },

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    await userService.deleteUser(request.params.id);
    return reply.status(204).send();
  },
};
