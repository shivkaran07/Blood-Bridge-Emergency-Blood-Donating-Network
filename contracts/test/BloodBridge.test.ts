import hre from 'hardhat';
import { expect } from 'chai';
import { keccak256, toUtf8Bytes, ZeroAddress } from 'ethers';

import type { BloodBridge } from '../types/ethers-contracts/BloodBridge.js';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';

/**
 * BloodBridge contract tests (run with `npm run contracts:test`).
 *
 * Requirement mapping (section 9 of the implementation brief):
 *  1. deployment                — "deploys and exposes a well-formed address"
 *  2. initial admin permissions — "grants initial administrator permissions"
 *  3. authorized assignment     — "lets the administrator grant verifier"
 *  4. authorized revocation     — "lets the administrator revoke verifier"
 *  5. unauthorized assignment   — "ordinary users can never assign/revoke"
 *  6. authorized verification   — "an authorized verifier records verified"
 *  7. unauthorized verification — "unauthorized verification attempts fail"
 *  8. key duplication           — "refuses to initialize the same key twice"
 *  9. authorized rejection      — "an authorized verifier records rejected"
 * 10. invalid transitions       — "refuses to treat unknown/fresh keys"
 * 11. authorized cancellation   — "cancels a previously verified record"
 * 12. authorized completion     — "completes a previously verified record"
 * 13. terminal overwrites       — "terminal states can never be overwritten"
 * 14. unknown audit keys        — "unknown audit keys report NONE"
 * 15/16/17. events + stored status/actor + invalid arguments
 * 18. reverted transactions leave no partial state
 * 19. no ether acceptance + 20. revocation takes effect
 *
 * The success paths are checked end to end: transaction, receipt, event with
 * the exact argument VALUES (including the block timestamp) and contract
 * state — never just the fact that a call did not throw.
 *
 * Statuses: NONE=0, VERIFIED=1, REJECTED=2, CANCELLED=3, COMPLETED=4.
 */

const { ethers, networkHelpers } = await hre.network.create();

const STATUS = {
  NONE: 0n,
  VERIFIED: 1n,
  REJECTED: 2n,
  CANCELLED: 3n,
  COMPLETED: 4n,
} as const;

const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const VERIFIER_ROLE = keccak256(toUtf8Bytes('VERIFIER_ROLE'));
const ZERO_KEY = '0x' + '00'.repeat(32);

type AuditKey = `0x${string}`;

function keyFrom(seed: string): AuditKey {
  return keccak256(toUtf8Bytes(seed)) as AuditKey;
}

interface Fixture {
  contract: BloodBridge;
  admin: HardhatEthersSigner;
  verifier: HardhatEthersSigner;
  stranger: HardhatEthersSigner;
}

async function deployFixture(): Promise<Fixture> {
  const signers = await ethers.getSigners();
  const [admin, verifier, stranger] = signers as [
    HardhatEthersSigner,
    HardhatEthersSigner,
    HardhatEthersSigner,
  ];
  const contract = await ethers.deployContract('BloodBridge', [admin.address], admin);
  await contract.waitForDeployment();
  return { contract, admin, verifier, stranger };
}

async function deployWithVerifierFixture(): Promise<Fixture> {
  const base = await deployFixture();
  await base.contract.connect(base.admin).grantVerifierRole(base.verifier.address);
  return base;
}

