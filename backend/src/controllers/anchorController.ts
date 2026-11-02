import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import {
  confirmAnchorOperation,
  listOperationsForViewer,
  reconcileAnchorOperation,
} from '../services/anchorService.js';
import { getBloodRequest } from '../services/requestService.js';
import type { anchorConfirmSchema, operationsQuerySchema } from '../schemas/index.js';
import { getValidatedQuery, parseParams } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/index.js';
import { ok } from '../http/asyncHandler.js';

export async function listBlockchainOperationsController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const query = getValidatedQuery<z.infer<typeof operationsQuerySchema>>(res);
  const operations = await listOperationsForViewer(deps, req.auth!, {
    requestId: query.requestId ?? null,
    limit: query.limit,
  });
  const status = query.status;
  ok(res, {
    items: status ? operations.filter((op) => op.status === status) : operations,
    total: status ? operations.filter((op) => op.status === status).length : operations.length,
    limit: query.limit,
  });
}

export async function confirmAnchorOperationController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof anchorConfirmSchema>;
  const outcome = await confirmAnchorOperation(deps, req.auth!, id, input.transactionHash);
  ok(res, await withRequestDetail(deps, req, outcome));
}

export async function reconcileAnchorOperationController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const { id } = parseParams(idParamSchema, req.params);
  const outcome = await reconcileAnchorOperation(deps, req.auth!, id);
  ok(res, await withRequestDetail(deps, req, outcome));
}

/** Builds the shared operation-outcome envelope with the current request DTO. */
async function withRequestDetail(
  deps: ServiceDeps,
  req: Request,
  outcome: Awaited<ReturnType<typeof confirmAnchorOperation>>,
) {
  const request = await getBloodRequest(deps, req.auth!, outcome.requestId);
  return { verificationMode: 'ON_CHAIN' as const, ...outcome, request };
}
