import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Filter, HandHeart, Search, SlidersHorizontal, X } from 'lucide-react';
import { useAuthToken, useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { bloodGroupOptions, matchingNotice } from '../../lib/constants';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionCard } from '../../components/ui/Card';
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
  const [city, setCity] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [offset, setOffset] = useState(0);

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

  const activeFilters = Boolean(bloodGroup || city);

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
        <Alert variant="info" title="Create a donor profile to offer blood">
          Your feed can show verified requests, but you need a donor profile with a recorded blood
          group before you can respond. <Link to="/app/donor" className="font-semibold underline">Set up your donor profile</Link>.
        </Alert>
      ) : !donor.isAvailable ? (
        <Alert variant="warning" title="You are marked unavailable">
          You can still browse, but offers are disabled while your availability is paused.{' '}
          <Link to="/app/donor" className="font-semibold underline">Update availability</Link>.
        </Alert>
      ) : (
        <Alert variant="success" title={`Available as ${donor.bloodGroup}`}>
          Your feed is restricted to exact recorded blood-group matches. Being available does not
          confirm medical eligibility — the hospital still screens every donor.
        </Alert>
      )}

      <SectionCard
        title="Filter the feed"
        description="Filters apply to verified requests. Your recorded donor blood group always takes precedence, so the feed stays clinically relevant."
        bodyClassName="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
          <Field label="Blood group" htmlFor="feed-group">
            <Select
              id="feed-group"
              value={bloodGroup}
              onChange={(event) => {
                setBloodGroup(event.target.value as BloodGroup | '');
                setOffset(0);
              }}
            >
              <option value="">All groups</option>
              {bloodGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City" htmlFor="feed-city" hint="Case-insensitive partial city match.">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
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
              leftIcon={<Filter className="size-4" aria-hidden="true" />}
              onClick={() => {
                setCity(cityDraft.trim());
                setOffset(0);
              }}
            >
              Apply
            </Button>
            {activeFilters ? (
              <Button
                variant="ghost"
                leftIcon={<X className="size-4" aria-hidden="true" />}
                onClick={() => {
                  setBloodGroup('');
                  setCity('');
                  setCityDraft('');
                  setOffset(0);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
          <SlidersHorizontal className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {matchingNotice}
        </p>
      </SectionCard>

      {feed.isLoading ? (
        <LoadingState label="Loading verified requests…" />
      ) : feed.isError ? (
        <ErrorState message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />
      ) : feed.data && feed.data.items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-500">
              <span className="font-semibold text-ink-800">{feed.data.total}</span>{' '}
              {pluralize(feed.data.total, 'verified request')} found
            </p>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot>
                Hospital reviewed
              </Badge>
              <Badge tone="outline">Database verified</Badge>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
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
                    ) : request.isOwner ? (
                      <Badge tone="outline">Your request</Badge>
                    ) : donorUnavailable ? (
                      <Badge tone="warning">Availability paused</Badge>
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
        <EmptyState
          icon={<Droplets className="size-6" aria-hidden="true" />}
          title="No verified requests match"
          description={
            activeFilters
              ? 'Try clearing the city or blood-group filter. Hospital review may also still be in progress for nearby requests.'
              : 'There are no open, verified requests in the feed right now. Check back later or adjust your filters.'
          }
          action={
            activeFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setBloodGroup('');
                  setCity('');
                  setCityDraft('');
                  setOffset(0);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
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
