import { Router, type RequestHandler } from 'express';
import type { ServiceDeps } from '../services/deps.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { requireAdmin, requireApprovedHospital } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../http/asyncHandler.js';
import {
  adminAuditController,
  adminCancelRequestController,
  adminHospitalApplicationsController,
  adminHospitalDecisionController,
  adminOverviewController,
  adminRequestsController,
  adminStatsController,
  adminSuspiciousController,
  adminUserStatusController,
  adminUsersController,
} from '../controllers/adminController.js';
import {
  applyForHospitalController,
  getHospitalAuditController,
  getHospitalDashboardController,
  getHospitalQueueController,
  getMyHospitalApplicationController,
} from '../controllers/hospitalController.js';
import {
  cancelRequestController,
  claimRequestController,
  completeRequestController,
  createRequestController,
  getRequestController,
  getRequestHistoryController,
  listMyRequestsController,
  listRequestResponsesController,
  rejectRequestController,
  requestFeedController,
  respondToRequestController,
  verifyRequestController,
} from '../controllers/requestController.js';
import {
  completeResponseController,
  decideResponseController,
  declineResponseController,
  listMyResponsesController,
  withdrawResponseController,
} from '../controllers/responseController.js';
import {
  getDonorProfileController,
  listMatchesController,
  updateAvailabilityController,
  upsertDonorProfileController,
} from '../controllers/donorController.js';
import {
  anonymizeAccountController,
  getMeController,
  updateEmailNotificationsController,
  updateMeController,
} from '../controllers/profileController.js';
import {
  blockchainStatusController,
  dashboardController,
  listNotificationsController,
  markNotificationReadController,
  requestBlockchainController,
} from '../controllers/miscController.js';
import {
  adminAuditQuerySchema,
  adminCancelRequestSchema,
  adminRequestsQuerySchema,
  adminUserStatusSchema,
  adminUsersQuerySchema,
  availabilitySchema,
  anonymizeAccountSchema,
  cancelRequestSchema,
  completeRequestSchema,
  createRequestSchema,
  donorProfileSchema,
  emailNotificationsSchema,
  feedQuerySchema,
  hospitalApplicationSchema,
  hospitalApplicationsQuerySchema,
  hospitalAuditQuerySchema,
  hospitalDecisionSchema,
  hospitalQueueQuerySchema,
  notificationsQuerySchema,
  operationsQuerySchema,
  paginationSchema,
  rejectRequestSchema,
  requestListQuerySchema,
  responseDecisionSchema,
  updateProfileSchema,
  verifyRequestSchema,
  walletChallengeSchema,
  anchorConfirmSchema,
  walletVerifySchema,
} from '../schemas/index.js';
import { deriveVerificationMode } from '../config/env.js';
import {
  confirmAnchorOperationController,
  listBlockchainOperationsController,
  reconcileAnchorOperationController,
} from '../controllers/anchorController.js';
import {
  issueWalletChallengeController,
  unbindWalletController,
  verifyWalletChallengeController,
  walletStatusController,
} from '../controllers/walletController.js';
import {
  chainCompleteController,
} from '../controllers/requestController.js';

