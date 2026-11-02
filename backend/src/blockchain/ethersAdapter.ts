import { Contract, JsonRpcProvider, type Provider, type TransactionReceipt } from 'ethers';

import { BLOODBRIDGE_ABI } from './abi.js';
import type { AppConfig } from '../config/env.js';
import type { Logger } from '../lib/logger.js';
import {
  auditKeyToBytes32,
  type AnchorExpectation,
  type AnchorVerification,
  type ChainAdapter,
  type ChainHealth,
  type OnChainStatus,
} from './adapter.js';

type BloodBridgeContract = Contract & {
  VERIFIER_ROLE(): Promise<string>;
  getRequestStatus(auditKey: string): Promise<number>;
  hasRequestRecord(auditKey: string): Promise<boolean>;
  hasRole(role: string, account: string): Promise<boolean>;
};

const ANCHOR_EVENT_NAMES = ['RequestVerified', 'RequestRejected', 'RequestStatusChanged'] as const;

/**
 * Real ethers.js adapter over an HTTP JSON-RPC endpoint (hardhat node locally).
 * Reads only: every mutating action is wallet signed; the backend validates
 * receipts, events and contract state independently of the frontend.
 */
export class EthersChainAdapter implements ChainAdapter {
  readonly verificationMode = 'ON_CHAIN' as const;

  private readonly provider: Provider;
  private readonly configuredChainId: number;
  private readonly confirmations: number;
  private readonly timeoutMs: number;
  private readonly contract: BloodBridgeContract | null;
  private readonly logger: Logger;

  constructor(
    config: Pick<
      AppConfig['blockchain'],
      'rpcUrl' | 'chainId' | 'contractAddress' | 'confirmations' | 'receiptTimeoutMs'
    >,
    logger: Logger,
  ) {
    this.logger = logger;
    this.provider = new JsonRpcProvider(config.rpcUrl, config.chainId, {
      staticNetwork: true,
    });
    this.configuredChainId = config.chainId;
    this.confirmations = config.confirmations;
    this.timeoutMs = config.receiptTimeoutMs;
    this.contract = config.contractAddress
      ? (new Contract(
          config.contractAddress,
          BLOODBRIDGE_ABI as unknown as Parameters<typeof Contract.bind>[1],
          this.provider,
        ) as BloodBridgeContract)
      : null;
  }

  contractAddress(): string | null {
    return this.contract?.target ? String(this.contract.target) : null;
  }

  private chainContract(): BloodBridgeContract {
    if (this.contract === null) {
      throw new Error(
        'No BloodBridge contract address is configured. Deploy the contract first.',
      );
    }
    return this.contract;
  }

  async getHealth(): Promise<ChainHealth> {
    try {
      const latestBlock = await withTimeout(
        this.provider.getBlockNumber(),
        this.timeoutMs,
        'chain health check',
      );
      const chainId = Number((await this.provider.getNetwork()).chainId);
      return { connected: true, chainId, latestBlock, error: null };
    } catch (error) {
      this.logger.warn({ errMessage: (error as Error).message }, 'Chain health check failed');
      return {
        connected: false,
        chainId: null,
        latestBlock: null,
        error: (error as Error).message,
      };
    }
  }

  async isVerifier(address: string): Promise<boolean> {
    const role = await this.chainContract().VERIFIER_ROLE();
    return this.chainContract().hasRole(role, address);
  }

  async getOnChainStatus(auditKey: string): Promise<OnChainStatus> {
    const value = await this.chainContract().getRequestStatus(auditKeyToBytes32(auditKey));
    return decodeEnum(value);
  }

