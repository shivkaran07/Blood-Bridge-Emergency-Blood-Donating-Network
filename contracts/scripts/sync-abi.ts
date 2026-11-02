import { syncAbi } from './lib/abi-sync.js';

/**
 * Regenerates the immutable contract ABI modules consumed by the backend and
 * the frontend. Run after `npm run contracts:compile` whenever the contract
 * source changes.
 */
const targets = syncAbi();
console.log(`ABI synced -> ${targets.backend}`);
console.log(`ABI synced -> ${targets.frontend}`);
