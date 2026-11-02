import type { Db } from '../db/database.js';
import type {
  AuditEventType,
  BloodGroup,
  NotificationType,
  RequestPriority,
} from '../types/domain.js';
import { createAuditEvent } from '../repositories/auditRepository.js';
import {
  createNotifications,
  listNotifications,
  markNotificationRead as markNotificationReadRepo,
} from '../repositories/notificationRepository.js';
import {
  listApprovedHospitalUserIds,
  listUserIdsByRole,
} from '../repositories/userRepository.js';
import { toNotificationDto } from './serializers.js';
import type { AuthContext } from '../types/domain.js';
import { NotFoundError } from '../lib/errors.js';

export async function notifyUsers(
  db: Db,
  recipientUserIds: string[],
  input: {
    type: NotificationType;
    title: string;
    message: string;
    requestId: string | null;
  },
): Promise<void> {
  if (recipientUserIds.length === 0) return;
  await createNotifications(db, recipientUserIds, {
    notificationType: input.type,
    title: input.title,
    message: input.message,
    relatedRequestId: input.requestId,
  });
}

export async function notifyAdmins(
  db: Db,
  input: {
    type: NotificationType;
    title: string;
    message: string;
    requestId: string | null;
  },
): Promise<void> {
  const admins = await listUserIdsByRole(db, 'ADMIN');
  await notifyUsers(db, admins, input);
}

export async function notifyApprovedHospitals(
  db: Db,
  input: {
    type: NotificationType;
    title: string;
    message: string;
    requestId: string | null;
  },
): Promise<void> {
  const hospitals = await listApprovedHospitalUserIds(db);
  await notifyUsers(db, hospitals, input);
}

export async function notifyNewRequest(
  db: Db,
  input: {
    requestId: string;
    requesterId: string;
    bloodGroup: BloodGroup;
    unitsRequested: number;
    hospitalName: string;
    hospitalCity: string;
    priority: RequestPriority;
  },
): Promise<void> {
  await notifyUsers(db, [input.requesterId], {
    type: 'REQUEST_SUBMITTED',
    title: 'Blood request submitted',
    message: `Your request for ${input.unitsRequested} unit(s) of ${input.bloodGroup} blood at ${input.hospitalName}, ${input.hospitalCity} is awaiting hospital verification. A donor response does not guarantee blood availability.`,
    requestId: input.requestId,
  });

  await notifyApprovedHospitals(db, {
    type: 'REQUEST_SUBMITTED',
    title: 'New request awaiting verification',
    message: `A ${input.priority.toLowerCase()} priority request for ${input.bloodGroup} blood at ${input.hospitalName}, ${input.hospitalCity} needs review.`,
    requestId: input.requestId,
  });
}

export async function writeAudit(
  db: Db,
  input: {
    actorUserId: string | null;
    requestId: string | null;
    eventType: AuditEventType;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await createAuditEvent(db, {
    actorUserId: input.actorUserId,
    requestId: input.requestId,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
  });
}

export async function getNotifications(
  db: Db,
  ctx: AuthContext,
  options: { limit: number; offset: number; unreadOnly: boolean },
) {
  const result = await listNotifications(db, ctx.user.id, options);
  return {
    items: result.items.map(toNotificationDto),
    total: result.total,
    unread: result.unread,
  };
}

export async function markNotificationRead(
  db: Db,
  ctx: AuthContext,
  notificationId: string,
) {
  const updated = await markNotificationReadRepo(db, notificationId, ctx.user.id);
  if (!updated) throw new NotFoundError('Notification not found.');
  return toNotificationDto(updated);
}
