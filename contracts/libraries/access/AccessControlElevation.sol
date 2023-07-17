// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "../utils/Housekeeping.sol";
import "./Roles.sol";

interface IAccessControlElevation {
    function elevate(bytes32 role, address elevatedAddress) external;

    function elevate(
        bytes32 role,
        address elevatedAddress,
        uint duration
    ) external;
}

abstract contract AccessControlElevation is
    IHousekeeping,
    ERC165Upgradeable,
    AccessControlUpgradeable,
    RoleAdmin
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // CONSTANTS
    uint48 private constant DEFAULT_ELEVATION_DURATION = 24 * 60 * 60; // 24h

    // STATE
    uint48 private _elevationDuration;
    EnumerableSetUpgradeable.AddressSet private _elevationKeys;
    mapping(address => Elevation) private _elevations;

    // ERRORS
    error NotAdmin(address requestedElevator);

    /// TYPES ///

    struct Elevation {
        bytes32 role;
        address elevatedAddress;
        address elevatedBy;
        uint256 expires;
    }

    /// ADMIN ACTIONS ///

    function setDefaultElevationDuration(uint48 duration) public onlyFullAdmin {
        _elevationDuration = duration;
    }

    function elevate(
        bytes32 role,
        address elevatedAddress
    ) public onlyFullAdmin {
        _elevations[_msgSender()] = Elevation({
            role: role,
            elevatedAddress: elevatedAddress,
            elevatedBy: _msgSender(),
            expires: block.timestamp + defaultElevationDuration()
        });
    }

    function elevate(
        bytes32 role,
        address elevatedAddress,
        uint256 duration
    ) public onlyFullAdmin {
        _elevations[_msgSender()] = Elevation({
            role: role,
            elevatedAddress: elevatedAddress,
            elevatedBy: _msgSender(),
            expires: block.timestamp + duration
        });
    }

    /// IMPLEMENTATION ///

    function requestElevation(bytes32 role, address admin) public {
        return requestElevation(role, admin, defaultElevationDuration());
    }

    // solhint-disable-next-line
    function requestElevation(
        bytes32 role,
        address admin,
        uint256 duration
    ) public {
        if (!hasRole(ADMIN_ROLE, admin)) {
            revert NotAdmin(admin);
        }

        // TODO: propose tx to multisig to call elevate with corresponding params
    }

    /// OVERRIDES ///

    function _checkRole(bytes32 role) internal view virtual override {
        if (role == ADMIN_ROLE && !hasRole(ADMIN_ROLE, _msgSender())) {
            // If the sender is elevated to admin, and the elevation is still valid, allow the call
            if (_elevationKeys.contains(_msgSender())) {
                Elevation memory elevation = _elevations[_msgSender()];
                if (
                    elevation.role == ADMIN_ROLE &&
                    elevation.expires > block.timestamp
                ) {
                    return;
                }
            }
        }
        // In all other cases, delegate to the parent implementation
        super._checkRole(role);
    }

    /// INTERNAL ///

    modifier onlyFullAdmin() {
        super._checkRole(ADMIN_ROLE);
        _;
    }

    function housekeeping() public {
        // Delete expired elevations
        for (uint256 i = 0; i < _elevationKeys.length(); i++) {
            address key = _elevationKeys.at(i);
            if (_elevations[key].expires < block.timestamp) {
                _elevationKeys.remove(key);
                delete _elevations[key];
            }
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC165Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IAccessControlElevation).interfaceId ||
            interfaceId == type(IHousekeeping).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// VIEWS ///

    function defaultElevationDuration() public view returns (uint48) {
        return
            _elevationDuration == 0
                ? DEFAULT_ELEVATION_DURATION
                : _elevationDuration;
    }
}
