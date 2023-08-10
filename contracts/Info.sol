// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "./libraries/templates/ContractBase.sol";
import "./Token.sol";
import "./Treasury.sol";

contract Info is ContractUpgradable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // STATE //
    Token public _token;
    Treasury public _treasury;
    EnumerableSetUpgradeable.AddressSet private _reservedAccounts;


    ////// INITIALIZATION //////

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address token, address treasury) public initializer {
        __BaseContract_init(admin);

        _token = Token(token);
        _treasury = Treasury(treasury);
    }

    ////// MANAGEMENT //////

    function addReservedAccount(address account) public onlyRole(ADMIN_ROLE) {
        _reservedAccounts.add(account);
    }

    function removeReservedAccount(address account) public onlyRole(ADMIN_ROLE) {
        _reservedAccounts.remove(account);
    }

    function setToken(address token) public onlyRole(ADMIN_ROLE) {
        _token = Token(token);
    }

    function setTreasury(address treasury) public onlyRole(ADMIN_ROLE) {
        _treasury = Treasury(treasury);
    }

    ////// INFO VIEWS //////

    function circulatingSupply() public view returns (uint256) {
        return _token.totalSupply() - lockedSupply();
    }

    function lockedSupply() public view returns (uint256) {
        uint256 ls = _token.balanceOf(address(_treasury));
        for (uint i = 0; i < _reservedAccounts.length(); i++) {
            ls += _token.balanceOf(_reservedAccounts.at(i));
        }
        return ls;
    }

    function reservedAccounts() public view returns (address[] memory) {
        return _reservedAccounts.values();
    }
}
