import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, isCheckViolation, isUniqueViolation } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

function pgConstraint(error: unknown): string {
  return (error as { constraint?: string }).constraint ?? '';
}

function uniqueViolationMessage(constraint: string): string {
  switch (constraint) {
    case 'blood_requests_active_duplicate_idx':
      return 'An active request with the same blood group, hospital and required-by time already exists.';
    case 'donor_responses_active_unique_idx':
    case 'donor_responses_unique_pair':
      return 'You already have an active response for this request.';
    case 'hospital_profiles_registration_number_key':
      return 'A hospital application with this registration number already exists.';
    case 'user_roles_unique':
      return 'This role is already assigned.';
    default:
      return 'This record already exists.';
  }
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const requestId = req.requestId;

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        requestId,
      });
      return;
    }

    if (error instanceof ZodError) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        requestId,
      });
      return;
    }

    if (isUniqueViolation(error)) {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_RECORD',
          message: uniqueViolationMessage(pgConstraint(error)),
        },
        requestId,
      });
      return;
    }

    if (isCheckViolation(error)) {
      res.status(422).json({
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'The submitted values violate a data rule.',
        },
        requestId,
      });
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' },
        requestId,
      });
      return;
    }

    const statusCode = (error as { status?: number; statusCode?: number }).status
      ?? (error as { statusCode?: number }).statusCode;
    if (statusCode === 413) {
      res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
        requestId,
      });
      return;
    }

    // CORS rejection
    if ((error as Error).message === 'Origin not allowed') {
      res.status(403).json({
        error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed to call the API.' },
        requestId,
      });
      return;
    }

    const log = (req as unknown as { log?: Logger }).log ?? logger;
    log.error(
      {
        err: error,
        requestId,
        method: req.method,
        path: req.path,
      },
      'Unhandled request error',
    );

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side. Please try again.',
      },
      requestId,
    });
  };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No API route matches ${req.method} ${req.path}.`,
    },
    requestId: req.requestId,
  });
};
