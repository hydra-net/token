// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Forge Imports
import "forge-std/Test.sol";
import "./Utils.sol";

// Contracts
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/Treasury.sol";
import "../contracts/Token.sol";
import "../contracts/Info.sol";

// Test Constants
uint256 constant TEST_INITIAL_SUPPLY = 300000000 ether;
bytes32 constant TEST_OPERATION = keccak256("TEST_OPERATION");

contract InfoTest is Test {
    // Test Utils
    User u;

    // Dependency Contracts
    Token _token;
    Treasury _treasury;

    // Contracts under Test
    Info _info;

    function setUp() public {
        u = new User();

        vm.startPrank(u.Admin());
        _treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        _treasury.initialize(u.Admin());
        _treasury.grantRole(_treasury.MANAGER_ROLE(), u.Admin());
        _treasury.grantRole(_treasury.OPERATOR_ROLE(), u.Admin());
        _token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        _token.initialize(u.Admin(), address(_treasury));

        _treasury.approve(TEST_OPERATION, address(_token), u.Nobody(), TEST_INITIAL_SUPPLY);

        _info = Info(address(new ERC1967Proxy(address(new Info()), "")));
        _info.initialize(u.Admin(), address(_token), address(_treasury));
        vm.stopPrank();
    }

    ////// UNIT TESTS //////

    function test_infoview_initialSupply() external {
        assertEq(_info.lockedSupply(), TEST_INITIAL_SUPPLY);
        assertEq(_info.circulatingSupply(), 0);
    }

    function test_infoview_circulatingSupply() external {
        uint256 transferAmount = 123456 ether;

        vm.startPrank(u.Nobody());
        _treasury.withdraw(TEST_OPERATION, address(_token), transferAmount);
        vm.stopPrank();

        assertEq(_info.lockedSupply(), TEST_INITIAL_SUPPLY - transferAmount);
        assertEq(_info.circulatingSupply(), transferAmount);
    }

    function test_infoview_addReservedAccount() external {
        uint256 transferAmount = 123456 ether;

        vm.startPrank(u.Nobody());
        _treasury.withdraw(TEST_OPERATION, address(_token), transferAmount);
        vm.stopPrank();

        vm.startPrank(u.Admin());
        _info.addReservedAccount(u.Nobody());
        vm.stopPrank();

        assertEq(_info.lockedSupply(), TEST_INITIAL_SUPPLY);
        assertEq(_info.circulatingSupply(), 0);
    }

    function test_infoview_removeReservedAccount() external {
        uint256 transferAmount = 123456 ether;

        vm.startPrank(u.Nobody());
        _treasury.withdraw(TEST_OPERATION, address(_token), transferAmount);
        vm.stopPrank();

        vm.startPrank(u.Admin());
        _info.addReservedAccount(u.Nobody());
        _info.removeReservedAccount(u.Nobody());
        vm.stopPrank();

        assertEq(_info.lockedSupply(), TEST_INITIAL_SUPPLY - transferAmount);
        assertEq(_info.circulatingSupply(), transferAmount);
    }
}
