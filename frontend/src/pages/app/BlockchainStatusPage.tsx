import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  ExternalLink,
  Link2,
  Network,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge, BlockchainStatusBadge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table';
import { formatDateTime } from '../../lib/format';

export function BlockchainStatusPage() {
  const token = useAuthToken();
  const status = useQuery({
    queryKey: queryKeys.blockchain,
    queryFn: ({ signal }) => api.blockchainStatus(token, signal),
  });

  if (status.isLoading) return <LoadingState label="Inspecting verification integration…" />;
  if (status.isError) {
    return <ErrorState message={errorMessage(status.error)} onRetry={() => void status.refetch()} />;
  }

  const data = status.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust layer"
        title="Verification & audit"
        description="An honest view of what Part 1 verifies, what is prepared for Part 2, and what is deliberately not active."
        actions={
          <Badge tone="warning" dot>
            Part 1 · database verification
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-ink-950 text-white">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-200">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                Current phase
              </p>
              <h2 className="mt-1 text-xl font-semibold">Database-backed verification only</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{data.explanation}</p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-white/40">Blockchain connected</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold text-white">
                <XCircle className="size-3.5 text-brand-300" aria-hidden="true" />
                No
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Operational</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold text-white">
                <XCircle className="size-3.5 text-brand-300" aria-hidden="true" />
                No
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Transactions recorded</dt>
              <dd className="mt-1 font-semibold text-white">{data.transactionsRecorded}</dd>
            </div>
            <div>
              <dt className="text-white/40">Pending anchors</dt>
              <dd className="mt-1 font-semibold text-white">{data.pendingAnchors}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Wallet className="size-4 text-ink-400" aria-hidden="true" />
            Configuration inspection
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            These values describe prepared configuration. They do not imply a working connection or
            a deployed contract.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <ConfigRow label="Integration prepared" value={data.prepared ? 'Yes' : 'No'} />
            <ConfigRow label="Enabled by environment" value={data.enabledByConfiguration ? 'Yes' : 'No'} />
            <ConfigRow label="Contract address configured" value={data.contractAddressConfigured ? 'Yes' : 'No'} />
            <ConfigRow label="Network" value={data.networkName} />
            <ConfigRow label="Chain ID" value={String(data.chainId)} />
            <ConfigRow label="Verification mode" value={data.verificationMode} />
          </dl>
          <Alert variant="warning" className="mt-4">
            A configured contract address would still not make Part 1 blockchain-verified. The
            contract and wallet integration belong to Part 2.
          </Alert>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Not scheduled"
          value={data.syncCounts.NOT_SCHEDULED}
          hint="Requests with no anchor scheduled"
          icon={<CircleDashed className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
        <StatCard
          label="Awaiting wallet"
          value={data.syncCounts.AWAITING_WALLET}
          hint="Prepared state for an authorized signer"
          icon={<Wallet className="size-4" aria-hidden="true" />}
          tone={data.syncCounts.AWAITING_WALLET > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Submitted"
          value={data.syncCounts.SUBMITTED}
          hint="Would require a real transaction hash"
          icon={<Network className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
        <StatCard
          label="Confirmed / failed"
          value={`${data.syncCounts.CONFIRMED} / ${data.syncCounts.FAILED}`}
          hint="No fabricated confirmations in Part 1"
          icon={<Link2 className="size-4" aria-hidden="true" />}
          tone="neutral"
        />
      </div>

      <SectionCard
        title="Prepared synchronization states"
        description="The application can represent each state truthfully. In Part 1 every request remains unscheduled."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(['NOT_SCHEDULED', 'AWAITING_WALLET', 'SUBMITTED', 'CONFIRMED', 'FAILED'] as const).map((state) => (
            <div key={state} className="rounded-xl border border-ink-200 p-3">
              <BlockchainStatusBadge status={state} />
              <p className="mt-2 text-2xl font-semibold text-ink-900">{data.syncCounts[state]}</p>
              <p className="mt-0.5 text-xs text-ink-400">requests</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Recorded transactions"
        description="Only real records returned by the backend are shown. Part 1 must display an empty table because no transaction is created."
      >
        {data.recentTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-6 py-10 text-center">
            <Boxes className="mx-auto size-7 text-ink-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink-900">No blockchain transactions</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-500">
              This is the correct Part 1 state. A transaction row will be created only when a real
              contract call is submitted and confirmed in Part 2.
            </p>
          </div>
        ) : (
          <Table minWidth={840}>
            <THead>
              <Th>Request</Th>
              <Th>Action</Th>
              <Th>Network</Th>
              <Th>Transaction</Th>
              <Th>Status</Th>
              <Th>Recorded</Th>
            </THead>
            <TBody>
              {data.recentTransactions.map((transaction) => (
                <Tr key={transaction.id}>
                  <Td>
                    <Link to={`/app/requests/${transaction.requestId}`} className="font-medium text-brand-700 hover:text-brand-800">
                      {transaction.requestId.slice(0, 8)}…
                    </Link>
                  </Td>
                  <Td>{transaction.action}</Td>
                  <Td className="text-xs">
                    {transaction.networkName} · {transaction.chainId}
                  </Td>
                  <Td className="max-w-52 truncate font-mono text-xs">
                    {transaction.transactionHash ?? '—'}
                  </Td>
                  <Td><Badge tone="outline">{transaction.status}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(transaction.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Database className="size-4 text-accent-600" aria-hidden="true" />
            What Part 1 does verify
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              An approved hospital account reviewed the request in this application.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              The decision, actor and reason are stored and protected by the backend and RLS.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              Each request has a cryptographically random, opaque audit reference.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              Synchronization states are modelled honestly and initialized to not scheduled.
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Clock3 className="size-4 text-ink-400" aria-hidden="true" />
            What requires Part 2
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600">
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              Solidity contract and OpenZeppelin role-based access control.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              Authorized verifier wallet challenge and MetaMask connection.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              Real transaction submission on Hardhat or Sepolia and confirmation tracking.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              A separate on-chain verification state that never overrides clinical checks.
            </li>
          </ul>
        </Card>
      </div>

      <Alert variant="info" title="Part 2 hand-off">
        {data.nextPhase}
      </Alert>

      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ExternalLink className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-800">{value}</dd>
    </div>
  );
}
