import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Check, Inbox } from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { FilterChips } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { notificationLabels } from '../../lib/constants';
import { formatDateTime, pluralize } from '../../lib/format';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 15;

export function NotificationsPage() {
  const token = useAuthToken();
  const { me, refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  const notifications = useQuery({
    queryKey: queryKeys.notifications(unreadOnly, offset),
    queryFn: ({ signal }) =>
      api.notifications(token, { unreadOnly, limit: PAGE_SIZE, offset }, signal),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(token, id),
    onSuccess: async () => {
      await invalidateWorkspace(queryClient);
      await refreshMe();
    },
    onError: (error) => toast.error('Could not mark notification read', errorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Review request decisions, donor responses and account notices. Only you can read or mark your notifications."
        actions={
          <Badge tone={me && me.unreadNotifications > 0 ? 'brand' : 'success'} dot>
            {me?.unreadNotifications ?? 0} unread
          </Badge>
        }
      />

      <FilterChips
        label="Filter notifications"
        options={[
          { value: 'all', label: 'All notifications' },
          { value: 'unread', label: 'Unread only' },
        ]}
        value={unreadOnly ? 'unread' : 'all'}
        onChange={(value) => {
          setUnreadOnly(value === 'unread');
          setOffset(0);
        }}
      />

      {notifications.isLoading ? (
        <LoadingState label="Loading notifications…" />
      ) : notifications.isError ? (
        <ErrorState
          message={errorMessage(notifications.error)}
          onRetry={() => void notifications.refetch()}
        />
      ) : notifications.data && notifications.data.items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card">
            <ul className="divide-y divide-ink-100">
              {notifications.data.items.map((notification) => {
                const unread = !notification.readAt;
                return (
                  <li
                    key={notification.id}
                    className={cn('p-4 sm:p-5', unread ? 'bg-brand-50/30' : 'bg-white')}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                          unread ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500',
                        )}
                      >
                        {unread ? (
                          <BellRing className="size-4" aria-hidden="true" />
                        ) : (
                          <Bell className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink-900">{notification.title}</p>
                          <Badge tone="outline">
                            {notificationLabels[notification.type] ?? notification.type}
                          </Badge>
                          {unread ? <Badge tone="brand">Unread</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-400">
                          <span>{formatDateTime(notification.createdAt)}</span>
                          {notification.relatedRequestId ? (
                            <Link
                              to={`/app/requests/${notification.relatedRequestId}`}
                              className="font-semibold text-brand-700 hover:text-brand-800"
                            >
                              Open request
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      {unread ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={markRead.isPending && markRead.variables === notification.id}
                          onClick={() => markRead.mutate(notification.id)}
                          leftIcon={<Check className="size-4" aria-hidden="true" />}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <Pagination
            total={notifications.data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
            itemLabel={pluralize(notifications.data.total, 'notification')}
          />
        </>
      ) : (
        <EmptyState
          icon={<Inbox className="size-6" aria-hidden="true" />}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description={
            unreadOnly
              ? 'You are all caught up.'
              : 'When a request you are involved with changes status, the decision will appear here.'
          }
          action={
            unreadOnly ? (
              <Button variant="secondary" size="sm" onClick={() => setUnreadOnly(false)}>
                Show all notifications
              </Button>
            ) : undefined
          }
        />
      )}

      <Alert variant="neutral" title="In-app only">
        These notifications are stored in the BloodBridge database. No email, SMS or push message
        is claimed unless an external provider is configured.
      </Alert>
    </div>
  );
}
