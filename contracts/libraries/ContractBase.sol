// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlDefaultAdminRulesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./Roles.sol";

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
    UUPSUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    AccessControlEnumerableUpgradeable,
    AccessControlDefaultAdminRulesUpgradeable,
    RoleCollectionDefaultUpgradable
{
    // CONST
    uint48 private constant DEFAULT_ADMIN_DELAY = 3 * 24 * 60 * 60; // 3 days

    ////// CONVENIENCE OVERRIDES //////

    /**
     * @notice Convenience override method if you only need a single initializer.
     * 
     * Use the 'initializer' keyword if you need multiple.
     * See: https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#initializers
     * 
     * @param admin Address of initial admin account (can and should be multi-sig)
     */
    // function _initialize(address admin) internal virtual {}

    ////// INTERNAL //////

    /// INITIALIZATION ///
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

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
    }

    /// CONVENIENCE ///
    function _ensureRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _grantRole(role, account);
        }
    }

    /// OZ OVERRIDES ///
    // The following functions are overrides required by Solidity.

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
            AccessControlUpgradeable,
            AccessControlDefaultAdminRulesUpgradeable,
            AccessControlEnumerableUpgradeable
        )
        returns (bool)
    {
        return
            interfaceId ==
            type(IAccessControlDefaultAdminRulesUpgradeable).interfaceId ||
            interfaceId ==
            type(IAccessControlEnumerableUpgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}