  async verifyAnchorTx(
    transactionHash: string,
    expectation: AnchorExpectation,
  ): Promise<AnchorVerification> {
    const contract = this.chainContract();

    let receipt: TransactionReceipt | null;
    try {
      receipt = await waitForReceipt(
        this.provider,
        transactionHash,
        this.confirmations,
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof AnchorTimeoutError) {
        return {
          ok: false,
          reason: 'RECEIPT_TIMEOUT',
          message: `No receipt for ${transactionHash} within ${Math.round(this.timeoutMs / 1000)}s. The operation stays open for reconciliation.`,
          retryable: true,
        };
      }
      return {
        ok: false,
        reason: 'RPC_ERROR',
        message:
          `Could not retrieve the transaction receipt: ${(error as Error).message}. ` +
          'The operation stays open for reconciliation.',
        retryable: true,
      };
    }

    if (receipt === null) {
      return {
        ok: false,
        reason: 'RECEIPT_NOT_FOUND',
        message: `Transaction ${transactionHash} is not on the chain yet. The operation stays open for reconciliation.`,
        retryable: true,
      };
    }

    if (receipt.status === null || receipt.status === 0) {
      return {
        ok: false,
        reason: 'TX_REVERTED',
        message: `Transaction ${transactionHash} reverted. It is recorded as failed and the request database status was NOT changed.`,
        retryable: false,
      };
    }

    const chainId = Number((await this.provider.getNetwork()).chainId);
    if (chainId !== this.configuredChainId) {
      return {
        ok: false,
        reason: 'CHAIN_MISMATCH',
        message: `The transaction was mined on chain ${chainId}, not the configured chain ${this.configuredChainId}.`,
        retryable: false,
      };
    }

    const fromAddress = (receipt.from ?? '').toLowerCase();
    if (fromAddress !== expectation.expectedFrom.toLowerCase()) {
      return {
        ok: false,
        reason: 'SENDER_MISMATCH',
        message:
          `The transaction was sent from ${fromAddress}, but the verified ` +
          `wallet for this account is ${expectation.expectedFrom}.`,
        retryable: false,
      };
    }

    const toAddress = (receipt.to ?? '').toLowerCase();
    const expectedTo = expectation.contractAddress.toLowerCase();
    if (toAddress !== expectedTo) {
      return {
        ok: false,
        reason: 'RECIPIENT_MISMATCH',
        message:
          `The transaction was mined against ${toAddress}, not the configured ` +
          `BloodBridge contract ${expectedTo}.`,
        retryable: false,
      };
    }

    const event = findAnchorEvent(contract, receipt, expectation.auditKey);
    if (event === null) {
      return {
        ok: false,
        reason: 'EVENT_MISMATCH',
        message: `The receipt contains no BloodBridge anchor event for audit key ${expectation.auditKey}.`,
        retryable: false,
      };
    }

    if (event.toStatus !== expectation.expectedToStatus) {
      return {
        ok: false,
        reason: 'EVENT_MISMATCH',
        message:
          `The emitted event reports ${event.toStatus}, expected ` +
          `${expectation.expectedToStatus} for audit key ${expectation.auditKey}.`,
        retryable: false,
      };
    }

    if (event.actor !== fromAddress) {
      return {
        ok: false,
        reason: 'EVENT_MISMATCH',
        message:
          `The event actor ${event.actor} does not match the transaction sender ${fromAddress}.`,
        retryable: false,
      };
    }

    const contractStatus = await this.getOnChainStatus(expectation.auditKey);
    if (contractStatus !== expectation.expectedToStatus) {
      return {
        ok: false,
        reason: 'CONTRACT_STATE_MISMATCH',
        message:
          `On-chain state for ${expectation.auditKey} is ${contractStatus}, expected ` +
          `${expectation.expectedToStatus}. The database was NOT updated.`,
        retryable: false,
      };
    }

    return {
      ok: true,
      transactionHash,
      chainId,
      contractAddress: expectation.contractAddress,
      blockNumber: receipt.blockNumber,
      fromAddress,
      toAddress,
      contractStatus,
      eventStatus: event.toStatus,
      eventActor: event.actor,
      eventBlockTimestampSeconds: event.blockTimestampSeconds,
    };
  }
}

function decodeEnum(value: number | bigint): OnChainStatus {
  const map: Record<number, OnChainStatus> = {
    0: 'NONE',
    1: 'VERIFIED',
    2: 'REJECTED',
    3: 'CANCELLED',
    4: 'COMPLETED',
  };
  return map[Number(value)] ?? 'NONE';
}

class AnchorTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnchorTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AnchorTimeoutError(`${label} timed out after ${ms} ms.`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitForReceipt(
  provider: Provider,
  hash: string,
  confirmations: number,
  timeoutMs: number,
): Promise<TransactionReceipt | null> {
  return withTimeout(
    provider.waitForTransaction(hash, confirmations, timeoutMs),
    timeoutMs + 5_000,
    'waiting for the transaction receipt',
  );
}

interface AnchorEventInfo {
  toStatus: OnChainStatus;
  actor: string;
  blockTimestampSeconds: number;
}

function findAnchorEvent(
  contract: BloodBridgeContract,
  receipt: TransactionReceipt,
  auditKey: string,
): AnchorEventInfo | null {
  const bytesKey = auditKeyToBytes32(auditKey);
  for (const log of receipt.logs) {
    let parsed: ReturnType<typeof contract.interface.parseLog>;
    try {
      parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (parsed === null || !ANCHOR_EVENT_NAMES.includes(parsed.name as never)) continue;

    const args = parsed.args.toArray();
    if (String(args[0]).toLowerCase() !== bytesKey.toLowerCase()) continue;

    if (parsed.name === 'RequestStatusChanged') {
      // (auditKey, fromStatus, toStatus, actor, at)
      return {
        toStatus: decodeEnum(Number(args[2])),
        actor: String(args[3]).toLowerCase(),
        blockTimestampSeconds: Number(args[4]),
      };
    }
    // RequestVerified / RequestRejected: (auditKey, actor, at)
    return {
      toStatus: parsed.name === 'RequestVerified' ? 'VERIFIED' : 'REJECTED',
      actor: String(args[1]).toLowerCase(),
      blockTimestampSeconds: Number(args[2]),
    };
  }
  return null;
}
