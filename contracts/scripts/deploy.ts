import hre from 'hardhat';
import { ethers } from 'ethers';

import { saveDeploymentRecord } from './lib/deployments.js';
import { syncAbi } from './lib/abi-sync.js';
import { upsertEnvValue } from './lib/env-file.js';
import path from 'node:path';

/**
 * Deploys the BloodBridge contract to the selected Hardhat network
 * (`hardhat run scripts/deploy.ts --network hardhatLocal`).
 *
 * For the local demo network this uses the unlocked development accounts
 * exposed by `hardhat node` - NEVER a personal MetaMask key and never a
 * mainnet wallet. Sepolia deployment (optional) requires a dedicated
 * testnet-only key in `DEPLOYER_PRIVATE_KEY` and `SEPOLIA_RPC_URL`.
 */
async function deploy(): Promise<void> {
  const connection = await hre.network.create();
  const { ethers: hreEthers } = connection;
  const networkName = connection.networkName;

  let deployer: ethers.Signer;
  if (hre.config.networks?.[networkName]?.type === 'http' && networkName !== 'hardhatLocal') {
    // Optional external testnets: sign locally with an operator-provided key.
    // The key never enters the config file or the repository.
    const rpcKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!rpcKey) {
      throw new Error(
        `Deploying to ${networkName} requires the deployer key in the ` +
          'DEPLOYER_PRIVATE_KEY environment variable (kept out of git).',
      );
    }
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL ?? '');
    deployer = new ethers.Wallet(rpcKey, provider);
  } else {
    // Local node: use one of the unlocked development accounts of `hardhat node`.
    const [firstAccount] = await hreEthers.getSigners();
    if (firstAccount === undefined) {
      throw new Error(
        `No unlocked accounts on the ${networkName} network. ` +
          'Start it with `npm run chain` first.',
      );
    }
    deployer = firstAccount;
  }

  const deployerAddress = await deployer.getAddress();
  console.log(`Network:  ${networkName}`);
  console.log(`Deployer: ${deployerAddress}`);
  if (networkName === 'hardhatLocal') {
    console.log(
      'NOTE: this is a local development network. Its accounts are synthetic',
      'node accounts; never fund them with real assets or import a personal',
      'MetaMask seed here.',
    );
  }

  console.log('Deploying BloodBridge...');
  const contract = await hreEthers.deployContract('BloodBridge', [deployerAddress], deployer);
  const txResponse = contract.deploymentTransaction();
  await contract.waitForDeployment();

  if (txResponse === null) {
    throw new Error('Deployment transaction missing.');
  }
  const receipt = await txResponse.wait();
  if (receipt === null) {
    throw new Error('Deployment finished without a receipt. Aborting.');
  }
  if (receipt.status !== 1) {
    throw new Error(`Deployment transaction reverted on chain (status ${receipt.status}).`);
  }

  const contractAddress = await contract.getAddress();
  const chainId = (await connection.ethers.provider.getNetwork()).chainId;

  if (deployerAddress === ethers.ZeroAddress) {
    throw new Error('Deployer unexpectedly resolved to the zero address.');
  }

  const record = {
    network: networkName,
    chainId: Number(chainId),
    contractAddress,
    deployerAddress,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };

  saveDeploymentRecord(record);

  console.log('');
  console.log(`Contract:  ${contractAddress}`);
  console.log(`Chain ID:  ${chainId}`);
  console.log(`Tx:        ${receipt.hash}`);
  console.log(`Block:     ${receipt.blockNumber}`);

  const { backend, frontend } = syncAbi();
  console.log(`ABI synced -> ${backend}`);
  console.log(`ABI synced -> ${frontend}`);

  const backendEnv = path.resolve(import.meta.dirname, '../../backend/.env.local');
  const frontendEnv = path.resolve(import.meta.dirname, '../../frontend/.env.local');
  upsertEnvValue(backendEnv, [
    ['BLOCKCHAIN_CONTRACT_ADDRESS', contractAddress],
    ['BLOCKCHAIN_ENABLED', 'true'],
    ['BLOCKCHAIN_CHAIN_ID', String(record.chainId)],
  ]);
  upsertEnvValue(frontendEnv, [
    ['VITE_BLOODBRIDGE_CONTRACT_ADDRESS', contractAddress],
    ['VITE_BLOODBRIDGE_CHAIN_ID', String(record.chainId)],
  ]);
  console.log(`Config updated -> ${backendEnv}`);
  console.log(`Config updated -> ${frontendEnv}`);
  console.log(
    'Done. Grant verifier permission with `npm run contracts:grant-verifier` ' +
      '(VERIFIER_ADDRESS env var).',
  );
}

await deploy();
