import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import {
  applyForHospitalVerification,
  getHospitalAudit,
  getHospitalDashboard,
  getMyHospitalApplication,
  getVerificationQueue,
} from '../services/hospitalService.js';
import type {
  hospitalApplicationSchema,
  hospitalAuditQuerySchema,
  hospitalQueueQuerySchema,
} from '../schemas/index.js';
import { getValidatedQuery } from '../middleware/validate.js';
import { ok } from '../http/asyncHandler.js';

export async function applyForHospitalController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as z.infer<typeof hospitalApplicationSchema>;
  ok(
    res,
    await applyForHospitalVerification(deps, req.auth!, {
      hospitalName: input.hospitalName,
      registrationNumber: input.registrationNumber,
      contactPerson: input.contactPerson,
      contactPhone: input.contactPhone,
      officialEmail: input.officialEmail,
      address: input.address,
      city: input.city,
      area: input.area,
    }),
    201,
  );
}

export async function getMyHospitalApplicationController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  ok(res, await getMyHospitalApplication(deps, req.auth!));
}

export async function getHospitalQueueController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof hospitalQueueQuerySchema>>(res);
  ok(res, await getVerificationQueue(deps, req.auth!, { limit: query.limit, offset: query.offset }));
}

export async function getHospitalDashboardController(
  deps: ServiceDeps,
  req: Request,
  res: Response,
) {
  ok(res, await getHospitalDashboard(deps, req.auth!));
}

export async function getHospitalAuditController(deps: ServiceDeps, req: Request, res: Response) {
  const query = getValidatedQuery<z.infer<typeof hospitalAuditQuerySchema>>(res);
  ok(res, await getHospitalAudit(deps, req.auth!, { limit: query.limit, offset: query.offset }));
}
