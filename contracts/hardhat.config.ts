import { defineConfig } from 'hardhat/config';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import type { HardhatUserConfig } from 'hardhat/types';

/**
 * BloodBridge contract toolchain (Hardhat 3).
 *
 * - `hardhatLocal`  — an already-running `npx hardhat node` on 127.0.0.1:8545.
 *                     Deploying against it is the supported demo workflow.
 * - `sepolia`       — optional public testnet. Requires a deployer key and an
 *                     RPC endpoint in local secret env variables only.
 *
 * The default `hardhat` network (ephemeral, in-process) is used by tests.
 */

// Never put production keys here. The deployer key for Sepolia lives only in
// a local, gitignored environment file or shell variable.
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL ?? '';
const sepoliaDeployerKey = process.env.BLOCKCHAIN_DEPLOYER_PRIVATE_KEY ?? '';

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Ephemeral simulated network used by `hardhat test`. Base fee is pinned
    // to zero so test results never depend on dynamic gas pricing.
    hardhat: {
      type: 'edr-simulated' as const,
      initialBaseFeePerGas: 0,
    },
    hardhatLocal: {
      type: 'http' as const,
      url: process.env.LOCAL_CHAIN_RPC_URL ?? 'http://127.0.0.1:8545',
    },
    // accounts is intentionally left undefined for the local node: deployment
    // uses the unlocked development accounts exposed by `hardhat node`.
    ...(sepoliaRpcUrl && sepoliaDeployerKey
      ? {
          sepolia: {
            type: 'http' as const,
            url: sepoliaRpcUrl,
            accounts: [sepoliaDeployerKey],
          } as const,
        }
      : {}),
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
