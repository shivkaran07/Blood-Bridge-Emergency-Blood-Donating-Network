import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import {
  decideOnResponse,
  declineOwnResponse,
  listOwnResponses,
  markResponseCompleted,
} from '../services/responseService.js';
import { idParamSchema, responseDecisionSchema } from '../schemas/index.js';
import { getValidatedQuery, parseParams } from '../middleware/validate.js';
import { paginationSchema } from '../schemas/index.js';
import { ok } from '../http/asyncHandler.js';

export async function listMyResponsesController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof paginationSchema>>(res);
  ok(res, await listOwnResponses(deps, req.auth!, { limit: query.limit, offset: query.offset }));
}

export async function decideResponseController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof responseDecisionSchema>;
  ok(res, await decideOnResponse(deps, req.auth!, id, input.decision));
}

export async function withdrawResponseController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await declineOwnResponse(deps, req.auth!, id, 'withdraw'));
}

export async function declineResponseController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await declineOwnResponse(deps, req.auth!, id, 'decline'));
}

export async function completeResponseController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await markResponseCompleted(deps, req.auth!, id));
}
