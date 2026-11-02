import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Search, ShieldAlert, UserRound } from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge, RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea, FormError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { formatDate } from '../../lib/format';
import type { AdminUser } from '../../types/api';

const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const token = useAuthToken();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [nextStatus, setNextStatus] = useState<'ACTIVE' | 'SUSPENDED'>('SUSPENDED');
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: queryKeys.adminUsers(search, offset),
    queryFn: ({ signal }) =>
      api.adminUsers(token, { search, limit: PAGE_SIZE, offset }, signal),
  });

  const changeStatus = useMutation({
    mutationFn: (input: { id: string; status: 'ACTIVE' | 'SUSPENDED'; reason: string | null }) =>
      api.adminUserStatus(token, input.id, input.status, input.reason),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.status === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated',
        'The user has been notified in the application.',
      );
      setTarget(null);
      setReason('');
      setDialogError(null);
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      setDialogError(message);
      toast.error('Could not update account status', message);
    },
  });

  const openStatusDialog = (user: AdminUser) => {
    setTarget(user);
    setNextStatus(user.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
    setReason('');
    setDialogError(null);
  };

  const submitStatus = () => {
    if (!target) return;
    setDialogError(null);
    if (nextStatus === 'SUSPENDED' && reason.trim().length < 10) {
      setDialogError('Provide a suspension reason of at least 10 characters.');
      return;
    }
    changeStatus.mutate({
      id: target.id,
      status: nextStatus,
      reason: reason.trim() || null,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator"
        title="User management"
        description="Review account status and role assignments. Administrator accounts are protected from this endpoint and must use the documented break-glass procedure."
      />

      <Alert variant="warning" title="Sensitive account action">
        Suspending an account blocks authenticated API access. Service-level authorization still
        enforces every operation. A suspension requires a reason and is written to the audit log.
      </Alert>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft.trim());
          setOffset(0);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <Input
            className="pl-9"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users"
          />
        </div>
        <Button type="submit">Search</Button>
        {search ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setSearchDraft('');
              setOffset(0);
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {users.isLoading ? (
        <LoadingState label="Loading users…" />
      ) : users.isError ? (
        <ErrorState message={errorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : users.data && users.data.items.length > 0 ? (
        <>
          <div className="hidden rounded-xl border border-ink-200/90 bg-surface-raised p-4 shadow-card sm:p-5 xl:block">
            <Table minWidth={860}>
              <THead>
                <Th>User</Th>
                <Th>Roles</Th>
                <Th>Hospital</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th>Action</Th>
              </THead>
              <TBody>
                {users.data.items.map((user) => {
                  const isSelf = user.id === me?.user.id;
                  const isAdmin = user.roles.includes('ADMIN');
                  return (
                    <Tr key={user.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                            <UserRound className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {user.fullName}
                              {isSelf ? <span className="ml-1 text-xs text-ink-500">(you)</span> : null}
                            </p>
                            <p className="truncate text-xs text-ink-500">{user.email}</p>
                            {user.city ? <p className="text-xs text-ink-500">{user.city}</p> : null}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <RoleBadge key={role} role={role} />
                          ))}
                        </div>
                      </Td>
                      <Td>
                        {user.hospitalName ? (
                          <div>
                            <p className="text-sm text-ink-800">{user.hospitalName}</p>
                            <Badge
                              tone={
                                user.hospitalStatus === 'APPROVED'
                                  ? 'success'
                                  : user.hospitalStatus === 'PENDING'
                                    ? 'warning'
                                    : 'danger'
                              }
                            >
                              {user.hospitalStatus}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-500">—</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={user.accountStatus === 'ACTIVE' ? 'success' : 'danger'} dot>
                          {user.accountStatus}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(user.createdAt)}</Td>
                      <Td>
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                            <ShieldAlert className="size-3.5" aria-hidden="true" />
                            Protected
                          </span>
                        ) : (
                          <Button
                            variant={user.accountStatus === 'ACTIVE' ? 'danger' : 'secondary'}
                            size="sm"
                            disabled={isSelf}
                            onClick={() => openStatusDialog(user)}
                            leftIcon={
                              user.accountStatus === 'ACTIVE' ? (
                                <Ban className="size-3.5" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              )
                            }
                          >
                            {user.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-3 xl:hidden">
            {users.data.items.map((user) => {
              const isSelf = user.id === me?.user.id;
              const isAdmin = user.roles.includes('ADMIN');
              return (
                <li
                  key={user.id}
                  className="rounded-xl border border-ink-200/90 bg-surface-raised p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                        <UserRound className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {user.fullName}
                          {isSelf ? <span className="ml-1 text-xs font-normal text-ink-500">(you)</span> : null}
                        </p>
                        <p className="truncate text-[0.75rem] text-ink-500">{user.email}</p>
                        {user.city ? <p className="text-[0.75rem] text-ink-500">{user.city}</p> : null}
                      </div>
                    </div>
                    <Badge tone={user.accountStatus === 'ACTIVE' ? 'success' : 'danger'} dot>
                      {user.accountStatus}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                    {user.hospitalName ? (
                      <Badge
                        tone={
                          user.hospitalStatus === 'APPROVED'
                            ? 'success'
                            : user.hospitalStatus === 'PENDING'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {user.hospitalName}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
                    <span className="text-[0.6875rem] text-ink-500">
                      Joined {formatDate(user.createdAt)}
                    </span>
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-500">
                        <ShieldAlert className="size-3.5" aria-hidden="true" />
                        Protected account
                      </span>
                    ) : (
                      <Button
                        variant={user.accountStatus === 'ACTIVE' ? 'danger' : 'secondary'}
                        size="sm"
                        disabled={isSelf}
                        onClick={() => openStatusDialog(user)}
                        leftIcon={
                          user.accountStatus === 'ACTIVE' ? (
                            <Ban className="size-3.5" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          )
                        }
                      >
                        {user.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination
            total={users.data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
            itemLabel="users"
          />
        </>
      ) : (
        <EmptyState
          icon={<UserRound className="size-6" aria-hidden="true" />}
          title="No users match"
          description={search ? 'Try a different name or email search.' : 'No user accounts found.'}
        />
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={nextStatus === 'SUSPENDED' ? 'Suspend account' : 'Reactivate account'}
        description={
          target
            ? `${target.fullName} · ${target.email}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              variant={nextStatus === 'SUSPENDED' ? 'danger' : 'primary'}
              isLoading={changeStatus.isPending}
              onClick={submitStatus}
            >
              {nextStatus === 'SUSPENDED' ? 'Suspend account' : 'Reactivate account'}
            </Button>
          </>
        }
      >
        {dialogError ? <FormError>{dialogError}</FormError> : null}
        <div className="mt-3 space-y-4">
          {nextStatus === 'SUSPENDED' ? (
            <Field
              label="Suspension reason"
              htmlFor="suspension-reason"
              required
              hint="At least 10 characters. The user will see this reason in their notification."
            >
              <Textarea
                id="suspension-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Repeated false emergency requests under review."
              />
            </Field>
          ) : (
            <Alert variant="info" title="Access will be restored">
              The user will be able to sign in and use authorized workflows again. A reason is
              optional for reactivation.
            </Alert>
          )}
          {nextStatus === 'ACTIVE' ? (
            <Field label="Note" htmlFor="reactivation-reason" optional>
              <Textarea
                id="reactivation-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional internal note."
              />
            </Field>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
