import type { Request, Response } from 'express';
import type { ServiceDeps } from '../services/deps.js';
import {
  getMatchesForRequest,
  getOwnDonorProfile,
  updateAvailability,
  upsertOwnDonorProfile,
} from '../services/donorService.js';
import type { z } from 'zod';
import type { availabilitySchema, donorProfileSchema } from '../schemas/index.js';
import { ok } from '../http/asyncHandler.js';
import { parseParams } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/index.js';

export async function getDonorProfileController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await getOwnDonorProfile(deps, req.auth!));
}

export async function upsertDonorProfileController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as z.infer<typeof donorProfileSchema>;
  ok(
    res,
    await upsertOwnDonorProfile(deps, req.auth!, {
      bloodGroup: input.bloodGroup,
      isAvailable: input.isAvailable,
      consentToContact: input.consentToContact,
      latitude: input.latitude,
      longitude: input.longitude,
      privacyAccepted: input.privacyAccepted,
    }),
  );
}

export async function updateAvailabilityController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as z.infer<typeof availabilitySchema>;
  ok(res, await updateAvailability(deps, req.auth!, input.isAvailable));
}

export async function listMatchesController(deps: ServiceDeps, req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req.params);
  ok(res, await getMatchesForRequest(deps, req.auth!, id));
}
