import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // Zod validation error
  if (error instanceof ZodError) {
    const zodError = error as ZodError;
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: 'Invalid request data',
      details: zodError.issues,
    });
  }

  // Fastify validation error
  if (error.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: error.message,
    });
  }

  // Default error
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    statusCode,
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
  });
}
