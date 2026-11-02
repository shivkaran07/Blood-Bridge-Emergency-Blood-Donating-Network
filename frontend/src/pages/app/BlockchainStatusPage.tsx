import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  Fingerprint,
  Link2,
  Lock,
  Network,
  RefreshCw,
  ShieldCheck,
  Unlink,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import {
  describeVerification,
  useVerificationStatus,
} from '../../lib/verificationStatus';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge, BlockchainStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table';
import { formatDateTime } from '../../lib/format';
import { cn } from '../../lib/cn';

function explorerUrl(chainId: number, hash: string | null): string | null {
  if (!hash) return null;
  // Only link chains whose explorer we can name confidently. A local chain has
  // no public explorer, so the hash is shown as text instead of a dead link.
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${hash}`;
  return null;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function BlockchainStatusPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [unbindOpen, setUnbindOpen] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connectedChainId, setConnectedChainId] = useState<number | null>(null);

  const status = useVerificationStatus();

  const wallet = useQuery({
    queryKey: ['wallet', 'status'],
    queryFn: () => api.walletStatus(token),
  });

  const refreshAll = async () => {
    await Promise.all([status.refetch(), wallet.refetch()]);
  };

  /**
   * Step 1: connect the browser wallet. This asks for account access only and
   * does not sign anything or bind the account.
   */
  const connectWallet = useMutation({
    mutationFn: async () => {
      if (!window.ethereum) {
        throw new Error(
          'MetaMask was not detected. Install a browser wallet that supports Ethereum, then retry.',
        );
      }
      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum);
      const accounts = (await provider.send('eth_requestAccounts', [])) as string[];
      const address = accounts[0];
      if (!address) throw new Error('No wallet account was made available.');
      const network = await provider.getNetwork();
      return { address, chainId: Number(network.chainId) };
    },
    onSuccess: ({ address, chainId }) => {
      setWalletError(null);
      setConnectedAddress(address);
      setConnectedChainId(chainId);
      toast.info('Wallet connected', 'No account binding has been created yet.');
    },
    onError: (error) => {
      const message = errorMessage(error);
      setWalletError(message);
      toast.error('Could not connect wallet', message);
    },
  });

  /**
   * Step 2: prove ownership by signing a backend-issued challenge. This binds
   * the wallet to the account; it does not grant an on-chain verifier role.
   */
  const verifyWalletOwnership = useMutation({
    mutationFn: async () => {
      if (!window.ethereum) {
        throw new Error(
          'MetaMask was not detected. Install a browser wallet that supports Ethereum, then retry.',
        );
      }
      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum);
      const accounts = (await provider.send('eth_requestAccounts', [])) as string[];
      const address = connectedAddress ?? accounts[0];
      if (!address) throw new Error('Connect a wallet before verifying ownership.');
      if (
        walletData?.walletAddress &&
        address.toLowerCase() !== walletData.walletAddress.toLowerCase()
      ) {
        throw new Error(
          'The connected wallet does not match the wallet currently bound to this account. Unbind the old wallet before binding a different one.',
        );
      }
      setConnectedAddress(address);
      const challenge = await api.walletChallenge(token, address);
      const signer = await provider.getSigner(address);
      const signature = await signer.signMessage(challenge.message);
      return api.verifyWallet(token, challenge.message, signature);
    },
    onSuccess: async (binding) => {
      setWalletError(null);
      toast.success(
        'Wallet ownership verified',
        `${shortAddress(binding.walletAddress)} is bound to your account. This proves key control only and does not grant verifier rights.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      await refreshAll();
    },
    onError: (error) => {
      const message = errorMessage(error);
      setWalletError(message);
      toast.error('Wallet ownership verification failed', message);
    },
  });

  const unbindWallet = useMutation({
    mutationFn: () => api.unbindWallet(token),
    onSuccess: async () => {
      setUnbindOpen(false);
      toast.success('Wallet unbound', 'Your account no longer has a verified wallet binding.');
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      await refreshAll();
    },
    onError: (error) => toast.error('Could not unbind wallet', errorMessage(error)),
  });

  if (status.isLoading) return <LoadingState label="Inspecting verification integration…" />;
  if (status.isError) {
    return <ErrorState message={errorMessage(status.error)} onRetry={() => void status.refetch()} />;
  }

  const data = status.data;
  if (!data) return null;

  const walletData = wallet.data;
  const presentation = describeVerification(data);
  const onChain = data.verificationMode === 'ON_CHAIN';
  const operationsNeedingAttention = (data.operations ?? []).filter((operation) =>
    ['PENDING', 'SUBMITTED', 'FAILED', 'NEEDS_RECONCILIATION'].includes(operation.status),
  );
  const connectedMatchesBinding =
    !connectedAddress ||
    !walletData?.walletAddress ||
    connectedAddress.toLowerCase() === walletData.walletAddress.toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust layer"
        title="Verification & audit"
        description="Live configuration, wallet binding and synchronization status for the verification audit layer. The backend is the source of truth — this page never guesses a transaction state."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refreshAll()}
              isLoading={status.isFetching || wallet.isFetching}
              leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
            >
              Refresh
            </Button>
            <Badge tone={presentation.tone} dot>
              {presentation.label}
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="mesh-dark overflow-hidden border-white/10 text-white">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300 ring-1 ring-white/10">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Active verification mode
                </p>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold',
                    presentation.tone === 'success'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                      : presentation.tone === 'warning'
                        ? 'border-amber-300/30 bg-amber-300/10 text-amber-200'
                        : 'border-white/20 bg-white/5 text-white/70',
                  )}
                >
                  {presentation.label}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white">{presentation.title}</h2>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-white/70">
                {presentation.detail}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-white/45">Database decisions</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold text-white">
                <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
                <span>Operational</span>
              </dd>
            </div>
            <div>
              <dt className="text-white/45">Chain reachability</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold text-white">
                {!onChain ? (
                  <span className="text-white/60">Not active in DB mode</span>
                ) : data.connected ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Reachable</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5 text-amber-300" aria-hidden="true" />
                    <span>Unreachable</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-white/45">Contract</dt>
              <dd className="mt-1 font-semibold text-white">
                {!onChain
                  ? 'Not configured'
                  : data.contractAddressConfigured
                    ? data.operational
                      ? 'Operational'
                      : 'Configured, not operational'
                    : 'Not configured'}
              </dd>
            </div>
            <div>
              <dt className="text-white/45">Transactions stored</dt>
              <dd className="mt-1 font-semibold tabular text-white">{data.transactionsRecorded}</dd>
            </div>
            <div>
              <dt className="text-white/45">Pending anchors</dt>
              <dd className="mt-1 font-semibold tabular text-white">{data.pendingAnchors}</dd>
            </div>
            <div>
              <dt className="text-white/45">Synchronization failures</dt>
              <dd className="mt-1 font-semibold tabular text-white">
                {presentation.syncIssueCount > 0 ? (
                  <span className="text-amber-200">{presentation.syncIssueCount} need attention</span>
                ) : (
                  <span className="text-white/60">None recorded</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-white/10 pt-2.5 text-[0.65rem] leading-relaxed text-white/40">
            Last checked {formatDateTime(new Date(status.dataUpdatedAt).toISOString())}. Normal database-only operation
            is not an error.
          </p>
          {onChain && data.chainHealth?.error ? (
            <Alert variant="danger" className="mt-3">
              Chain health probe: {data.chainHealth.error}
            </Alert>
          ) : null}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Wallet className="size-4 text-ink-500" aria-hidden="true" />
            Verifier wallet
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Connecting a wallet, proving ownership and holding an on-chain verifier role are three
            separate things. Proving key control never grants verifier privileges.
          </p>

          {!onChain ? (
            <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50/70 p-2.5 text-[0.75rem] leading-relaxed text-ink-600">
              <span className="font-semibold text-ink-800">Database mode active:</span> verification
              decisions are recorded in the relational database. Binding a wallet is optional and has
              no effect on hospital review permissions.
            </div>
          ) : null}

          {wallet.isError ? (
            <Alert variant="danger" className="mt-4" title="Wallet status unavailable">
              <div className="space-y-2">
                <p>{errorMessage(wallet.error)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={wallet.isFetching}
                  onClick={() => void wallet.refetch()}
                >
                  Retry wallet status
                </Button>
              </div>
            </Alert>
          ) : wallet.isLoading ? (
            <p className="mt-4 text-sm text-ink-500">Checking wallet binding…</p>
          ) : walletData?.bound ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-800">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Wallet ownership verified
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  <code className="break-all text-xs font-medium text-ink-800">
                    {walletData.walletAddress}
                  </code>
                  {walletData.walletAddress ? (
                    <CopyButton value={walletData.walletAddress} label="Copy wallet address" />
                  ) : null}
                </div>
                <p className="mt-1 text-[0.7rem] text-ink-500">
                  Bound to chain {walletData.chainId ?? 'unknown'} · verified{' '}
                  {formatDateTime(walletData.verifiedAt)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2">
                <div>
                  <span className="block text-xs font-medium text-ink-700">On-chain verifier role</span>
                  <span className="block text-[0.6875rem] text-ink-400">
                    {walletData.onChainRoleStatus === 'GRANTED'
                      ? 'Contract granted verifier authorization'
                      : walletData.onChainRoleStatus === 'UNAVAILABLE'
                        ? 'Role status could not be checked — RPC may be unavailable'
                        : walletData.onChainRoleStatus === 'NOT_APPLICABLE'
                          ? 'Blockchain mode not configured'
                          : 'Requires contract admin authorization to submit anchors'}
                  </span>
                </div>
                <Badge
                  tone={
                    walletData.onChainRoleStatus === 'GRANTED'
                      ? 'success'
                      : walletData.onChainRoleStatus === 'UNAVAILABLE'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {walletData.onChainRoleStatus === 'GRANTED'
                    ? 'Granted'
                    : walletData.onChainRoleStatus === 'UNAVAILABLE'
                      ? 'Unavailable'
                      : walletData.onChainRoleStatus === 'NOT_APPLICABLE'
                        ? 'N/A'
                        : 'Not granted'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={verifyWalletOwnership.isPending}
                  onClick={() => verifyWalletOwnership.mutate()}
                  leftIcon={<Fingerprint className="size-4" aria-hidden="true" />}
                >
                  Re-verify ownership
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnbindOpen(true)}
                  leftIcon={<Unlink className="size-4" aria-hidden="true" />}
                >
                  Unbind wallet
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
                  <Wallet className="size-4 text-ink-500" aria-hidden="true" />
                  No wallet bound
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  {onChain
                    ? 'A verified wallet is required before this account can submit an anchor transaction.'
                    : 'A wallet is only needed when the deployment enables on-chain anchoring. You may bind one in advance.'}
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-ink-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-800">1. Connect browser wallet</p>
                    <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-500">
                      {connectedAddress
                        ? `Connected: ${shortAddress(connectedAddress)}${
                            connectedChainId ? ` · chain ${connectedChainId}` : ''
                          }`
                        : 'Requests account access only. No signature or binding yet.'}
                    </p>
                  </div>
                  {connectedAddress ? (
                    <Badge tone="success" dot>
                      Connected
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  isLoading={connectWallet.isPending}
                  onClick={() => connectWallet.mutate()}
                  leftIcon={<Wallet className="size-4" aria-hidden="true" />}
                >
                  {connectedAddress ? 'Reconnect wallet' : 'Connect wallet'}
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-ink-200 p-3">
                <div>
                  <p className="text-xs font-semibold text-ink-800">2. Verify wallet ownership</p>
                  <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-500">
                    Signs a one-time backend challenge. This binds the address to your account, but
                    does not grant the on-chain verifier role.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  isLoading={verifyWalletOwnership.isPending}
                  disabled={!connectedAddress || !connectedMatchesBinding}
                  onClick={() => verifyWalletOwnership.mutate()}
                  leftIcon={<Fingerprint className="size-4" aria-hidden="true" />}
                >
                  Verify wallet ownership
                </Button>
                {!connectedAddress ? (
                  <p className="text-[0.65rem] text-ink-500">Connect a wallet to continue.</p>
                ) : null}
              </div>

              {!onChain ? (
                <p className="text-[0.65rem] leading-relaxed text-ink-500">
                  Optional in database mode. Binding is only required if this deployment later
                  enables on-chain audit anchoring.
                </p>
              ) : null}
            </div>
          )}

          {walletError ? (
            <Alert variant="danger" className="mt-3">
              {walletError}
            </Alert>
          ) : null}
          {walletData?.note ? (
            <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-500">{walletData.note}</p>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
          hint="Prepared for an authorized signer"
          icon={<Wallet className="size-4" aria-hidden="true" />}
          tone={data.syncCounts.AWAITING_WALLET > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Submitted"
          value={data.syncCounts.SUBMITTED}
          hint="Hash stored, awaiting confirmation"
          icon={<Network className="size-4" aria-hidden="true" />}
          tone={data.syncCounts.SUBMITTED > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Confirmed"
          value={data.syncCounts.CONFIRMED}
          hint="Receipt-validated anchors"
          icon={<Link2 className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <StatCard
          label="Failed / reconcile"
          value={`${data.syncCounts.FAILED} / ${data.syncCounts.NEEDS_RECONCILIATION}`}
          hint="Failed anchors / manual reconciliation"
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
          tone={
            data.syncCounts.FAILED + data.syncCounts.NEEDS_RECONCILIATION > 0
              ? 'warning'
              : 'neutral'
          }
        />
      </div>

      {operationsNeedingAttention.length > 0 ? (
        <SectionCard
          title="Anchor operations needing attention"
          description="These are backend-reported operations, not confirmation that a transaction succeeded."
          actions={<Badge tone="warning">{operationsNeedingAttention.length}</Badge>}
        >
          <ul className="divide-y divide-ink-100">
            {operationsNeedingAttention.map((operation) => (
              <li
                key={operation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    to={`/app/requests/${operation.requestId}`}
                    className="text-sm font-semibold text-brand-accent hover:text-brand-accent-strong"
                  >
                    REQ-{operation.requestId.slice(0, 8).toUpperCase()}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {operation.action} · {operation.networkName} · chain {operation.chainId} ·{' '}
                    {formatDateTime(operation.createdAt)}
                  </p>
                  {operation.transactionHash ? (
                    <p className="mt-1 break-all font-mono text-[0.6875rem] text-ink-600">
                      Transaction submitted: {operation.transactionHash}
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.6875rem] text-ink-500">
                      No transaction hash reported by the backend.
                    </p>
                  )}
                </div>
                <Badge
                  tone={
                    operation.status === 'FAILED' || operation.status === 'NEEDS_RECONCILIATION'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {operation.status}
                </Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Configuration inspection"
        description="These values come from the backend's live probe. A configured address alone is not proof that the chain is reachable."
      >
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <ConfigRow label="Integration prepared" value={data.prepared ? 'Yes' : 'No'} />
          <ConfigRow label="Enabled by environment" value={data.enabledByConfiguration ? 'Yes' : 'No'} />
          <ConfigRow label="Contract address configured" value={data.contractAddressConfigured ? 'Yes' : 'No'} />
          <ConfigRow label="Network" value={data.networkName} />
          <ConfigRow label="Chain ID" value={String(data.chainId)} />
          <ConfigRow label="Verification mode" value={data.verificationMode} />
        </dl>
        {data.contractAddress ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
            <span className="text-xs font-medium text-ink-500">Contract</span>
            <code className="break-all text-xs font-medium text-ink-800">{data.contractAddress}</code>
            <CopyButton value={data.contractAddress} label="Copy contract address" />
          </div>
        ) : null}
        <Alert variant="warning" className="mt-4">
          A confirmed transaction only records that an authorized wallet submitted a decision. It
          does not validate medical facts, donor eligibility, blood compatibility or the physical
          availability of blood.
        </Alert>
      </SectionCard>

      <SectionCard
        title="Recorded transactions"
        description="Only transaction records returned by the backend are shown. A pending operation is not a confirmed transaction, and no demo hashes are generated."
        actions={
          <Badge tone="outline">
            {data.recentTransactions.length} shown
          </Badge>
        }
      >
        {data.recentTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-5 py-6 text-center">
            <Boxes className="mx-auto size-7 text-ink-500" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink-900">No transactions recorded</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-500">
              {onChain
                ? 'No anchor operation has been prepared or submitted yet. Hashes appear only after a real wallet transaction is confirmed by the backend.'
                : 'This deployment is in database mode. Switch the backend to on-chain verification to record real anchoring transactions.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {data.recentTransactions.map((transaction) => {
                const href = explorerUrl(transaction.chainId, transaction.transactionHash);
                return (
                  <li
                    key={transaction.id}
                    className="rounded-xl border border-ink-200 bg-surface-raised p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/app/requests/${transaction.requestId}`}
                          className="text-sm font-semibold text-brand-accent hover:text-brand-accent-strong"
                        >
                          REQ-{transaction.requestId.slice(0, 8).toUpperCase()}
                        </Link>
                        <p className="mt-1 text-[0.6875rem] text-ink-500">
                          {formatDateTime(transaction.createdAt)}
                        </p>
                      </div>
                      <Badge
                        tone={
                          transaction.status === 'CONFIRMED'
                            ? 'success'
                            : transaction.status === 'FAILED'
                              ? 'danger'
                              : 'outline'
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink-100 pt-3 text-[0.75rem]">
                      <div>
                        <dt className="text-ink-500">Action</dt>
                        <dd className="mt-0.5 font-mono text-[0.7rem] font-medium text-ink-800">
                          {transaction.action}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-500">Network</dt>
                        <dd className="mt-0.5 text-ink-800">
                          {transaction.networkName} · {transaction.chainId}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-ink-500">Transaction</dt>
                        <dd className="mt-0.5 flex min-w-0 items-center gap-1">
                          {transaction.transactionHash ? (
                            <>
                              <code className="min-w-0 break-all text-[0.7rem] text-ink-800">
                                {shortAddress(transaction.transactionHash)}
                              </code>
                              <CopyButton
                                value={transaction.transactionHash}
                                label="Copy transaction hash"
                              />
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                                  aria-label="Open transaction in Etherscan"
                                >
                                  <ExternalLink className="size-4" aria-hidden="true" />
                                </a>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-ink-500">No hash yet</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block">
              <Table minWidth={920}>
                <THead>
                  <Th>Request</Th>
                  <Th>Action</Th>
                  <Th>Network</Th>
                  <Th>Transaction</Th>
                  <Th>Status</Th>
                  <Th>Recorded</Th>
                </THead>
                <TBody>
                  {data.recentTransactions.map((transaction) => {
                    const href = explorerUrl(transaction.chainId, transaction.transactionHash);
                    return (
                      <Tr key={transaction.id}>
                        <Td>
                          <Link
                            to={`/app/requests/${transaction.requestId}`}
                            className="font-medium text-brand-accent hover:text-brand-accent-strong"
                          >
                            {transaction.requestId.slice(0, 8)}…
                          </Link>
                        </Td>
                        <Td>
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-700">
                            {transaction.action}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-xs">
                          {transaction.networkName} · {transaction.chainId}
                        </Td>
                        <Td>
                          {transaction.transactionHash ? (
                            <span className="flex items-center gap-1">
                              <code className="text-xs">
                                {shortAddress(transaction.transactionHash)}
                              </code>
                              <CopyButton
                                value={transaction.transactionHash}
                                label="Copy transaction hash"
                              />
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                                  aria-label="Open transaction in Etherscan"
                                >
                                  <ExternalLink className="size-4" aria-hidden="true" />
                                </a>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-500">No hash yet</span>
                          )}
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              transaction.status === 'CONFIRMED'
                                ? 'success'
                                : transaction.status === 'FAILED'
                                  ? 'danger'
                                  : 'outline'
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-xs">
                          {formatDateTime(transaction.createdAt)}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </>
        )}
        {data.recentTransactions.some(
          (transaction) => transaction.transactionHash && !explorerUrl(transaction.chainId, transaction.transactionHash),
        ) ? (
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Hashes on a local or unrecognized network have no public explorer link. Copy the hash
            and inspect it with your own node.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Prepared synchronization states"
        description="Counts are read from the application database, not estimated in the browser."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(['NOT_SCHEDULED', 'AWAITING_WALLET', 'SUBMITTED', 'CONFIRMED', 'FAILED'] as const).map(
            (state) => (
              <div
                key={state}
                className={cn(
                  'rounded-xl border p-3',
                  state === 'CONFIRMED' && data.syncCounts[state] > 0
                    ? 'border-accent-200 bg-accent-50/50'
                    : 'border-ink-200',
                )}
              >
                <BlockchainStatusBadge status={state} />
                <p className="mt-2 text-2xl font-semibold tabular text-ink-900">
                  {data.syncCounts[state]}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {data.syncCounts[state] === 1 ? 'request' : 'requests'}
                </p>
              </div>
            ),
          )}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Database className="size-4 text-accent-600" aria-hidden="true" />
            What this layer can prove
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              An approved hospital account reviewed the request inside this application.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              The decision, actor and reason are stored by the backend and protected by
              authorization and row-level security.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              Each request carries a random, opaque audit reference rather than personal data.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
              {onChain
                ? 'Where an anchor exists, the backend independently validated the receipt and contract event.'
                : 'Synchronization states are modelled honestly and remain not scheduled in database mode.'}
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
            Limitations and failure modes
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600">
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              Wallet confirmation depends on the browser wallet and the configured network.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              Wallet ownership alone never grants hospital or verifier permissions.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              Database and chain outages can leave an operation pending or in need of
              reconciliation.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              An on-chain record is an audit signal, not a clinical clearance.
            </li>
          </ul>
        </Card>
      </div>

      <Alert variant="info" title="Roadmap boundary">
        {data.nextPhase}
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <Lock className="size-3.5" aria-hidden="true" />
          Personal data is never written to the chain.
        </p>
      </div>

      <Modal
        open={unbindOpen}
        onClose={() => setUnbindOpen(false)}
        title="Unbind this wallet?"
        description="The wallet address is removed from your account. Any anchor operation already submitted on-chain remains on-chain and cannot be deleted."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnbindOpen(false)}>
              Keep binding
            </Button>
            <Button
              variant="danger"
              isLoading={unbindWallet.isPending}
              onClick={() => unbindWallet.mutate()}
              leftIcon={<Unlink className="size-4" aria-hidden="true" />}
            >
              Unbind wallet
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-600">
          You will need to sign a new challenge before you can anchor another decision.
        </p>
      </Modal>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-2 last:border-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-800">{value}</dd>
    </div>
  );
}
