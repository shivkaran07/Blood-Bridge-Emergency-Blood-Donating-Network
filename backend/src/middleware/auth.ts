import type { RequestHandler } from 'express';
import type { Db } from '../db/database.js';
import type { AuthVerifier } from '../auth/authVerifier.js';
import { buildAuthContext } from '../repositories/userRepository.js';
import { AppError, ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import type { AppRole } from '../types/domain.js';

/**
 * Validates the bearer token, loads roles/account state from the database and
 * rejects suspended accounts. Routes never trust role metadata from the client.
 */
export function createAuthenticate(db: Db, verifier: AuthVerifier): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !/^Bearer\s+/i.test(header)) {
        throw new UnauthorizedError('Sign in to access this resource.');
      }
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (!token) throw new UnauthorizedError('Sign in to access this resource.');

      const user = await verifier.verifyToken(token);
      const auth = await buildAuthContext(db, user);

      if (auth.accountStatus === 'SUSPENDED') {
        throw new AppError(
          403,
          'ACCOUNT_SUSPENDED',
          'This account is suspended. Contact an administrator if you believe this is a mistake.',
        );
      }

      req.auth = auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: AppRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    const allowed = roles.some((role) => req.auth!.roles.includes(role));
    if (!allowed) {
      next(new ForbiddenError('Your account does not have the required role.'));
      return;
    }
    next();
  };
}

export function requireApprovedHospital(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.auth.isApprovedHospital) {
      next(new ForbiddenError('Only an approved hospital verifier can perform this action.'));
      return;
    }
    next();
  };
}

export function requireAdmin(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.auth.isAdmin) {
      next(new ForbiddenError('Administrator access is required.'));
      return;
    }
    next();
  };
}
