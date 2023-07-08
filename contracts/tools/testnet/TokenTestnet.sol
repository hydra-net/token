// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../../Token.sol";

/// @custom:security-contact security@hydranet.ai
contract TokenTestnet is Token {
    function mint(address to, uint256 amount) public override(Token) onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    function burn (uint256 amount)public override(Token) onlyRole(MINTER_ROLE) {
        super.burn(amount);
    }
}
