// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

/// @title Interface for Contracts that have regular housekeeping requirements
interface IHousekeeping {
    function housekeeping() external;
}

