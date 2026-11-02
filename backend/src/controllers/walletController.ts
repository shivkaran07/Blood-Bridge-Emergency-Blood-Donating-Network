import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ServiceDeps } from '../services/deps.js';
import {
  getWalletStatus,
  issueWalletChallenge,
  unbindWallet,
  verifyWalletOwnership,
} from '../services/walletService.js';
import type { walletChallengeSchema, walletVerifySchema } from '../schemas/index.js';
import { ok } from '../http/asyncHandler.js';

export async function issueWalletChallengeController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as z.infer<typeof walletChallengeSchema>;
  ok(res, await issueWalletChallenge(deps, req.auth!, input.walletAddress), 201);
}

export async function verifyWalletChallengeController(deps: ServiceDeps, req: Request, res: Response) {
  const input = req.body as z.infer<typeof walletVerifySchema>;
  ok(res, await verifyWalletOwnership(deps, req.auth!, input));
}

export async function walletStatusController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await getWalletStatus(deps, req.auth!));
}

export async function unbindWalletController(deps: ServiceDeps, req: Request, res: Response) {
  ok(res, await unbindWallet(deps, req.auth!));
}
