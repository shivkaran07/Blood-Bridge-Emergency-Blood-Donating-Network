import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import { getNotifications, markNotificationRead } from '../services/notificationService.js';
import { getDashboard } from '../services/dashboardService.js';
import { getBlockchainStatus, getRequestBlockchainRecord } from '../services/blockchainService.js';
import { idParamSchema, notificationsQuerySchema } from '../schemas/index.js';
import { getValidatedQuery, parseParams } from '../middleware/validate.js';
import { ok } from '../http/asyncHandler.js';

export async function listNotificationsController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof notificationsQuerySchema>>(res);
  ok(res, await getNotifications(deps.db, req.auth!, query));
}

export async function markNotificationReadController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await markNotificationRead(deps.db, req.auth!, id));
}

export async function dashboardController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await getDashboard(deps, req.auth!));
}

export async function blockchainStatusController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await getBlockchainStatus(deps, req.auth!));
}

export async function requestBlockchainController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await getRequestBlockchainRecord(deps, req.auth!, id));
}
