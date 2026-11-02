import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Droplets, Filter, HandHeart, PauseCircle, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useAuthToken, useAuth } from '../../context/AuthContext';
import { ApiError, api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { bloodGroupOptions, matchingNotice } from '../../lib/constants';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { Pagination } from '../../components/ui/Pagination';
import { RequestCard } from '../../components/requests/RequestCard';
import { pluralize } from '../../lib/format';
import type { BloodGroup } from '../../types/api';

const PAGE_SIZE = 12;

export function RequestsFeedPage() {
  const token = useAuthToken();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [bloodGroupDraft, setBloodGroupDraft] = useState<BloodGroup | ''>('');
  const [city, setCity] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [offset, setOffset] = useState(0);
  const activeFilters = Boolean(bloodGroup || city);

  const feed = useQuery({
    queryKey: queryKeys.feed({ bloodGroup, city, offset }),
    queryFn: ({ signal }) =>
      api.feed(
        token,
        {
          bloodGroup: bloodGroup || undefined,
          city: city || undefined,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      ),
  });

  const unfilteredFeed = useQuery({
    queryKey: queryKeys.feed({ offset: 0, unfiltered: true }),
    queryFn: ({ signal }) =>
      api.feed(token, { limit: 1, offset: 0 }, signal),
    enabled: activeFilters && feed.isSuccess && feed.data.items.length === 0,
    retry: false,
  });

  const respond = useMutation({
    mutationFn: (requestId: string) => api.respondToRequest(token, requestId),
    onSuccess: async () => {
      toast.success('Offer recorded', 'The requester can now review your offer.');
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => toast.error('Could not record your offer', errorMessage(error)),
  });

  const donor = me?.donorProfile;
  const donorUnavailable = donor && !donor.isAvailable;

  const hasUnappliedFilters =
    bloodGroupDraft !== bloodGroup || cityDraft.trim() !== city;

  const applyFilters = () => {
    setBloodGroup(bloodGroupDraft);
    setCity(cityDraft.trim());
    setOffset(0);
  };

  const clearFilters = () => {
    setBloodGroup('');
    setBloodGroupDraft('');
    setCity('');
    setCityDraft('');
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verified needs"
        title="Request feed"
        description="Browse hospital-verified blood requests. Offers are limited to your recorded exact blood group and availability."
        actions={
          <Link to="/app/requests/new" className={buttonClasses('primary', 'md')}>
            New request
          </Link>
        }
      />

      {!donor ? (
        <section className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800">
              <Droplets className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">A donor profile is needed to offer blood</p>
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-600">
                You can browse verified requests, but offers require a recorded blood group.
              </p>
            </div>
          </div>
          <Link to="/app/donor" className={buttonClasses('secondary', 'sm', 'shrink-0 bg-surface-raised')}>
            Set up donor profile
          </Link>
        </section>
      ) : !donor.isAvailable ? (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <PauseCircle className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Your availability is paused</p>
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-600">
                Browsing stays open, but offers are disabled until you resume.
              </p>
            </div>
          </div>
          <Link to="/app/donor" className={buttonClasses('secondary', 'sm', 'shrink-0 bg-surface-raised')}>
            Update availability
          </Link>
        </section>
      ) : !donor.consentToContact ? (
        <section className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-ink-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Contact sharing is off</p>
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-600">
                You can browse requests, but offers require permission to share your phone number
                after an offer is accepted. This is separate from availability.
              </p>
            </div>
          </div>
          <Link to="/app/donor" className={buttonClasses('secondary', 'sm', 'shrink-0 bg-surface-raised')}>
            Review contact choice
          </Link>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-2.5 text-[0.8125rem] text-ink-700">
          <CheckCircle2 className="size-4 shrink-0 text-accent-700" aria-hidden="true" />
          Available as <strong className="font-semibold">{donor.bloodGroup}</strong>. Your feed shows
          exact recorded blood-group matches only.
        </p>
      )}

      <section className="rounded-xl border border-ink-200/90 bg-surface-raised p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="type-title text-[0.9375rem] text-ink-900">Filter the feed</h2>
              <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-500">
                Your recorded donor blood group always takes precedence, so the feed stays
                clinically relevant.
              </p>
            </div>
          </div>
          <form
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <Field
              label="Blood group"
              htmlFor="feed-group"
              hint={
                donor
                  ? 'Locked to your recorded donor blood group.'
                  : 'Only exact blood-group matches are shown.'
              }
            >
              <Select
                id="feed-group"
                value={donor ? donor.bloodGroup : bloodGroupDraft}
                disabled={Boolean(donor)}
                onChange={(event) => {
                  setBloodGroupDraft(event.target.value as BloodGroup | '');
                }}
              >
                {donor ? null : <option value="">All groups</option>}
                {bloodGroupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="City" htmlFor="feed-city" hint="Case-insensitive partial city match.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                <Input
                  id="feed-city"
                  className="pl-9"
                  value={cityDraft}
                  onChange={(event) => setCityDraft(event.target.value)}
                  placeholder="e.g. Pune"
                />
              </div>
            </Field>
            <div className="flex gap-2">
              <Button
                type="submit"
                leftIcon={<Filter className="size-4" aria-hidden="true" />}
              >
                Apply
              </Button>
              {activeFilters || hasUnappliedFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  leftIcon={<X className="size-4" aria-hidden="true" />}
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </form>
          {hasUnappliedFilters ? (
            <p className="text-[0.6875rem] font-medium text-amber-700" role="status">
              Filter changes are not applied yet. Choose Apply to update the results.
            </p>
          ) : null}
          <p className="flex items-start gap-2 border-t border-ink-100 pt-3 text-[0.6875rem] leading-relaxed text-ink-500">
            <SlidersHorizontal className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {matchingNotice}
          </p>
        </div>
      </section>

      {feed.isLoading ? (
        <LoadingState label="Loading verified requests…" />
      ) : feed.isError ? (
        <ErrorState
          title={
            feed.error instanceof ApiError && feed.error.code === 'NETWORK_ERROR'
              ? 'Request feed is offline'
              : 'Request feed could not be loaded'
          }
          message={errorMessage(feed.error)}
          onRetry={() => void feed.refetch()}
        />
      ) : feed.data && feed.data.items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-500">
              <span className="font-semibold text-ink-800">{feed.data.total}</span>{' '}
              {pluralize(feed.data.total, 'verified request')} found
            </p>
            <p className="text-[0.6875rem] text-ink-500">
              Every request below was reviewed by an approved hospital verifier.
            </p>
          </div>

          <div className="motion-stagger grid gap-4 xl:grid-cols-2">
            {feed.data.items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/app/requests/${request.id}`}
                      className={buttonClasses('secondary', 'sm')}
                    >
                      View details
                    </Link>
                    {request.permissions.canRespond ? (
                      <Button
                        size="sm"
                        isLoading={respond.isPending && respond.variables === request.id}
                        disabled={respond.isPending}
                        onClick={() => respond.mutate(request.id)}
                        leftIcon={<HandHeart className="size-4" aria-hidden="true" />}
                      >
                        Offer to help
                      </Button>
                    ) : request.isOwner ? null : donorUnavailable ? (
                      <Badge tone="warning">Availability paused</Badge>
                    ) : donor && !donor.consentToContact ? (
                      <Badge tone="neutral">Contact sharing off</Badge>
                    ) : donor && donor.bloodGroup !== request.bloodGroup ? (
                      <Badge tone="neutral">Different blood group</Badge>
                    ) : (
                      <Badge tone="outline">Unavailable to respond</Badge>
                    )}
                  </div>
                }
              />
            ))}
          </div>

          <Pagination
            total={feed.data.total}
            limit={feed.data.limit}
            offset={feed.data.offset}
            onChange={setOffset}
            itemLabel="requests"
          />
        </>
      ) : (
        <FeedEmptyState
          activeFilters={activeFilters}
          hasDonorProfile={Boolean(donor)}
          unfilteredTotal={unfilteredFeed.data?.total}
          checkingUnfiltered={unfilteredFeed.isLoading}
          unfilteredError={unfilteredFeed.isError ? errorMessage(unfilteredFeed.error) : null}
          onRetryUnfiltered={() => void unfilteredFeed.refetch()}
          onClearFilters={clearFilters}
        />
      )}

      <Alert variant="neutral" title="Matching is not medical compatibility">
        Requests are matched using exact recorded blood-group equality, availability, consent and
        general location only. A hospital or blood bank must confirm compatibility and donor
        eligibility.
      </Alert>
    </div>
  );
}

interface FeedEmptyStateProps {
  activeFilters: boolean;
  hasDonorProfile: boolean;
  unfilteredTotal: number | undefined;
  checkingUnfiltered: boolean;
  unfilteredError: string | null;
  onRetryUnfiltered: () => void;
  onClearFilters: () => void;
}

function FeedEmptyState({
  activeFilters,
  hasDonorProfile,
  unfilteredTotal,
  checkingUnfiltered,
  unfilteredError,
  onRetryUnfiltered,
  onClearFilters,
}: FeedEmptyStateProps) {
  if (activeFilters && checkingUnfiltered) {
    return <LoadingState label="Checking for other verified requests…" className="py-8" />;
  }

  if (activeFilters && unfilteredError) {
    return (
      <div className="space-y-2">
        <ErrorState
          title="Could not confirm whether filters matched"
          message={unfilteredError}
          onRetry={onRetryUnfiltered}
          className="py-8"
        />
        <div className="text-center">
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            Reset filters
          </Button>
        </div>
      </div>
    );
  }

  if (activeFilters && (unfilteredTotal ?? 0) > 0) {
    return (
      <EmptyState
        className="py-6 sm:py-8"
        icon={<SlidersHorizontal className="size-6" aria-hidden="true" />}
        title="No requests match your filters"
        description="Try broadening or clearing your city and blood-group filters. Requests currently under hospital review are also not shown until verified."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  if (!hasDonorProfile) {
    return (
      <EmptyState
        className="py-6 sm:py-8"
        icon={<Droplets className="size-6 text-brand-600" aria-hidden="true" />}
        title="No open verified requests right now"
        description="There are no hospital-verified requests available to browse. A donor profile is only needed to submit offers; create one with an explicit blood-group choice when you are ready."
        action={
          <Link to="/app/donor" className={buttonClasses('primary', 'sm')}>
            Set up donor profile
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
    className="py-6 sm:py-8"
      icon={<Droplets className="size-6 text-accent-600" aria-hidden="true" />}
      title="No open verified requests right now"
      description="All recent requests have been fulfilled or are in hospital review. When an approved verifier validates a new request matching your blood group, it will appear here."
      action={
        <Link to="/app/requests/new" className={buttonClasses('secondary', 'sm')}>
          Submit a request
        </Link>
      }
    />
  );
}
