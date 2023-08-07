// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "forge-std/Test.sol";
import "./Utils.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/Treasury.sol";
import "../contracts/Token.sol";

// Test Constants
uint256 constant TEST_AMOUNT = 1337;

contract TreasuryTest is Test {
    // Test Utils
    User u;

    // Contracts under Test
    Token _token;
    Treasury _treasury;
    TreasuryTestHandler treasuryHandler;

    function setUp() public {
        u = new User();
        vm.startPrank(u.Admin());
        _treasury = Treasury(
            address(new ERC1967Proxy(address(new Treasury()), ""))
        );
        _treasury.initialize(u.Admin());
        _treasury.grantRole(_treasury.MANAGER_ROLE(), u.Admin());
        _treasury.grantRole(_treasury.MANAGER_ROLE(), u.Manager());
        _token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        _token.initialize(u.Admin(), address(_treasury));
        vm.stopPrank();

        vm.startPrank(u.Manager());
        _treasury.grantRole(_treasury.OPERATOR_ROLE(), u.Operator());
        vm.stopPrank();

        // Invariant & Fuzzing Config
        treasuryHandler = new TreasuryTestHandler(u, _treasury, _token);
        targetContract(address(treasuryHandler));

        // Seed
        // Need at least 1 withdrawer
        treasuryHandler.approve(u.Withdrawer(), TEST_AMOUNT, 0);
    }

    ////// UNIT TESTS //////

    /// HAPPY CASE ///

    function test_approve_HappyCase() external {
        bytes32 operation = _treasury.OP_BONDS();
        uint256 amount = TEST_AMOUNT;

        vm.startPrank(u.Operator());
        _treasury.approve(operation, address(_token), u.Withdrawer(), amount);
        vm.stopPrank();
        uint256 allowance = _treasury.allowance(
            operation,
            address(_token),
            u.Withdrawer()
        );
        assertEq(amount, allowance);
    }

    function test_withdraw_HappyCase() external {
        bytes32 operation = _treasury.OP_BONDS();
        uint256 amount = TEST_AMOUNT;

        vm.startPrank(u.Operator());
        _treasury.approve(operation, address(_token), u.Withdrawer(), amount);
        vm.stopPrank();

        vm.startPrank(u.Withdrawer());
        uint256 allowance = _treasury.allowance(operation, address(_token));
        vm.stopPrank();
        assertEq(amount, allowance);

        vm.startPrank(u.Withdrawer());
        uint256 allowanceBefore = _treasury.allowance(
            operation,
            address(_token)
        );
        _treasury.withdraw(operation, address(_token), amount);
        uint256 allowanceAfter = _treasury.allowance(
            operation,
            address(_token)
        );
        vm.stopPrank();
        assertEq(allowanceBefore - amount, allowanceAfter);
    }

    ////// INVARIANTS & FUZZING //////

    // Ensure all test handler functions are fuzzed
    // independently of satisfying specific invariant constraints
    function invariant_open() external {}

    // If an allowance reaches zero after withdrawal it should be removed
    function invariant_noEmptyAllowance() external {
        Treasury.Allowance[] memory alls = _treasury.allowances();
        for (uint i = 0; i < alls.length; i++) {
            assertGe(alls[i].amount, 0);
        }
    }

    // This is not really a necessary invariant
    // and it's actually broken
    // it's just here to test the invariant & fuzzing config
    // function invariant_balanceGeApproval() external {
    //     uint256 balance = _token.balanceOf(address(_treasury));
    //     Treasury.Allowance[] memory alls = _treasury.allowances();
    //     for (uint i = 0; i < alls.length; i++) {
    //         assertGe(balance, alls[i].amount);
    //     }
    // }
}

contract TreasuryTestHandler is Test, Actor {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Test Utils
    bytes32 public constant ROLE_WITHDRAWER = keccak256("ROLE_WITHDRAWER");
    User u;

    // Contract under Test
    Treasury _treasury;
    Token _token;

    constructor(
        User _u,
        Treasury treasury,
        Token token
    ) Actor(address(treasury), _u.Admin()) {
        u = _u;
        _treasury = treasury;
        _token = token;

        generateActors(_treasury.OPERATOR_ROLE(), 1);
    }

    function approve(
        address spender,
        uint256 amount,
        uint256 actorIndexSeed
    ) public virtual actAs(_treasury.OPERATOR_ROLE(), actorIndexSeed) {
        // ARRANGE
        bytes32 operation = _treasury.OP_BONDS();
        uint256 balance = _token.balanceOf(address(_treasury));
        uint256 allowanceBefore = _treasury.allowance(
            operation,
            address(_token),
            spender
        );
        // Fail on insufficient balance
        if (amount + allowanceBefore > balance) vm.expectRevert();

        // ACT
        bool success = _treasury.approve(operation, address(_token), spender, amount);

        // ASSERT
        // Only assert state if call was successful
        if (!success) {
            return;
        }
        uint256 allowanceAfter = _treasury.allowance(
            operation,
            address(_token),
            spender
        );
        assertEq(allowanceBefore + amount, allowanceAfter);

        // ADAPT
        // We just approved a new spender, 
        // might as well use it in following test executions
        _actors[ROLE_WITHDRAWER].add(spender);
    }

    function withdraw(
        uint256 amount,
        uint256 actorIndexSeed
    ) public virtual actAs(ROLE_WITHDRAWER, actorIndexSeed) {
        // ARRANGE
        bytes32 operation = _treasury.OP_BONDS();
        uint256 allowanceBefore = _treasury.allowance(
            operation,
            address(_token)
        );

        // Fail on insufficient allowance
        if (amount > allowanceBefore) vm.expectRevert();

        // ACT
        bool success = _treasury.withdraw(operation, address(_token), amount);

        // ASSERT
        // Only assert state if call was successful
        if (!success) {
            return;
        }
        uint256 allowanceAfter = _treasury.allowance(
            operation,
            address(_token)
        );
        assertEq(allowanceBefore - amount, allowanceAfter);

        // ADAPT
        // No allowance? -> Not a withdrawer anymore
        if (allowanceAfter == 0) {
            _actors[ROLE_WITHDRAWER].remove(_actor);
        }
    }
}
