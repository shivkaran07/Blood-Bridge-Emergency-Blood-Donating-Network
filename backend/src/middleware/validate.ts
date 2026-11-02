import type { RequestHandler, Response } from 'express';
import { z, ZodError, type ZodType } from 'zod';
import { ValidationError } from '../lib/errors.js';

function issuesFrom(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new ValidationError(
          'Some fields are invalid. Please review the highlighted fields.',
          issuesFrom(result.error),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('Invalid query parameters.', issuesFrom(result.error)));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}

export function getValidatedQuery<T>(res: Response): T {
  return res.locals.query as T;
}

/** Parses and validates route params (e.g. `:id`) inside a controller. */
export function parseParams<T>(schema: ZodType<T>, params: unknown): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError('Invalid resource identifier.', issuesFrom(result.error));
  }
  return result.data;
}

export const idParamSchema = z.object({ id: z.string().uuid('Invalid identifier') });
