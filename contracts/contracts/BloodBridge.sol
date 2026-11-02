// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BloodBridge
 * @notice Tamper-evident record of authorized blood-request verification
 *  decisions for the BloodBridge emergency coordination network.
 *
 * Design boundaries
 * -----------------
 * - Only OPAQUE 256-bit audit keys generated server-side with secure randomness
 *   are stored on chain. No names, emails, phone numbers, diagnoses, locations
 *   or any other personal or medical data ever reach this contract.
 * - An audit key anchors the FACT that an authorized verifier recorded a
 *   decision. It does not prove the decision was correct or that blood was
 *   donated.
 * - The contract refuses ether (no payable functions, no receive/fallback).
 *
 * State machine
 * -------------
 *  NONE --(recordVerifiedRequest / recordRejectedRequest, VERIFIER_ROLE)-->
 *         VERIFIED | REJECTED
 *  VERIFIED --(recordTerminalStatus, VERIFIER_ROLE)--> COMPLETED | CANCELLED
 *  REJECTED, CANCELLED, COMPLETED are terminal; they cannot be overwritten.
 */
contract BloodBridge is AccessControl {
    /// @notice Role identifier for hospital verifiers who anchor decisions.
    /// @dev Compile-time keccak256("VERIFIER_ROLE").
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    /// @notice On-chain state of a request audit key.
    enum RequestStatus {
        NONE,
        VERIFIED,
        REJECTED,
        CANCELLED,
        COMPLETED
    }

    /// @notice On-chain record for one opaque audit key.
    struct RequestRecord {
        RequestStatus status;
        address actor;   // authorized account that produced the current status
        uint64 updatedAt; // block timestamp of the last change
    }

    mapping(bytes32 => RequestRecord) private _records;

    /// @notice A verifier permission was granted or revoked by the administrator.
    event VerifierRoleChanged(address indexed account, bool granted, address indexed actor);

    /// @notice A request audit key is now VERIFIED.
    event RequestVerified(bytes32 indexed auditKey, address indexed actor, uint64 at);

    /// @notice A request audit key is now REJECTED.
    event RequestRejected(bytes32 indexed auditKey, address indexed actor, uint64 at);

    /// @notice A previously VERIFIED record moved to CANCELLED or COMPLETED.
    /// @dev Solidity permits at most three indexed arguments: auditKey,
    ///  toStatus and actor are indexed; fromStatus is a data argument.
    event RequestStatusChanged(
        bytes32 indexed auditKey,
        RequestStatus fromStatus,
        RequestStatus indexed toStatus,
        address indexed actor,
        uint64 at
    );

    error InvalidAuditKey();
    error ZeroAddress();
    error RequestAlreadyRecorded(bytes32 auditKey, RequestStatus currentStatus);
    error RequestNotRecorded(bytes32 auditKey);
    error InvalidTransition(RequestStatus fromStatus, RequestStatus toStatus);
    error UnknownStatus(RequestStatus status);

    /// @notice Deploys the contract and grants DEFAULT_ADMIN_ROLE (plus
    ///  VERIFIER_ROLE) to the initial administrator.
    /// @dev For local development the initial admin is a hardhat dev account.
    ///  It must never hold real funds or a production private key.
    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        // Convenience for single-operator deployments: the administrator is
        // also a verifier from deployment. The default admin may revoke this.
        _grantRole(VERIFIER_ROLE, initialAdmin);
    }

    // ------------------------------------------------------------------
    // Role administration
    // ------------------------------------------------------------------

    /// @notice Grants VERIFIER_ROLE. Reverts unless called by DEFAULT_ADMIN_ROLE.
    function grantVerifierRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        bool changed = _grantRole(VERIFIER_ROLE, account);
        if (changed) {
            emit VerifierRoleChanged(account, true, msg.sender);
        }
    }

    /// @notice Revokes VERIFIER_ROLE. Idempotent; reverts unless the caller is
    ///  DEFAULT_ADMIN_ROLE. Revoked verifiers lose anchoring permission at once.
    function revokeVerifierRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        bool changed = _revokeRole(VERIFIER_ROLE, account);
        if (changed) {
            emit VerifierRoleChanged(account, false, msg.sender);
        }
    }

    // ------------------------------------------------------------------
    // Decision recording
    // ------------------------------------------------------------------

    /// @notice Anchors a VERIFIED decision for an untethered audit key.
    function recordVerifiedRequest(bytes32 auditKey) external onlyRole(VERIFIER_ROLE) {
        RequestRecord storage record = _records[auditKey];
        _assertFresh(auditKey, record);
        record.status = RequestStatus.VERIFIED;
        record.actor = msg.sender;
        record.updatedAt = _now64();
        emit RequestVerified(auditKey, msg.sender, record.updatedAt);
    }

    /// @notice Anchors a REJECTED decision for an untethered audit key.
    function recordRejectedRequest(bytes32 auditKey) external onlyRole(VERIFIER_ROLE) {
        RequestRecord storage record = _records[auditKey];
        _assertFresh(auditKey, record);
        record.status = RequestStatus.REJECTED;
        record.actor = msg.sender;
        record.updatedAt = _now64();
        emit RequestRejected(auditKey, msg.sender, record.updatedAt);
    }

    /// @notice Moves an already VERIFIED record to CANCELLED or COMPLETED.
    /// @param auditKey the opaque request audit key
    /// @param newStatus must be RequestStatus.CANCELLED or RequestStatus.COMPLETED
    function recordTerminalStatus(bytes32 auditKey, RequestStatus newStatus) external onlyRole(VERIFIER_ROLE) {
        if (auditKey == bytes32(0)) revert InvalidAuditKey();
        if (newStatus != RequestStatus.CANCELLED && newStatus != RequestStatus.COMPLETED) {
            revert InvalidTransition(RequestStatus.NONE, newStatus);
        }

        RequestRecord storage record = _records[auditKey];
        RequestStatus fromStatus = record.status;
        if (fromStatus == RequestStatus.NONE) revert RequestNotRecorded(auditKey);
        if (!_canTransition(fromStatus, newStatus)) revert InvalidTransition(fromStatus, newStatus);

        record.status = newStatus;
        record.actor = msg.sender;
        record.updatedAt = _now64();
        emit RequestStatusChanged(auditKey, fromStatus, newStatus, msg.sender, record.updatedAt);
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    /// @notice Current on-chain status of an audit key (NONE when unknown).
    function getRequestStatus(bytes32 auditKey) external view returns (RequestStatus) {
        return _records[auditKey].status;
    }

    /// @notice True exactly when the audit key has an on-chain record.
    function hasRequestRecord(bytes32 auditKey) external view returns (bool) {
        return _records[auditKey].status != RequestStatus.NONE;
    }

    /// @notice Full on-chain record: status, acting address and block timestamp.
    function getRequestRecord(bytes32 auditKey)
        external
        view
        returns (RequestStatus status, address actor, uint64 updatedAt)
    {
        RequestRecord storage record = _records[auditKey];
        return (record.status, record.actor, record.updatedAt);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _assertFresh(bytes32 auditKey, RequestRecord storage record) private view {
        if (auditKey == bytes32(0)) revert InvalidAuditKey();
        if (record.status != RequestStatus.NONE) {
            revert RequestAlreadyRecorded(auditKey, record.status);
        }
    }

    function _canTransition(RequestStatus fromStatus, RequestStatus toStatus) private pure returns (bool) {
        // Only a VERIFIED record may be completed or cancelled. REJECTED,
        // CANCELLED, COMPLETED and NONE may never be altered afterwards.
        return fromStatus == RequestStatus.VERIFIED
            && (toStatus == RequestStatus.COMPLETED || toStatus == RequestStatus.CANCELLED);
    }

    function _now64() private view returns (uint64) {
        return uint64(block.timestamp);
    }
}