describe('BloodBridge deployment and role administration', () => {
  it('1. deploys and exposes a well-formed contract address', async () => {
    const { contract } = await networkHelpers.loadFixture(deployFixture);
    expect(await contract.getAddress()).to.match(/^0x[0-9a-fA-F]{40}$/);
  });

  it('2. grants initial administrator permissions to the deployer', async () => {
    const { contract, admin } = await networkHelpers.loadFixture(deployFixture);
    expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
    expect(await contract.hasRole(VERIFIER_ROLE, admin.address)).to.equal(true);
  });

  it('refuses deployment when the initial administrator is the zero address', async () => {
    const factory = await ethers.getContractFactory('BloodBridge');
    let reverted = false;
    let message = '';
    try {
      const failing = await factory.deploy(ZeroAddress);
      await failing.waitForDeployment();
    } catch (error) {
      reverted = true;
      message = (error as Error).message;
    }
    expect(reverted, 'deployment must revert for a zero-address admin').to.equal(true);
    expect(message).to.contain('ZeroAddress');
  });

  it('3. lets the administrator grant verifier permission and emits the event', async () => {
    const { contract, admin, verifier } = await networkHelpers.loadFixture(deployFixture);
    const tx = await contract.connect(admin).grantVerifierRole(verifier.address);
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);
    expect(receipt!.status).to.equal(1);

    await expect(tx).to.emit(contract, 'VerifierRoleChanged').withArgs(
      verifier.address,  // account
      true,              // granted
      admin.address,     // actor
    );
    await expect(tx).to.emit(contract, 'RoleGranted').withArgs(
      VERIFIER_ROLE,
      verifier.address,
      admin.address,
    );
    expect(await contract.hasRole(VERIFIER_ROLE, verifier.address)).to.equal(true);
  });

  it('4. lets the administrator revoke verifier permission and emits the event', async () => {
    const { contract, admin, verifier } =
      await networkHelpers.loadFixture(deployWithVerifierFixture);
    expect(await contract.hasRole(VERIFIER_ROLE, verifier.address)).to.equal(true);

    const tx = await contract.connect(admin).revokeVerifierRole(verifier.address);
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);

    await expect(tx).to.emit(contract, 'VerifierRoleChanged').withArgs(
      verifier.address,  // account
      false,             // granted
      admin.address,     // actor
    );
    expect(await contract.hasRole(VERIFIER_ROLE, verifier.address)).to.equal(false);
  });

  it("role revocation takes effect immediately for the verifier's anchoring calls", async () => {
    const { contract, admin, verifier } =
      await networkHelpers.loadFixture(deployWithVerifierFixture);
    await contract.connect(admin).revokeVerifierRole(verifier.address);

    await expect(
      contract.connect(verifier).recordVerifiedRequest(keyFrom('post-revocation')),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');

    expect(await contract.getRequestStatus(keyFrom('post-revocation'))).to.equal(STATUS.NONE);
  });

  it('5. ordinary users can never assign verifier permissions to themselves', async () => {
    const { contract, stranger, verifier } = await networkHelpers.loadFixture(deployFixture);
    await expect(
      contract.connect(stranger).grantVerifierRole(verifier.address),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    expect(await contract.hasRole(VERIFIER_ROLE, stranger.address)).to.equal(false);
    expect(await contract.hasRole(VERIFIER_ROLE, verifier.address)).to.equal(false);
  });

  it('ordinary users can never revoke verifier permissions', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    await expect(
      contract.connect(verifier).revokeVerifierRole(verifier.address),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    expect(await contract.hasRole(VERIFIER_ROLE, verifier.address)).to.equal(true);
  });

  it('granting an existing verifier is idempotent and emits nothing new', async () => {
    const { contract, admin, verifier } =
      await networkHelpers.loadFixture(deployWithVerifierFixture);
    const verifierTx = await contract.connect(admin).grantVerifierRole(verifier.address);
    expect(await contract.hasRole(VERIFIER_ROLE, verifier.address)).to.equal(true);
    await expect(verifierTx).to.not.emit(contract, 'VerifierRoleChanged');
    await expect(verifierTx).to.not.emit(contract, 'RoleGranted');
  });
});

