// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

abstract contract RoleUpgrader {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
}

abstract contract RolePauser {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
}

abstract contract RoleAdmin {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
}

abstract contract RoleManager {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
}

abstract contract RoleOperator {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
}

abstract contract RoleProposer {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
}

abstract contract RoleApprover {
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
}

abstract contract RoleValidator {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
}

abstract contract RoleExecutor {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
}

abstract contract RoleCollectionDefault is RolePauser, RoleAdmin, RoleManager, RoleOperator {}
abstract contract RoleCollectionDefaultUpgradable is RoleUpgrader, RoleCollectionDefault {}
abstract contract RoleCollectionExecution is RoleProposer, RoleApprover, RoleValidator, RoleExecutor {}
