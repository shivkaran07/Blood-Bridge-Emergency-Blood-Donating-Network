import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface Artifact {
  contractName: string;
  sourceName: string;
  abi: unknown[];
}

const ROOT = path.resolve(import.meta.dirname, '../..');
const ARTIFACT_PATH = path.join(
  ROOT,
  'artifacts/contracts/BloodBridge.sol/BloodBridge.json',
);
const BACKEND_TARGET = path.resolve(ROOT, '../backend/src/blockchain/abi.ts');
const FRONTEND_TARGET = path.resolve(
  ROOT,
  '../frontend/src/lib/blockchain/bloodbridgeAbi.ts',
);

const GENERATOR_NOTE =
  'Generated from contracts/artifacts by `npm run contracts:sync-abi`. Do not edit by hand.';

function readArtifact(): Artifact {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error(
      'BloodBridge.json artifact not found. Run `npm run contracts:compile` first.',
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Artifact).abi)
  ) {
    throw new Error('Malformed BloodBridge.json artifact.');
  }
  return parsed as Artifact;
}

function abiIn(sourceName: string, contractName: string, abi: unknown): string {
  const body = JSON.stringify(abi, null, 2).split('\n').join('\n  ');
  const out: string[] = [];
  out.push('/**');
  out.push(` * ${GENERATOR_NOTE}`);
  out.push(` * Source: ${sourceName} (${contractName}).`);
  out.push(' */');
  out.push('export const BLOODBRIDGE_ABI = [');
  out.push(`  ${body.trim()}`);
  out.push('] as const;');
  out.push('');
  out.push(`export const BLOODBRIDGE_CONTRACT_NAME = '${contractName}';`);
  out.push('');
  return out.join('\n');
}

/**
 * Writes the contract ABI as TypeScript modules into the backend and the
 * frontend. Regenerating from the artifact keeps every consumer in lock-step
 * with the deployed bytecode.
 */
export function syncAbi(): { backend: string; frontend: string } {
  const artifact = readArtifact();
  const backendFile = abiIn(artifact.sourceName, artifact.contractName, artifact.abi);
  const frontendFile = abiIn(artifact.sourceName, artifact.contractName, artifact.abi);

  writeFileSync(BACKEND_TARGET, backendFile, 'utf8');
  mkdirSync(path.dirname(FRONTEND_TARGET), { recursive: true });
  writeFileSync(FRONTEND_TARGET, frontendFile, 'utf8');
  return { backend: BACKEND_TARGET, frontend: FRONTEND_TARGET };
}
