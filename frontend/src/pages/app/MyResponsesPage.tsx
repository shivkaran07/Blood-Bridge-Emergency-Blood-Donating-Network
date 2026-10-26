import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Droplet, HandHeart } from 'lucide-react';
import { useAuthToken, useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button, buttonClasses } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ResponseCard } from '../../components/responses/ResponseCard';

const PAGE_SIZE = 20;

export function MyResponsesPage() {
  const token = useAuthToken();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [offset, setOffset] = useState(0);

  const responses = useQuery({
    queryKey: queryKeys.myResponses(offset),
    queryFn: ({ signal }) =>
      api.myResponses(token, { limit: PAGE_SIZE, offset }, signal),
  });

  const withdraw = useMutation({
    mutationFn: (responseId: string) => api.withdrawResponse(token, responseId),
    onSuccess: async () => {
      toast.success('Offer withdrawn', 'The requester has been notified.');
      await invalidateWorkspace(queryClient);
    },
    onError: (error) => toast.error('Could not withdraw offer', errorMessage(error)),
  });

  if (!me) return null;

  if (!me.donorProfile) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Donor"
          title="My responses"
          description="Your donor offers and their current status appear here."
        />
        <EmptyState
          icon={<Droplet className="size-6" aria-hidden="true" />}
          title="Create a donor profile first"
          description="You need a recorded blood group and availability before you can offer blood."
          action={
            <Link to="/app/donor" className={buttonClasses('primary', 'sm')}>
              Create donor profile
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Donor"
        title="My responses"
        description="Track the offers you made, withdraw an active offer if circumstances change, and open the request for coordination details."
        actions={
          <Link to="/app/requests" className={buttonClasses('secondary', 'md')}>
            Browse request feed
          </Link>
        }
      />

      <Alert variant="info" title="What a response means">
        An offer tells the requester you are willing to help. It does not reserve blood or
        guarantee eligibility. A hospital must still screen you and confirm compatibility.
      </Alert>

      {responses.isLoading ? (
        <LoadingState label="Loading your responses…" />
      ) : responses.isError ? (
        <ErrorState message={errorMessage(responses.error)} onRetry={() => void responses.refetch()} />
      ) : responses.data && responses.data.length > 0 ? (
        <>
          <div className="space-y-3">
            {responses.data.map((response) => (
              <ResponseCard
                key={response.id}
                response={response}
                showRequest
                busy={withdraw.isPending && withdraw.variables === response.id}
                onWithdraw={() => withdraw.mutate(response.id)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-500">
              Showing {offset + 1}–{offset + responses.data.length} of your responses on this page.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                leftIcon={<ChevronLeft className="size-4" aria-hidden="true" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={responses.data.length < PAGE_SIZE}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                rightIcon={<ChevronRight className="size-4" aria-hidden="true" />}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<HandHeart className="size-6" aria-hidden="true" />}
          title={offset > 0 ? 'No more responses' : 'No donor offers yet'}
          description={
            offset > 0
              ? 'You have reached the end of your response history.'
              : 'When you are available, browse verified requests for your exact blood group and offer to help.'
          }
          action={
            offset > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setOffset(0)}>
                Back to first page
              </Button>
            ) : (
              <Link to="/app/requests" className={buttonClasses('primary', 'sm')}>
                Find a request
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