describe('BloodBridge decision recording', () => {
  it('6. an authorized verifier records a verified request', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('verify-me');

    const tx = await contract.connect(verifier).recordVerifiedRequest(auditKey);
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);
    expect(receipt!.status).to.equal(1);

    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    expect(block).to.not.equal(null);

    await expect(tx).to.emit(contract, 'RequestVerified').withArgs(
      auditKey,        // auditKey
      verifier.address, // actor
      Number(block!.timestamp), // at — must be the block timestamp
    );
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.VERIFIED);
    expect(await contract.hasRequestRecord(auditKey)).to.equal(true);
  });

  it('7. unauthorized verification attempts always fail', async () => {
    const { contract, stranger } = await networkHelpers.loadFixture(deployFixture);
    const auditKey = keyFrom('not-mine');

    await expect(
      contract.connect(stranger).recordVerifiedRequest(auditKey),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    await expect(
      contract.connect(stranger).recordRejectedRequest(auditKey),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    await expect(
      contract.connect(stranger).recordTerminalStatus(auditKey, STATUS.COMPLETED),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');

    // Nothing may have been recorded by the unauthorized calls.
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.NONE);
    expect(await contract.hasRequestRecord(auditKey)).to.equal(false);
  });

  it('8. refuses to initialize the same audit key twice', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('duplicate');
    await contract.connect(verifier).recordVerifiedRequest(auditKey);

    await expect(
      contract.connect(verifier).recordVerifiedRequest(auditKey),
    ).to.be.revertedWithCustomError(contract, 'RequestAlreadyRecorded');
    await expect(
      contract.connect(verifier).recordRejectedRequest(auditKey),
    ).to.be.revertedWithCustomError(contract, 'RequestAlreadyRecorded');
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.VERIFIED);
  });

  it('9. an authorized verifier records a rejected request', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('reject-me');

    const tx = await contract.connect(verifier).recordRejectedRequest(auditKey);
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);

    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    expect(block).to.not.equal(null);

    await expect(tx).to.emit(contract, 'RequestRejected').withArgs(
      auditKey,
      verifier.address,
      Number(block!.timestamp),
    );
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.REJECTED);
    const [status, actor] = await contract.getRequestRecord(auditKey);
    expect(status).to.equal(STATUS.REJECTED);
    expect(actor).to.equal(verifier.address);
  });

  it('10. refuses to treat unknown or fresh audit keys as terminal states', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const unknownKey = keyFrom('never-recorded');

    await expect(
      contract.connect(verifier).recordTerminalStatus(unknownKey, STATUS.COMPLETED),
    ).to.be.revertedWithCustomError(contract, 'RequestNotRecorded');
    await expect(
      contract.connect(verifier).recordTerminalStatus(unknownKey, STATUS.CANCELLED),
    ).to.be.revertedWithCustomError(contract, 'RequestNotRecorded');

    await expect(
      contract.connect(verifier).recordTerminalStatus(keyFrom('fresh-key-a'), STATUS.VERIFIED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    await expect(
      contract.connect(verifier).recordTerminalStatus(keyFrom('fresh-key-b'), STATUS.REJECTED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');

    expect(await contract.getRequestStatus(unknownKey)).to.equal(STATUS.NONE);
  });
});

describe('BloodBridge terminal transitions', () => {
  it('11. an authorized verifier cancels a previously verified record', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('cancel-me');
    await contract.connect(verifier).recordVerifiedRequest(auditKey);

    const tx = await contract.connect(verifier).recordTerminalStatus(auditKey, STATUS.CANCELLED);
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);

    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    await expect(tx).to.emit(contract, 'RequestStatusChanged').withArgs(
      auditKey,        // auditKey
      STATUS.VERIFIED, // fromStatus
      STATUS.CANCELLED, // toStatus
      verifier.address, // actor
      Number(block!.timestamp),
    );
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.CANCELLED);
  });

  it('12. an authorized verifier completes a previously verified record', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('complete-me');
    await contract.connect(verifier).recordVerifiedRequest(auditKey);

    const tx = await contract.connect(verifier).recordTerminalStatus(auditKey, STATUS.COMPLETED);
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);

    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    await expect(tx).to.emit(contract, 'RequestStatusChanged').withArgs(
      auditKey,
      STATUS.VERIFIED,
      STATUS.COMPLETED,
      verifier.address,
      Number(block!.timestamp),
    );
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.COMPLETED);
    const [status, actor] = await contract.getRequestRecord(auditKey);
    expect(status).to.equal(STATUS.COMPLETED);
    expect(actor).to.equal(verifier.address);
  });

  it('13. terminal states can never be overwritten by any verifier call', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);

    const rejectedKey = keyFrom('rejected-final');
    await contract.connect(verifier).recordRejectedRequest(rejectedKey);
    await expect(
      contract.connect(verifier).recordVerifiedRequest(rejectedKey),
    ).to.be.revertedWithCustomError(contract, 'RequestAlreadyRecorded');
    await expect(
      contract.connect(verifier).recordTerminalStatus(rejectedKey, STATUS.COMPLETED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    await expect(
      contract.connect(verifier).recordTerminalStatus(rejectedKey, STATUS.CANCELLED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    expect(await contract.getRequestStatus(rejectedKey)).to.equal(STATUS.REJECTED);

    const completedKey = keyFrom('completed-final');
    await contract.connect(verifier).recordVerifiedRequest(completedKey);
    await contract.connect(verifier).recordTerminalStatus(completedKey, STATUS.COMPLETED);
    await expect(
      contract.connect(verifier).recordTerminalStatus(completedKey, STATUS.CANCELLED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    await expect(
      contract.connect(verifier).recordVerifiedRequest(completedKey),
    ).to.be.revertedWithCustomError(contract, 'RequestAlreadyRecorded');
    expect(await contract.getRequestStatus(completedKey)).to.equal(STATUS.COMPLETED);

    const cancelledKey = keyFrom('cancelled-final');
    await contract.connect(verifier).recordVerifiedRequest(cancelledKey);
    await contract.connect(verifier).recordTerminalStatus(cancelledKey, STATUS.CANCELLED);
    await expect(
      contract.connect(verifier).recordTerminalStatus(cancelledKey, STATUS.COMPLETED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    expect(await contract.getRequestStatus(cancelledKey)).to.equal(STATUS.CANCELLED);
  });
});

describe('BloodBridge reads and stored fields', () => {
  it('14. unknown audit keys report NONE and are never treated as verified', async () => {
    const { contract } = await networkHelpers.loadFixture(deployFixture);
    const unknownKey = keyFrom('totally-unknown');
    expect(await contract.getRequestStatus(unknownKey)).to.equal(STATUS.NONE);
    expect(await contract.hasRequestRecord(unknownKey)).to.equal(false);
    const [status, actor] = await contract.getRequestRecord(unknownKey);
    expect(status).to.equal(STATUS.NONE);
    expect(actor).to.equal(ZeroAddress);
  });

  it('15. stores the correct status and actor and updates them on transitions', async () => {
    const { contract, verifier, admin } =
      await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('audit-fields');
    await contract.connect(verifier).recordVerifiedRequest(auditKey);

    const [initialStatus, initialActor, initialUpdatedAt] =
      await contract.getRequestRecord(auditKey);
    expect(initialStatus).to.equal(STATUS.VERIFIED);
    expect(initialActor).to.equal(verifier.address);
    expect(initialUpdatedAt > 0n).to.equal(true);

    await contract.connect(admin).recordTerminalStatus(auditKey, STATUS.COMPLETED);
    const [finalStatus, finalActor, finalUpdatedAt] = await contract.getRequestRecord(auditKey);
    expect(finalStatus).to.equal(STATUS.COMPLETED);
    expect(finalActor).to.equal(admin.address);
    expect(finalUpdatedAt >= initialUpdatedAt).to.equal(true);
  });
});

describe('BloodBridge argument validation', () => {
  it('16. an all-zero audit key is invalid for every recording function', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    await expect(
      contract.connect(verifier).recordVerifiedRequest(ZERO_KEY),
    ).to.be.revertedWithCustomError(contract, 'InvalidAuditKey');
    await expect(
      contract.connect(verifier).recordRejectedRequest(ZERO_KEY),
    ).to.be.revertedWithCustomError(contract, 'InvalidAuditKey');
    await expect(
      contract.connect(verifier).recordTerminalStatus(ZERO_KEY, STATUS.COMPLETED),
    ).to.be.revertedWithCustomError(contract, 'InvalidAuditKey');
    expect(await contract.hasRequestRecord(ZERO_KEY)).to.equal(false);
  });

  it('17. refuses to grant or revoke roles for the zero address', async () => {
    const { contract, admin } = await networkHelpers.loadFixture(deployFixture);
    await expect(
      contract.connect(admin).grantVerifierRole(ZeroAddress),
    ).to.be.revertedWithCustomError(contract, 'ZeroAddress');
    await expect(
      contract.connect(admin).revokeVerifierRole(ZeroAddress),
    ).to.be.revertedWithCustomError(contract, 'ZeroAddress');
  });

  it('recordTerminalStatus never accepts VERIFIED, REJECTED or NONE as targets', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('bad-target');
    await contract.connect(verifier).recordVerifiedRequest(auditKey);
    await expect(
      contract.connect(verifier).recordTerminalStatus(auditKey, STATUS.VERIFIED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    await expect(
      contract.connect(verifier).recordTerminalStatus(auditKey, STATUS.REJECTED),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    await expect(
      contract.connect(verifier).recordTerminalStatus(auditKey, STATUS.NONE),
    ).to.be.revertedWithCustomError(contract, 'InvalidTransition');
    expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.VERIFIED);
  });
});

describe('BloodBridge misc invariants', () => {
  it('18. reverted transactions leave no partial state', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const auditKey = keyFrom('atomicity-check');

    const tx = await contract
      .connect(verifier)
      .recordTerminalStatus(auditKey, STATUS.COMPLETED)
      .catch(() => null); // reverted before mining (stateless preflight)

    if (tx === null) {
      // The EDR network surfaces a preflight revert without mining. Confirm
      // via a second call that the state stays untouched and the error matches.
      expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.NONE);
      await expect(
        contract.connect(verifier).recordTerminalStatus(auditKey, STATUS.COMPLETED),
      ).to.be.revertedWithCustomError(contract, 'RequestNotRecorded');
    } else {
      await expect(tx).to.be.revertedWithCustomError(contract, 'RequestNotRecorded');
      expect(await contract.getRequestStatus(auditKey)).to.equal(STATUS.NONE);
    }
  });

  it('19. the contract does not accept ether', async () => {
    const { contract, verifier } = await networkHelpers.loadFixture(deployWithVerifierFixture);
    const address = await contract.getAddress();

    // Plain ether transfer to the contract address: no payable fallback, so it
    // must revert and the contract balance must remain zero.
    await expect(
      verifier.sendTransaction({ to: address, value: 1n }),
    ).to.be.revert(ethers);

    expect(await ethers.provider.getBalance(address)).to.equal(0n);
  });

  it('20. revoking the deployer verifier role removes its anchoring rights', async () => {
    const { contract, admin } = await networkHelpers.loadFixture(deployFixture);
    await contract.connect(admin).revokeVerifierRole(admin.address);
    expect(await contract.hasRole(VERIFIER_ROLE, admin.address)).to.equal(false);
    expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.equal(true); // admin stays admin

    await expect(
      contract.connect(admin).recordVerifiedRequest(keyFrom('admin-anchoring')),
    ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    expect(await contract.getRequestStatus(keyFrom('admin-anchoring'))).to.equal(STATUS.NONE);
  });
});
