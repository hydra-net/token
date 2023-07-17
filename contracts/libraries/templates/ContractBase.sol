// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlDefaultAdminRulesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";


import "../access/AccessControlElevation.sol";
import "../access/Roles.sol";

abstract contract AbstractContract {
    ////// INTERNAL //////

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}

abstract contract BaseContract is AbstractContract {
    ////// INTERNAL //////

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}

abstract contract BaseUpgradableContract is
    AbstractContract,
    Initializable,
    ERC165Upgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    AccessControlDefaultAdminRulesUpgradeable,
    AccessControlElevation,
    RoleCollectionDefaultUpgradable
{
    // CONST
    uint48 private constant DEFAULT_ADMIN_DELAY = 3 * 24 * 60 * 60; // 3 days

    /// INITIALIZATION ///
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializer for parent contracts. Should be called via super._initialize() in child contracts.
     * 
     * IMPORTANT: The initializer has to be called to activate the contract. Nothing else works until initialization.
     * IMPORTANT: Never call any initializer twice. Use new initializer functions for upgrades instead.
     * 
     * To create additional initializer functions use the 'initializer' keyword.
     * See: https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#initializers
     * 
     * @param admin Address of initial admin account (can and should be multi-sig)
     */
    function __BaseContract_init(address admin) internal onlyInitializing {
        __UUPSUpgradeable_init();
        __Pausable_init();
        __AccessControl_init();
        __AccessControlEnumerable_init();
        __AccessControlDefaultAdminRules_init(DEFAULT_ADMIN_DELAY, admin);

        _ensureRole(DEFAULT_ADMIN_ROLE, admin);
        _ensureRole(PAUSER_ROLE, admin);
        _ensureRole(UPGRADER_ROLE, admin);
        _ensureRole(ADMIN_ROLE, admin);
        _ensureRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _ensureRoleAdmin(MANAGER_ROLE, ADMIN_ROLE);
        _ensureRoleAdmin(OPERATOR_ROLE, MANAGER_ROLE);
    }

    /// CONVENIENCE ///

    function _ensureRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _grantRole(role, account);
        }
    }

    function _ensureRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        if (getRoleAdmin(role) != adminRole) {
            _setRoleAdmin(role, adminRole);
        }
    }

    /// OZ OVERRIDES ///
    // The following functions are overrides required by Solidity.

    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override onlyRole(UPGRADER_ROLE) {}

    function _checkRole(bytes32 role) internal view virtual override(AccessControlUpgradeable, AccessControlElevation) {
        super._checkRole(role);
    }

    function grantRole(
        bytes32 role,
        address account
    )
        public
        virtual
        override(
            IAccessControlUpgradeable,
            AccessControlUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable
        )
    {
        super.grantRole(role, account);
    }

    function revokeRole(
        bytes32 role,
        address account
    )
        public
        virtual
        override(
            IAccessControlUpgradeable,
            AccessControlUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable
        )
    {
        super.revokeRole(role, account);
    }

    function renounceRole(
        bytes32 role,
        address account
    )
        public
        virtual
        override(
            IAccessControlUpgradeable,
            AccessControlUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable
        )
    {
        super.renounceRole(role, account);
    }

    function _grantRole(
        bytes32 role,
        address account
    )
        internal
        virtual
        override(
            AccessControlUpgradeable,
            AccessControlEnumerableUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable
        )
    {
        super._grantRole(role, account);
    }

    function _revokeRole(
        bytes32 role,
        address account
    )
        internal
        virtual
        override(
            AccessControlUpgradeable,
            AccessControlEnumerableUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable
        )
    {
        super._revokeRole(role, account);
    }

    function _setRoleAdmin(
        bytes32 role,
        bytes32 adminRole
    )
        internal
        virtual
        override(
            AccessControlUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable
        )
    {
        super._setRoleAdmin(role, adminRole);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(
            ERC165Upgradeable,
            AccessControlDefaultAdminRulesUpgradeable,
            AccessControlEnumerableUpgradeable,
            AccessControlElevation
        )
        returns (bool)
    {
        return
            super.supportsInterface(interfaceId);
    }

    ////// INTERNAL //////

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
