import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Generates a correlation id; never trusts a client-supplied id for logging. */
export const requestContext: RequestHandler = (req, res, next) => {
  const id = randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
