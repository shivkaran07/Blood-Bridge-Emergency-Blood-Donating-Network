import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import {
  cancelRequestAsAdmin,
  getAdminOverview,
  getOperationalActivity,
  getOperationalStats,
  listAuditForAdmin,
  listRequestsForAdmin,
  listSuspiciousForAdmin,
  listUsers,
  updateUserStatus,
} from '../services/adminService.js';
import {
  decideApplication,
  listApplicationsForAdmin,
} from '../services/hospitalService.js';
import type {
  adminAuditQuerySchema,
  adminCancelRequestSchema,
  adminRequestsQuerySchema,
  adminUsersQuerySchema,
  adminUserStatusSchema,
  hospitalApplicationsQuerySchema,
  hospitalDecisionSchema,
} from '../schemas/index.js';
import { idParamSchema } from '../schemas/index.js';
import { getValidatedQuery, parseParams } from '../middleware/validate.js';
import { ok } from '../http/asyncHandler.js';

export async function adminOverviewController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await getAdminOverview(deps, req.auth!));
}

export async function adminStatsController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, { stats: await getOperationalStats(deps, req.auth!), activity: await getOperationalActivity(deps, req.auth!) });
}

export async function adminUsersController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof adminUsersQuerySchema>>(res);
  ok(res, await listUsers(deps, req.auth!, query));
}

export async function adminUserStatusController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof adminUserStatusSchema>;
  ok(res, await updateUserStatus(deps, req.auth!, id, input.status, input.reason));
}

export async function adminRequestsController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof adminRequestsQuerySchema>>(res);
  ok(
    res,
    await listRequestsForAdmin(deps, req.auth!, {
      status: query.status ?? null,
      bloodGroup: query.bloodGroup ?? null,
      priority: query.priority ?? null,
      city: query.city ?? null,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    }),
  );
}

export async function adminCancelRequestController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof adminCancelRequestSchema>;
  ok(res, await cancelRequestAsAdmin(deps, req.auth!, id, input.reason));
}

export async function adminSuspiciousController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await listSuspiciousForAdmin(deps, req.auth!));
}

export async function adminAuditController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof adminAuditQuerySchema>>(res);
  ok(
    res,
    await listAuditForAdmin(deps, req.auth!, {
      eventType: query.eventType ?? null,
      actorUserId: query.actorUserId ?? null,
      requestId: query.requestId ?? null,
      limit: query.limit,
      offset: query.offset,
    }),
  );
}

export async function adminHospitalApplicationsController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const query = getValidatedQuery<z.infer<typeof hospitalApplicationsQuerySchema>>(res);
  ok(
    res,
    await listApplicationsForAdmin(deps, req.auth!, {
      status: query.status ?? null,
      limit: query.limit,
      offset: query.offset,
    }),
  );
}

export async function adminHospitalDecisionController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  const { id } = parseParams(idParamSchema, req.params);
  const input = req.body as z.infer<typeof hospitalDecisionSchema>;
  ok(res, await decideApplication(deps, req.auth!, id, input.decision, input.reason ?? null));
}
