import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import {
  cancelBloodRequest,
  chainCompleteRequest,
  claimRequestForReview,
  completeRequest,
  createBloodRequest,
  getBloodRequest,
  getRequestHistory,
  listMyRequests,
  listRequestFeedForViewer,
  rejectRequest,
  verifyRequest,
} from '../services/requestService.js';
import { createDonorResponse, listResponsesForOwnRequest } from '../services/responseService.js';
import type {
  cancelRequestSchema,
  completeRequestSchema,
  createRequestSchema,
  feedQuerySchema,
  rejectRequestSchema,
  requestListQuerySchema,
  verifyRequestSchema,
} from '../schemas/index.js';
import { idParamSchema } from '../schemas/index.js';
import { getValidatedQuery, parseParams } from '../middleware/validate.js';
import { ok } from '../http/asyncHandler.js';

export async function createRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as z.infer<typeof createRequestSchema>;
  const request = await createBloodRequest(deps, req.auth!, input);
  ok(res, request, 201);
}

export async function listMyRequestsController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof requestListQuerySchema>>(res);
  ok(
    res,
    await listMyRequests(deps, req.auth!, {
      status: query.status ?? null,
      limit: query.limit,
      offset: query.offset,
    }),
  );
}

export async function requestFeedController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof feedQuerySchema>>(res);
  ok(
    res,
    await listRequestFeedForViewer(deps, req.auth!, {
      bloodGroup: query.bloodGroup ?? null,
      city: query.city ?? null,
      limit: query.limit,
      offset: query.offset,
    }),
  );
}

export async function getRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await getBloodRequest(deps, req.auth!, id));
}

export async function getRequestHistoryController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await getRequestHistory(deps, req.auth!, id));
}

export async function cancelRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof cancelRequestSchema>;
  ok(res, await cancelBloodRequest(deps, req.auth!, id, input.reason));
}

export async function completeRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof completeRequestSchema>;
  ok(res, await completeRequest(deps, req.auth!, id, input.status, input.note));
}

export async function respondToRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await createDonorResponse(deps, req.auth!, id), 201);
}

export async function listRequestResponsesController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await listResponsesForOwnRequest(deps, req.auth!, id));
}

export async function claimRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await claimRequestForReview(deps, req.auth!, id));
}

export async function verifyRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof verifyRequestSchema>;
  ok(res, await verifyRequest(deps, req.auth!, id, input.reason));
}

export async function rejectRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof rejectRequestSchema>;
  ok(res, await rejectRequest(deps, req.auth!, id, input.reason));
}

/** Hospital-only on-chain completion (ON_CHAIN mode). */
export async function chainCompleteController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await chainCompleteRequest(deps, req.auth!, id));
}
