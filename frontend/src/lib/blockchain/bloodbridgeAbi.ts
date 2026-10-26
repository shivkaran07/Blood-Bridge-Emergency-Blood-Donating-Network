/**
 * Generated from contracts/artifacts by `npm run contracts:sync-abi`. Do not edit by hand.
 * Source: contracts/BloodBridge.sol (BloodBridge).
 */
export const BLOODBRIDGE_ABI = [
  [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "initialAdmin",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "AccessControlBadConfirmation",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "internalType": "bytes32",
          "name": "neededRole",
          "type": "bytes32"
        }
      ],
      "name": "AccessControlUnauthorizedAccount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidAuditKey",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "fromStatus",
          "type": "uint8"
        },
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "toStatus",
          "type": "uint8"
        }
      ],
      "name": "InvalidTransition",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        },
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "currentStatus",
          "type": "uint8"
        }
      ],
      "name": "RequestAlreadyRecorded",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        }
      ],
      "name": "RequestNotRecorded",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "status",
          "type": "uint8"
        }
      ],
      "name": "UnknownStatus",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ZeroAddress",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "actor",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint64",
          "name": "at",
          "type": "uint64"
        }
      ],
      "name": "RequestRejected",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "fromStatus",
          "type": "uint8"
        },
        {
          "indexed": true,
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "toStatus",
          "type": "uint8"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "actor",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint64",
          "name": "at",
          "type": "uint64"
        }
      ],
      "name": "RequestStatusChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "actor",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint64",
          "name": "at",
          "type": "uint64"
        }
      ],
      "name": "RequestVerified",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "previousAdminRole",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "newAdminRole",
          "type": "bytes32"
        }
      ],
      "name": "RoleAdminChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sender",
          "type": "address"
        }
      ],
      "name": "RoleGranted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sender",
          "type": "address"
        }
      ],
      "name": "RoleRevoked",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "granted",
          "type": "bool"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "actor",
          "type": "address"
        }
      ],
      "name": "VerifierRoleChanged",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "DEFAULT_ADMIN_ROLE",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "VERIFIER_ROLE",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        }
      ],
      "name": "getRequestRecord",
      "outputs": [
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "status",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "actor",
          "type": "address"
        },
        {
          "internalType": "uint64",
          "name": "updatedAt",
          "type": "uint64"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        }
      ],
      "name": "getRequestStatus",
      "outputs": [
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        }
      ],
      "name": "getRoleAdmin",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "grantRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "grantVerifierRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        }
      ],
      "name": "hasRequestRecord",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "hasRole",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        }
      ],
      "name": "recordRejectedRequest",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        },
        {
          "internalType": "enum BloodBridge.RequestStatus",
          "name": "newStatus",
          "type": "uint8"
        }
      ],
      "name": "recordTerminalStatus",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "auditKey",
          "type": "bytes32"
        }
      ],
      "name": "recordVerifiedRequest",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "callerConfirmation",
          "type": "address"
        }
      ],
      "name": "renounceRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "revokeRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "revokeVerifierRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes4",
          "name": "interfaceId",
          "type": "bytes4"
        }
      ],
      "name": "supportsInterface",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
] as const;

export const BLOODBRIDGE_CONTRACT_NAME = 'BloodBridge';
