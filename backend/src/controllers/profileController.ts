import type { Request, Response } from 'express';
import type { ServiceDeps } from '../services/deps.js';
import { getMe, updateOwnProfile } from '../services/profileService.js';
import type { UpdateProfileInput } from '../schemas/index.js';
import { ok } from '../http/asyncHandler.js';

export async function getMeController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await getMe(deps, req.auth!));
}

export async function updateMeController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as UpdateProfileInput;
  const profile = await updateOwnProfile(deps, req.auth!, {
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    city: input.city,
    area: input.area,
    postalCode: input.postalCode ?? null,
  });
  ok(res, profile);
}