export function createApiRouter(
  deps: ServiceDeps,
  authenticate: RequestHandler,
  limiters: RateLimiters,
): Router {
  const router = Router();

  const verificationMode = deriveVerificationMode(deps.config.blockchain);

  // Public, non-sensitive discovery endpoints.
  router.get('/health', asyncHandler(async (_req, res) => {
    await deps.db.query('select 1');
    res.json({
      data: {
        status: 'ok',
        service: 'bloodbridge-api',
        database: 'reachable',
        phase: 'PART_2',
        time: new Date().toISOString(),
      },
    });
  }));

  router.get('/meta', (_req, res) => {
    res.json({
      data: {
        phase: 'PART_2',
        product: 'BloodBridge',
        description:
          'Emergency blood donation and hospital verification network with role-based access control and on-chain decision anchoring.',
        blockchain: {
          verificationMode,
          contractConfigured: Boolean(deps.config.blockchain.contractAddress),
          operational:
            verificationMode === 'ON_CHAIN' && deps.chain !== null,
          note:
            verificationMode === 'ON_CHAIN'
              ? 'Hospital decisions are anchored on the BloodBridge contract by wallet-signed transactions verified by this backend.'
              : 'No contract is configured; verification is database-backed and no transactions are created.',
        },
      },
    });
  });

  router.use(authenticate);

  // ----------------------------- Profile -----------------------------------
  router.get('/me', asyncHandler((req, res) => getMeController(deps, req, res)));
  router.patch(
    '/me',
    limiters.write,
    validateBody(updateProfileSchema),
    asyncHandler((req, res) => updateMeController(deps, req, res)),
  );
  router.patch(
    '/me/email-notifications',
    limiters.write,
    validateBody(emailNotificationsSchema),
    asyncHandler((req, res) => updateEmailNotificationsController(deps, req, res)),
  );
  router.delete(
    '/me',
    limiters.write,
    validateBody(anonymizeAccountSchema),
    asyncHandler((req, res) => anonymizeAccountController(deps, req, res)),
  );

  // ------------------------------ Donor ------------------------------------
  router.get('/donor/profile', asyncHandler((req, res) => getDonorProfileController(deps, req, res)));
  router.put(
    '/donor/profile',
    limiters.write,
    validateBody(donorProfileSchema),
    asyncHandler((req, res) => upsertDonorProfileController(deps, req, res)),
  );
  router.patch(
    '/donor/availability',
    limiters.write,
    validateBody(availabilitySchema),
    asyncHandler((req, res) => updateAvailabilityController(deps, req, res)),
  );

  // ---------------------------- Requests -----------------------------------
  router.get(
    '/requests/feed',
    validateQuery(feedQuerySchema),
    asyncHandler((req, res) => requestFeedController(deps, req, res)),
  );
  router.get(
    '/requests/mine',
    validateQuery(requestListQuerySchema),
    asyncHandler((req, res) => listMyRequestsController(deps, req, res)),
  );
  router.post(
    '/requests',
    limiters.write,
    limiters.requestCreate,
    validateBody(createRequestSchema),
    asyncHandler((req, res) => createRequestController(deps, req, res)),
  );
  router.get('/requests/:id', asyncHandler((req, res) => getRequestController(deps, req, res)));
  router.get(
    '/requests/:id/history',
    asyncHandler((req, res) => getRequestHistoryController(deps, req, res)),
  );
  router.get(
    '/requests/:id/matches',
    asyncHandler((req, res) => listMatchesController(deps, req, res)),
  );
  router.get(
    '/requests/:id/blockchain',
    asyncHandler((req, res) => requestBlockchainController(deps, req, res)),
  );
  router.get(
    '/requests/:id/responses',
    asyncHandler((req, res) => listRequestResponsesController(deps, req, res)),
  );
  router.post(
    '/requests/:id/respond',
    limiters.write,
    limiters.responseCreate,
    asyncHandler((req, res) => respondToRequestController(deps, req, res)),
  );
  router.post(
    '/requests/:id/cancel',
    limiters.write,
    validateBody(cancelRequestSchema),
    asyncHandler((req, res) => cancelRequestController(deps, req, res)),
  );
  router.post(
    '/requests/:id/complete',
    limiters.write,
    validateBody(completeRequestSchema),
    asyncHandler((req, res) => completeRequestController(deps, req, res)),
  );
  router.post(
    '/requests/:id/chain-complete',
    limiters.write,
    requireApprovedHospital(),
    asyncHandler((req, res) => chainCompleteController(deps, req, res)),
  );
  router.post(
    '/requests/:id/claim',
    limiters.write,
    requireApprovedHospital(),
    asyncHandler((req, res) => claimRequestController(deps, req, res)),
  );
  router.post(
    '/requests/:id/verify',
    limiters.write,
    requireApprovedHospital(),
    validateBody(verifyRequestSchema),
    asyncHandler((req, res) => verifyRequestController(deps, req, res)),
  );
  router.post(
    '/requests/:id/reject',
    limiters.write,
    requireApprovedHospital(),
    validateBody(rejectRequestSchema),
    asyncHandler((req, res) => rejectRequestController(deps, req, res)),
  );

  // ---------------------------- Responses ----------------------------------
  router.get(
    '/responses/mine',
    validateQuery(paginationSchema),
    asyncHandler((req, res) => listMyResponsesController(deps, req, res)),
  );
  router.post(
    '/responses/:id/decision',
    limiters.write,
    validateBody(responseDecisionSchema),
    asyncHandler((req, res) => decideResponseController(deps, req, res)),
  );
  router.post(
    '/responses/:id/withdraw',
    limiters.write,
    asyncHandler((req, res) => withdrawResponseController(deps, req, res)),
  );
  router.post(
    '/responses/:id/decline',
    limiters.write,
    asyncHandler((req, res) => declineResponseController(deps, req, res)),
  );
  router.post(
    '/responses/:id/complete',
    limiters.write,
    asyncHandler((req, res) => completeResponseController(deps, req, res)),
  );

  // ------------------------------ Hospital ---------------------------------
  router.post(
    '/hospital/applications',
    limiters.write,
    limiters.hospitalApply,
    validateBody(hospitalApplicationSchema),
    asyncHandler((req, res) => applyForHospitalController(deps, req, res)),
  );
  router.get(
    '/hospital/application',
    asyncHandler((req, res) => getMyHospitalApplicationController(deps, req, res)),
  );
  router.get(
    '/hospital/queue',
    requireApprovedHospital(),
    validateQuery(hospitalQueueQuerySchema),
    asyncHandler((req, res) => getHospitalQueueController(deps, req, res)),
  );
  router.get(
    '/hospital/dashboard',
    requireApprovedHospital(),
    asyncHandler((req, res) => getHospitalDashboardController(deps, req, res)),
  );
  router.get(
    '/hospital/audit',
    requireApprovedHospital(),
    validateQuery(hospitalAuditQuerySchema),
    asyncHandler((req, res) => getHospitalAuditController(deps, req, res)),
  );

  // --------------------------- Notifications -------------------------------
  router.get(
    '/notifications',
    validateQuery(notificationsQuerySchema),
    asyncHandler((req, res) => listNotificationsController(deps, req, res)),
  );
  router.post(
    '/notifications/:id/read',
    limiters.write,
    asyncHandler((req, res) => markNotificationReadController(deps, req, res)),
  );

  // ------------------------------ Dashboard --------------------------------
  router.get('/dashboard', asyncHandler((req, res) => dashboardController(deps, req, res)));

  // ----------------------------- Blockchain --------------------------------
  router.get(
    '/blockchain/status',
    asyncHandler((req, res) => blockchainStatusController(deps, req, res)),
  );
  router.get(
    '/blockchain/operations',
    validateQuery(operationsQuerySchema),
    asyncHandler((req, res) => listBlockchainOperationsController(deps, req, res)),
  );
  router.post(
    '/blockchain/operations/:id/confirm',
    limiters.write,
    validateBody(anchorConfirmSchema),
    asyncHandler((req, res) => confirmAnchorOperationController(deps, req, res)),
  );
  router.post(
    '/blockchain/operations/:id/reconcile',
    limiters.write,
    asyncHandler((req, res) => reconcileAnchorOperationController(deps, req, res)),
  );

  // --------------------- Wallet ownership (Part 2) -------------------------
  router.post(
    '/wallet/challenge',
    limiters.write,
    validateBody(walletChallengeSchema),
    asyncHandler((req, res) => issueWalletChallengeController(deps, req, res)),
  );
  router.post(
    '/wallet/verify',
    limiters.write,
    validateBody(walletVerifySchema),
    asyncHandler((req, res) => verifyWalletChallengeController(deps, req, res)),
  );
  router.get('/wallet/status', asyncHandler((req, res) => walletStatusController(deps, req, res)));
  router.delete(
    '/wallet/binding',
    limiters.write,
    asyncHandler((req, res) => unbindWalletController(deps, req, res)),
  );

  // -------------------------------- Admin ----------------------------------
  router.use('/admin', requireAdmin());
  router.get('/admin/overview', asyncHandler((req, res) => adminOverviewController(deps, req, res)));
  router.get('/admin/stats', asyncHandler((req, res) => adminStatsController(deps, req, res)));
  router.get(
    '/admin/users',
    validateQuery(adminUsersQuerySchema),
    asyncHandler((req, res) => adminUsersController(deps, req, res)),
  );
  router.patch(
    '/admin/users/:id/status',
    limiters.write,
    validateBody(adminUserStatusSchema),
    asyncHandler((req, res) => adminUserStatusController(deps, req, res)),
  );
  router.get(
    '/admin/requests',
    validateQuery(adminRequestsQuerySchema),
    asyncHandler((req, res) => adminRequestsController(deps, req, res)),
  );
  router.post(
    '/admin/requests/:id/cancel',
    limiters.write,
    validateBody(adminCancelRequestSchema),
    asyncHandler((req, res) => adminCancelRequestController(deps, req, res)),
  );
  router.get(
    '/admin/suspicious',
    asyncHandler((req, res) => adminSuspiciousController(deps, req, res)),
  );
  router.get(
    '/admin/audit',
    validateQuery(adminAuditQuerySchema),
    asyncHandler((req, res) => adminAuditController(deps, req, res)),
  );
  router.get(
    '/admin/hospital-applications',
    validateQuery(hospitalApplicationsQuerySchema),
    asyncHandler((req, res) => adminHospitalApplicationsController(deps, req, res)),
  );
  router.post(
    '/admin/hospital-applications/:id/decision',
    limiters.write,
    validateBody(hospitalDecisionSchema),
    asyncHandler((req, res) => adminHospitalDecisionController(deps, req, res)),
  );

  return router;
}
