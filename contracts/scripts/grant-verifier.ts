import hre from 'hardhat';

import { readDeploymentRecord } from './lib/deployments.js';

/**
 * Grants on-chain VERIFIER_ROLE to an account.
 *
 * Usage:
 *   VERIFIER_ADDRESS=0x... npm run contracts:grant-verifier
 *   (or revoke: ACTION=revoke)
 *
 * The caller must hold DEFAULT_ADMIN_ROLE. On `hardhatLocal` this is the
 * account 0 of the running dev node (the same account used for deployment).
 * On Sepolia it requires ADMIN_PRIVATE_KEY (testnet-only funds!).
 */
async function grantVerifier(): Promise<void> {
  const target =
    process.env.VERIFIER_ADDRESS?.trim().toLowerCase() ??
    process.argv[2]?.trim().toLowerCase();
  const action = (process.env.ACTION ?? 'grant').trim().toLowerCase();

  if (!target || !/^0x[0-9a-f]{40}$/.test(target)) {
    console.error(
      'Set VERIFIER_ADDRESS=0x... to the wallet that will anchor verifications.',
    );
    process.exit(1);
  }
  if (action !== 'grant' && action !== 'revoke') {
    console.error('ACTION must be "grant" or "revoke".');
    process.exit(1);
  }

  const connection = await hre.network.create();
  const { ethers: hreEthers, networkName } = connection;

  const record = readDeploymentRecord(networkName);
  if (record?.contractAddress === undefined) {
    console.error(
      `No deployment record for network ${networkName}. Deploy first:\n` +
        '  npm run contracts:deploy',
    );
    process.exit(1);
  }

  console.log(`Network:     ${networkName}`);
  console.log(`Contract:    ${record.contractAddress}`);
  console.log(`Allocator:   ${record.deployerAddress}`);
  console.log(`Target:      ${target}`);
  console.log(`Action:      ${action}`);
  if (networkName === 'hardhatLocal') {
    console.log(
      'NOTE: local development account. Its key exists only inside the',
      '`hardhat node` process; never use it with real assets.',
    );
  }
  console.log('');

  const contract = await hreEthers.getContractAt('BloodBridge', record.contractAddress);
  const [adminSigner] = await hreEthers.getSigners();
  if (adminSigner === undefined) {
    console.error(
      `No unlocked accounts on ${networkName}. For the local node, start with\n  npm run chain`,
    );
    process.exit(1);
  }
  const adminAddress = await adminSigner.getAddress();
  if (adminAddress.toLowerCase() !== record.deployerAddress.toLowerCase()) {
    console.error(
      `The wallet ${adminAddress} does not hold the deployer role for this record.\n` +
        `Deployer in the record: ${record.deployerAddress}.`,
    );
    process.exit(1);
  }

  const tx =
    action === 'grant'
      ? await contract.connect(adminSigner).grantVerifierRole(target)
      : await contract.connect(adminSigner).revokeVerifierRole(target);
  const receipt = await tx.wait();
  if (receipt === null || receipt.status !== 1) {
    throw new Error(`Role change transaction did not succeed (status ${receipt?.status ?? 'null'}).`);
  }

  const verifierRole = await contract.VERIFIER_ROLE();
  const nowHasRole = await contract.hasRole(verifierRole, target);
  console.log(`Tx hash:        ${receipt.hash}`);
  console.log(`Block:          ${receipt.blockNumber}`);
  console.log(`Has VERIFIER_ROLE afterwards: ${nowHasRole ? 'YES' : 'NO'}`);
  if (nowHasRole !== (action === 'grant')) {
    throw new Error('Role change did not take effect as expected.');
  }
  console.log('Role change recorded on chain.');
}

await grantVerifier();
