import type { AuthContext, RequestStatus } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../lib/errors.js';
import { notifyUsers, writeAudit } from './notificationService.js';

export async function anonymizeOwnAccount(
  deps: ServiceDeps,
  ctx: AuthContext,
): Promise<{ status: 'ANONYMIZED'; requestHistoryRetained: true }> {
  const authAgeSeconds =
    ctx.user.authTime === undefined || ctx.user.authTime === null
      ? Number.POSITIVE_INFINITY
      : Math.floor(Date.now() / 1000) - ctx.user.authTime;
  if (authAgeSeconds < 0 || authAgeSeconds > 300) {
    throw new UnauthorizedError('Re-enter your password to close your account.');
  }

  if (!deps.identityAdmin) {
    throw new ServiceUnavailableError('Account closure is not available in this deployment.');
  }

  await deps.db.transaction(async (tx) => {
    const profile = await tx.query<{ id: string }>(
      'select id from public.profiles where id = $1 for update',
      [ctx.user.id],
    );
    if (!profile.rows[0]) throw new NotFoundError('Account not found.');

    if (ctx.isAdmin) {
      const otherAdmins = await tx.query<{ count: number }>(
        `select count(*)::int as count
           from public.user_roles
          where role = 'ADMIN' and user_id <> $1`,
        [ctx.user.id],
      );
      if ((otherAdmins.rows[0]?.count ?? 0) === 0) {
        throw new ConflictError('The last administrator account cannot be closed.');
      }
    }

    const requests = await tx.query<{ id: string; status: RequestStatus }>(
      `select id, status
         from public.blood_requests
        where requester_id = $1
          and status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED')
        for update`,
      [ctx.user.id],
    );

    for (const request of requests.rows) {
      await tx.query(
        `update public.blood_requests
            set status = 'CANCELLED',
                cancelled_at = now(),
                cancellation_reason = 'Requester account anonymized',
                requester_contact_phone = null,
                contact_share_consent = false,
                public_message = null,
                hospital_latitude = null,
                hospital_longitude = null
          where id = $1`,
        [request.id],
      );
      await tx.query(
        `insert into public.request_status_history
           (request_id, from_status, to_status, actor_user_id, reason)
         values ($1, $2, 'CANCELLED', null, 'Requester account anonymized')`,
        [request.id, request.status],
      );

    }

    const responses = await tx.query<{ request_id: string; donor_id: string }>(
      `update public.donor_responses dr
          set response_status = 'CANCELLED'
         from public.blood_requests br
        where br.id = dr.request_id
          and br.requester_id = $1
          and br.status <> 'FULFILLED'
          and dr.response_status in ('OFFERED', 'ACCEPTED')
        returning dr.request_id, dr.donor_id`,
      [ctx.user.id],
    );
    const donorsByRequest = new Map<string, Set<string>>();
    for (const response of responses.rows) {
      const donorIds = donorsByRequest.get(response.request_id) ?? new Set<string>();
      donorIds.add(response.donor_id);
      donorsByRequest.set(response.request_id, donorIds);
    }
    for (const [requestId, donorIds] of donorsByRequest) {
      await notifyUsers(tx, [...donorIds], {
        type: 'REQUEST_CANCELLED',
        title: 'Request no longer active',
        message: 'A request you responded to is no longer active. No further action is needed.',
        requestId,
      });
    }

    await tx.query(
      `update public.blood_requests
          set requester_contact_phone = null,
              contact_share_consent = false,
              public_message = null,
              hospital_latitude = null,
              hospital_longitude = null,
              review_reason = null,
              cancellation_reason = case
                when status = 'CANCELLED' then 'Requester account anonymized'
                else null
              end
        where requester_id = $1`,
      [ctx.user.id],
    );

    await tx.query('delete from public.donor_profiles where user_id = $1', [ctx.user.id]);
    await tx.query('delete from public.hospital_profiles where user_id = $1', [ctx.user.id]);
    await tx.query('delete from public.wallet_challenges where user_id = $1', [ctx.user.id]);
    await tx.query('delete from public.wallet_bindings where user_id = $1', [ctx.user.id]);
    await tx.query('delete from public.user_roles where user_id = $1', [ctx.user.id]);
    await tx.query('update public.user_roles set granted_by = null where granted_by = $1', [
      ctx.user.id,
    ]);
    await tx.query('delete from public.notifications where recipient_user_id = $1', [ctx.user.id]);

    await tx.query(
      `update public.request_status_history
          set actor_user_id = null, reason = null
        where actor_user_id = $1`,
      [ctx.user.id],
    );
    await tx.query(
      `update public.audit_events
          set actor_user_id = null, metadata = '{"anonymized":true}'::jsonb
        where actor_user_id = $1`,
      [ctx.user.id],
    );
    await tx.query(
      `update public.blockchain_transactions
          set actor_user_id = null, source_address = null
        where actor_user_id = $1`,
      [ctx.user.id],
    );
    await tx.query(
      `update public.profiles
          set full_name = 'Deleted account',
              phone_number = null,
              city = null,
              area = null,
              postal_code = null,
              email_notifications_enabled = false,
              account_status = 'SUSPENDED'
        where id = $1`,
      [ctx.user.id],
    );
    await writeAudit(tx, {
      actorUserId: null,
      requestId: null,
      eventType: 'ACCOUNT_ANONYMIZED',
      metadata: { retainedRequestHistory: true },
    });
  });

  await deps.identityAdmin.anonymizeUser(ctx.user.id);
  return { status: 'ANONYMIZED', requestHistoryRetained: true };
}
