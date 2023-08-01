// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/Treasury.sol";
import "../contracts/Token.sol";

contract TreasuryTest is Test {
    address public constant uAdmin = 0x00000000000000000000000000000000000aD814;
    address public constant uOperator = 0x0000000000000000000000006F70657261746F72;
    address public constant uWithdrawer = 0x0000000000000000000077697468647261776572;
    address public constant uNobody = 0x000000000000000000000000000000000000b1c8;

    Token token;
    Treasury treasury;

    function setUp() public {
        vm.startPrank(uAdmin);
        treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        treasury.initialize(uAdmin);
        treasury.grantRole(treasury.MANAGER_ROLE(), uAdmin);
        treasury.grantRole(treasury.OPERATOR_ROLE(), uOperator);
        token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        token.initialize(uAdmin, address(treasury));
        vm.stopPrank();
    }

    function test_approve_HappyCase() public {
        vm.startPrank(uOperator);
        treasury.approve(treasury.OP_BONDS(), address(token), uWithdrawer, 1337);
        vm.stopPrank();
    }

    function test_withdraw_HappyCase() public {
        vm.startPrank(uOperator);
        treasury.approve(treasury.OP_BONDS(), address(token), uWithdrawer, 1337);
        vm.stopPrank();
        vm.startPrank(uWithdrawer);
        treasury.withdraw(treasury.OP_BONDS(), address(token), 1337);
        vm.stopPrank();
    }
}
