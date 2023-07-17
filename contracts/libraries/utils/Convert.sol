// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

library Convert {
    function ToString(bytes32 str) internal pure returns (string memory) {
        return StringsUpgradeable.toString(uint256((str)));
    }
    function FromString(string memory str) internal pure returns (bytes32) {
        return bytes32(bytes(str));
    }
}
