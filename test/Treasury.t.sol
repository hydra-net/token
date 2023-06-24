// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "forge-std/Test.sol";
import "@et/contracts/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/Treasury.sol";
import "../contracts/Token.sol";

contract TreasuryTest is Test {
    // Test Utils
    User u;

    // Contracts under Test
    Token token;
    Treasury treasury;

    function setUp() public {
        u = new User();
        vm.startPrank(u.Admin());
        treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        treasury.initialize(u.Admin());
        treasury.grantRole(treasury.MANAGER_ROLE(), u.Manager());
        token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        token.initialize(u.Admin(), address(treasury));
        vm.stopPrank();

        vm.startPrank(u.Manager());
        treasury.grantRole(treasury.OPERATOR_ROLE(), u.Operator());
        vm.stopPrank();
    }

    ////// UNIT TESTS //////

    /// HAPPY CASE ///

    function test_approve_HappyCase() external {
        vm.startPrank(u.Operator());
        treasury.approve(treasury.OP_BONDS(), address(token), u.Withdrawer(), 1337);
        vm.stopPrank();
    }

    function test_withdraw_HappyCase() external {
        vm.startPrank(u.Operator());
        treasury.approve(treasury.OP_BONDS(), address(token), u.Withdrawer(), 1337);
        vm.stopPrank();
        vm.startPrank(u.Withdrawer());
        treasury.withdraw(treasury.OP_BONDS(), address(token), 1337);
        vm.stopPrank();
    }

    ////// INVARIANTS //////

    ////// FUZZING //////

}
