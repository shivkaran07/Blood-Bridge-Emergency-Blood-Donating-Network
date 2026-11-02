import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Deployment records: contracts/deployments/<network>.json
 *
 * Every fresh `hardhat node` produces a fresh contract address, so the local
 * record is deliberately gitignored; it is regenerated on every deploy. Real
 * secrets never live in these files - only public addresses and tx hashes.
 */
export interface DeploymentRecord {
  network: string;
  chainId: number;
  contractAddress: string;
  deployerAddress: string;
  transactionHash: string;
  blockNumber: number;
  deployedAt: string;
}

export function deploymentsDir(): string {
  return path.resolve(import.meta.dirname, '../../deployments');
}

export function deploymentRecordPath(network: string): string {
  return path.join(deploymentsDir(), `${network}.json`);
}

export function readDeploymentRecord(network: string): DeploymentRecord | undefined {
  const recordPath = deploymentRecordPath(network);
  if (!existsSync(recordPath)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(recordPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid deployment record: ${recordPath}`);
  }
  const record = parsed as Partial<DeploymentRecord>;
  const required: (keyof DeploymentRecord)[] = [
    'network',
    'chainId',
    'contractAddress',
    'deployerAddress',
    'transactionHash',
    'blockNumber',
    'deployedAt',
  ];
  for (const field of required) {
    if (record[field] === undefined) {
      throw new Error(`Deployment record ${recordPath} is missing "${field}". Redeploy.`);
    }
  }
  return parsed as DeploymentRecord;
}

export function saveDeploymentRecord(record: DeploymentRecord): void {
  mkdirSync(deploymentsDir(), { recursive: true });
  writeFileSync(
    deploymentRecordPath(record.network),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8',
  );
}
