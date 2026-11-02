import hre from 'hardhat';

import { readDeploymentRecord } from './lib/deployments.js';

/**
 * Prints a human-readable snapshot of chain configuration and the currently
 * deployed contract. Useful to validate that brand new deployments were
 * recorded in backend/frontend configuration.
 */
async function chainReport(): Promise<void> {
  const connection = await hre.network.create();
  const { networkName, ethers: hreEthers } = connection;
  const chainId = (await hreEthers.provider.getNetwork()).chainId;
  const blockNumber = await hreEthers.provider.getBlockNumber();
  const record = readDeploymentRecord(networkName);

  console.log(`Network:     ${networkName}`);
  console.log(`Chain ID:    ${chainId}`);
  console.log(`Latest block: ${blockNumber}`);
  console.log(
    record?.contractAddress === undefined
      ? 'Contract:    NOT DEPLOYED on this network (record missing)'
      : `Contract:    ${record.contractAddress}\n` +
          `Deployed at: ${record.deployedAt} (tx ${record.transactionHash})`,
  );
  if (networkName === 'hardhatLocal' && record?.contractAddress !== undefined) {
    const ethersInstance = connection.ethers;
    const contract = await ethersInstance.getContractAt(
      'BloodBridge',
      record.contractAddress,
    );
    const verifierRole = await contract.VERIFIER_ROLE();
    const deployerHasVerifier = await contract.hasRole(
      verifierRole,
      record.deployerAddress,
    );
    console.log(
      `Deployer ${record.deployerAddress} has VERIFIER_ROLE: ${deployerHasVerifier}`,
    );
  }
}

await chainReport();
