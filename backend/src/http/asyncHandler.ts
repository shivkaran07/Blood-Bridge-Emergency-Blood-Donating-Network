import type { Request, RequestHandler, Response } from 'express';

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;

/**
 * Express 5 forwards rejected promises automatically, but wrapping keeps the
 * intent explicit and works identically for every handler we write.
 */
export function asyncHandler(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function ok(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({ data });
}
