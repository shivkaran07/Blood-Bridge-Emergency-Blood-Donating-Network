import type { Db } from '../db/database.js';
import type { NotificationRow, NotificationType } from '../types/domain.js';

export interface NotificationInput {
  recipientUserId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  relatedRequestId: string | null;
}

export async function createNotification(
  db: Db,
  input: NotificationInput,
): Promise<NotificationRow> {
  const result = await db.query<NotificationRow>(
    `insert into public.notifications
       (recipient_user_id, notification_type, title, message, related_request_id)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [
      input.recipientUserId,
      input.notificationType,
      input.title,
      input.message,
      input.relatedRequestId,
    ],
  );
  return result.rows[0]!;
}

export async function createNotifications(
  db: Db,
  recipientUserIds: string[],
  input: Omit<NotificationInput, 'recipientUserId'>,
): Promise<void> {
  const unique = [...new Set(recipientUserIds)];
  for (const recipientUserId of unique) {
    await createNotification(db, { ...input, recipientUserId });
  }
}

export async function listNotifications(
  db: Db,
  recipientUserId: string,
  options: { limit: number; offset: number; unreadOnly: boolean },
): Promise<{ items: NotificationRow[]; total: number; unread: number }> {
  const items = await db.query<NotificationRow>(
    `select * from public.notifications
      where recipient_user_id = $1
        and ($4 = false or read_at is null)
      order by created_at desc
      limit $2 offset $3`,
    [recipientUserId, options.limit, options.offset, options.unreadOnly],
  );
  const counts = await db.query<{ total: number; unread: number }>(
    `select count(*)::int as total,
            count(*) filter (where read_at is null)::int as unread
       from public.notifications
      where recipient_user_id = $1`,
    [recipientUserId],
  );

  return {
    items: items.rows,
    total: counts.rows[0]?.total ?? 0,
    unread: counts.rows[0]?.unread ?? 0,
  };
}

export async function markNotificationRead(
  db: Db,
  id: string,
  recipientUserId: string,
): Promise<NotificationRow | null> {
  const result = await db.query<NotificationRow>(
    `update public.notifications
        set read_at = coalesce(read_at, now())
      where id = $1 and recipient_user_id = $2
      returning *`,
    [id, recipientUserId],
  );
  return result.rows[0] ?? null;
}

export async function markAllNotificationsRead(
  db: Db,
  recipientUserId: string,
): Promise<number> {
  const result = await db.query(
    `update public.notifications
        set read_at = now()
      where recipient_user_id = $1 and read_at is null`,
    [recipientUserId],
  );
  return result.rowCount;
}

export async function unreadNotificationCount(
  db: Db,
  recipientUserId: string,
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.notifications
      where recipient_user_id = $1 and read_at is null`,
    [recipientUserId],
  );
  return result.rows[0]?.count ?? 0;
}
