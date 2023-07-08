// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/IAccessControlDefaultAdminRulesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/IAccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title Interface for BaseContract
interface IContract {}

/// @title Interface for upgradeable BaseContract
interface IContractUpgradeable is IContract, IAccessControlUpgradeable, IAccessControlDefaultAdminRulesUpgradeable, IAccessControlEnumerableUpgradeable {}