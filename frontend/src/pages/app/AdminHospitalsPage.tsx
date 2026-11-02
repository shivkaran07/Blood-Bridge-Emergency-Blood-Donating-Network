import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { FilterChips } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { formatDateTime } from '../../lib/format';
import type { HospitalApplication, HospitalVerificationStatus } from '../../types/api';

const PAGE_SIZE = 10;

type StatusFilter = 'ALL' | HospitalVerificationStatus;

export function AdminHospitalsPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [offset, setOffset] = useState(0);
  const [target, setTarget] = useState<HospitalApplication | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const applications = useQuery({
    queryKey: queryKeys.adminHospitals(status, offset),
    queryFn: ({ signal }) =>
      api.adminHospitalApplications(
        token,
        {
          status: status === 'ALL' ? undefined : status,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      ),
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: 'APPROVED' | 'REJECTED'; reason: string | null }) =>
      api.adminHospitalDecision(token, input.id, input.decision, input.reason),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === 'APPROVED' ? 'Hospital approved' : 'Hospital application rejected',
        variables.decision === 'APPROVED'
          ? 'The HOSPITAL role was granted and the applicant notified.'
          : 'Verifier access was revoked and the applicant notified.',
      );
      setTarget(null);
      setReason('');
      setDialogError(null);
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error);
      setDialogError(message);
      toast.error('Could not record decision', message);
    },
  });

  const openDialog = (application: HospitalApplication, next: 'APPROVED' | 'REJECTED') => {
    setTarget(application);
    setDecision(next);
    setReason('');
    setDialogError(null);
  };

  const submitDecision = () => {
    if (!target) return;
    setDialogError(null);
    if (decision === 'REJECTED' && reason.trim().length < 10) {
      setDialogError('Provide a rejection reason of at least 10 characters.');
      return;
    }
    decide.mutate({ id: target.id, decision, reason: reason.trim() || null });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator"
        title="Hospital applications"
        description="Review institutional applications. Approval grants the HOSPITAL role; rejection removes verifier access. No administrator privileges are granted here."
      />

      <Alert variant="warning" title="Approval is an application permission">
        Approving an application grants access to the application's verification queue and records
        an audit event. It does not create a contract, grant administrator rights or prove clinical
        capability.
      </Alert>

      <FilterChips
        label="Filter hospital applications"
        options={[
          { value: 'PENDING' as const, label: 'Pending' },
          { value: 'APPROVED' as const, label: 'Approved' },
          { value: 'REJECTED' as const, label: 'Rejected' },
          { value: 'SUSPENDED' as const, label: 'Suspended' },
          { value: 'ALL' as const, label: 'All' },
        ]}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setOffset(0);
        }}
      />

      {applications.isLoading ? (
        <LoadingState label="Loading hospital applications…" />
      ) : applications.isError ? (
        <ErrorState message={errorMessage(applications.error)} onRetry={() => void applications.refetch()} />
      ) : applications.data && applications.data.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {applications.data.items.map((application) => {
              const pending = application.verificationStatus === 'PENDING';
              return (
                <article key={application.id} className="rounded-xl border border-ink-200/90 bg-surface-raised p-5 shadow-card">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
                        <Building2 className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-ink-900">{application.hospitalName}</h2>
                          <Badge
                            tone={
                              application.verificationStatus === 'APPROVED'
                                ? 'success'
                                : application.verificationStatus === 'PENDING'
                                  ? 'warning'
                                  : 'danger'
                            }
                            dot
                          >
                            {application.verificationStatus}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-ink-500">
                          Reg. {application.registrationNumber} · Submitted{' '}
                          {formatDateTime(application.createdAt)}
                        </p>
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-500">
                          <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                          {application.address}, {application.area}, {application.city}
                        </p>
                      </div>
                    </div>
                    {pending ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => openDialog(application, 'APPROVED')}
                          leftIcon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => openDialog(application, 'REJECTED')}
                          leftIcon={<XCircle className="size-4" aria-hidden="true" />}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="font-medium uppercase tracking-wide text-ink-500">Applicant</dt>
                      <dd className="mt-1 font-medium text-ink-800">{application.applicantName}</dd>
                      <dd className="text-ink-500">{application.applicantEmail}</dd>
                    </div>
                    <div>
                      <dt className="font-medium uppercase tracking-wide text-ink-500">Contact person</dt>
                      <dd className="mt-1 font-medium text-ink-800">{application.contactPerson}</dd>
                      <dd className="inline-flex items-center gap-1 text-ink-500">
                        <Phone className="size-3" aria-hidden="true" />
                        {application.contactPhone}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium uppercase tracking-wide text-ink-500">Official email</dt>
                      <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-800">
                        <Mail className="size-3" aria-hidden="true" />
                        {application.officialEmail}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium uppercase tracking-wide text-ink-500">Review</dt>
                      <dd className="mt-1 text-ink-700">
                        {application.verifiedByName ?? 'Not reviewed'}
                      </dd>
                      <dd className="text-ink-500">{formatDateTime(application.verifiedAt)}</dd>
                    </div>
                  </dl>

                  {application.reviewReason ? (
                    <Alert
                      variant={application.verificationStatus === 'REJECTED' ? 'danger' : 'neutral'}
                      title="Review reason"
                      className="mt-4"
                    >
                      {application.reviewReason}
                    </Alert>
                  ) : null}

                  {application.verifiedWalletAddress ? (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-500">
                      <ShieldCheck className="mt-px size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                      Prepared verifier wallet: <code className="break-all">{application.verifiedWalletAddress}</code>
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
          <Pagination
            total={applications.data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
            itemLabel="applications"
          />
        </>
      ) : (
        <EmptyState
          icon={<FileText className="size-6" aria-hidden="true" />}
          title="No hospital applications"
          description={
            status === 'PENDING'
              ? 'No applications are awaiting review.'
              : 'No applications match this status filter.'
          }
        />
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={decision === 'APPROVED' ? 'Approve hospital application' : 'Reject hospital application'}
        description={target?.hospitalName}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              variant={decision === 'APPROVED' ? 'primary' : 'danger'}
              isLoading={decide.isPending}
              onClick={submitDecision}
            >
              {decision === 'APPROVED' ? 'Approve and grant HOSPITAL role' : 'Reject application'}
            </Button>
          </>
        }
      >
        {dialogError ? <FormError>{dialogError}</FormError> : null}
        <div className="mt-3 space-y-4">
          {decision === 'APPROVED' ? (
            <Alert variant="info" title="Access granted">
              This grants the HOSPITAL role and access to the verification queue. It does not grant
              administrator privileges.
            </Alert>
          ) : (
            <Field
              label="Rejection reason"
              htmlFor="hospital-reject-reason"
              required
              hint="At least 10 characters. The applicant will see this reason."
            >
              <Textarea
                id="hospital-reject-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Registration number could not be verified with the institution."
              />
            </Field>
          )}
          {decision === 'APPROVED' ? (
            <Field label="Approval note" htmlFor="hospital-approve-reason" optional>
              <Textarea
                id="hospital-approve-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional review note."
              />
            </Field>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
