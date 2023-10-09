// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "forge-std/Test.sol";
import "./Utils.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/testnet/TwistedWETH.sol";
import "../contracts/Treasury.sol";
import "../contracts/Token.sol";
import "../contracts/Bondage.sol";

contract BondageTest is Test {
    // Test Utils
    User u;

    // Testnet Contracts
    TwistedWETH weth;

    // Contracts under Test
    Token token;
    Treasury treasury;
    Bondage bondage;

    function setUp() public {
        u = new User();

        weth = new TwistedWETH();

        vm.startPrank(u.Admin());
        treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        treasury.initialize(u.Admin());
        treasury.grantRole(treasury.MANAGER_ROLE(), u.Admin());
        treasury.grantRole(treasury.OPERATOR_ROLE(), u.Admin());
        token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        token.initialize(u.Admin(), address(treasury));
        bondage = Bondage(address(new ERC1967Proxy(address(new Bondage()), "")));
        bondage.initialize(u.Admin(), address(token), address(treasury));
        bondage.grantRole(bondage.MANAGER_ROLE(), u.Manager());
        vm.stopPrank();

        vm.startPrank(u.Manager());
        bondage.grantRole(bondage.OPERATOR_ROLE(), u.Operator());
        vm.stopPrank();

        vm.startPrank(u.Nobody());
        weth.feedMe(100 ether);
        vm.stopPrank();
    }

    ////// UNIT TESTS //////

    /// HAPPY CASE ///

    function test_bondSale_complete_HappyCase() external {
        // Approve bond budget
        vm.startPrank(u.Admin());
        treasury.approve(treasury.OP_BONDS(), address(token), address(bondage), 20000 ether);
        vm.stopPrank();

        // Create bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleNew();
        bondage.bondSaleAdd(address(weth), 5000000 gwei, 1, 20000 ether);
        bondage.bondSaleStart();
        vm.stopPrank();

        // Buy bond
        vm.startPrank(u.Nobody());
        weth.approve(address(bondage), 100 ether);
        bondage.buyBond(1, 20000 ether);
        vm.stopPrank();
        assertEq(weth.balanceOf(u.Nobody()), 0);
        assertEq(weth.balanceOf(address(treasury)), 100 ether);


        // Close bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleClose();
        vm.stopPrank();


        // Claim bond
        vm.startPrank(u.Nobody());
        vm.warp(block.timestamp + 1 seconds);
        bondage.claimBond(1);
        vm.stopPrank();
        assertEq(token.balanceOf(address(bondage)), 0);
        assertEq(token.balanceOf(u.Nobody()), 20000 ether);
    }

    ////// INVARIANTS //////

    ////// FUZZING //////

}

contract BondageTestBuy is Test {
    // Test Utils
    User u;

    // Testnet Contracts
    TwistedWETH weth;

    // Contracts under Test
    Token token;
    Treasury treasury;
    Bondage bondage;

    function setUp() public {
        u = new User();

        weth = new TwistedWETH();

        vm.startPrank(u.Admin());
        treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        treasury.initialize(u.Admin());
        treasury.grantRole(treasury.MANAGER_ROLE(), u.Admin());
        treasury.grantRole(treasury.OPERATOR_ROLE(), u.Admin());
        token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        token.initialize(u.Admin(), address(treasury));
        bondage = Bondage(address(new ERC1967Proxy(address(new Bondage()), "")));
        bondage.initialize(u.Admin(), address(token), address(treasury));
        bondage.grantRole(bondage.MANAGER_ROLE(), u.Manager());
        vm.stopPrank();

        vm.startPrank(u.Manager());
        bondage.grantRole(bondage.OPERATOR_ROLE(), u.Operator());
        vm.stopPrank();

        vm.startPrank(u.Nobody());
        weth.feedMe(100 ether);
        vm.stopPrank();

        // Approve bond budget
        vm.startPrank(u.Admin());
        treasury.approve(treasury.OP_BONDS(), address(token), address(bondage), 20000 ether);
        vm.stopPrank();

        // Create bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleNew();
        bondage.bondSaleAdd(address(weth), 5000000 gwei, 1, 20000 ether);
        bondage.bondSaleStart();
        vm.stopPrank();
    }

    function test_bondBuy_happy() external {
        

        // Buy bond
        vm.startPrank(u.Nobody());
        weth.approve(address(bondage), 100 ether);
        bondage.buyBond(1, 20000 ether);
        vm.stopPrank();
        assertEq(weth.balanceOf(u.Nobody()), 0);
        assertEq(weth.balanceOf(address(treasury)), 100 ether);

        // Claim bond
        vm.startPrank(u.Nobody());
        vm.warp(block.timestamp + 1 seconds);
        bondage.claimBond(1);
        vm.stopPrank();
        assertEq(token.balanceOf(address(bondage)), 0);
        assertEq(token.balanceOf(u.Nobody()), 20000 ether);
    }
}

contract BondageTestClaim is Test {
    // Test Utils
    User u;

    // Testnet Contracts
    TwistedWETH weth;

    // Contracts under Test
    Token token;
    Treasury treasury;
    Bondage bondage;

    function setUp() public {
        u = new User();

        weth = new TwistedWETH();

        vm.startPrank(u.Admin());
        treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        treasury.initialize(u.Admin());
        treasury.grantRole(treasury.MANAGER_ROLE(), u.Admin());
        treasury.grantRole(treasury.OPERATOR_ROLE(), u.Admin());
        token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        token.initialize(u.Admin(), address(treasury));
        bondage = Bondage(address(new ERC1967Proxy(address(new Bondage()), "")));
        bondage.initialize(u.Admin(), address(token), address(treasury));
        bondage.grantRole(bondage.MANAGER_ROLE(), u.Manager());
        vm.stopPrank();

        vm.startPrank(u.Manager());
        bondage.grantRole(bondage.OPERATOR_ROLE(), u.Operator());
        vm.stopPrank();

        vm.startPrank(u.Nobody());
        weth.feedMe(100 ether);
        vm.stopPrank();

        // Approve bond budget
        vm.startPrank(u.Admin());
        treasury.approve(treasury.OP_BONDS(), address(token), address(bondage), 20000 ether);
        vm.stopPrank();

        // Create bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleNew();
        bondage.bondSaleAdd(address(weth), 5000000 gwei, 1, 20000 ether);
        bondage.bondSaleStart();
        vm.stopPrank();

        // Buy bond
        vm.startPrank(u.Nobody());
        weth.approve(address(bondage), 100 ether);
        bondage.buyBond(1, 20000 ether);
        vm.stopPrank();
        assertEq(weth.balanceOf(u.Nobody()), 0);
        assertEq(weth.balanceOf(address(treasury)), 100 ether);

        // Close bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleClose();
        vm.stopPrank();
    }

    function test_bondClaim_happy() external {
        // Claim bond
        vm.startPrank(u.Nobody());
        vm.warp(block.timestamp + 1 seconds);
        bondage.claimBond(1);
        vm.stopPrank();
        assertEq(token.balanceOf(address(bondage)), 0);
        assertEq(token.balanceOf(u.Nobody()), 20000 ether);
    }
}



contract BondageTestCloseSale is Test {
    // Test Utils
    User u;

    // Testnet Contracts
    TwistedWETH weth1;
    TwistedWETH weth2;
    TwistedWETH weth3;

    // Contracts under Test
    Token token;
    Treasury treasury;
    Bondage bondage;

    function setUp() public {
        u = new User();

        weth1 = new TwistedWETH();
        weth2 = new TwistedWETH();
        weth3 = new TwistedWETH();

        vm.startPrank(u.Admin());
        treasury = Treasury(address(new ERC1967Proxy(address(new Treasury()), "")));
        treasury.initialize(u.Admin());
        treasury.grantRole(treasury.MANAGER_ROLE(), u.Admin());
        treasury.grantRole(treasury.OPERATOR_ROLE(), u.Admin());
        token = Token(address(new ERC1967Proxy(address(new Token()), "")));
        token.initialize(u.Admin(), address(treasury));
        bondage = Bondage(address(new ERC1967Proxy(address(new Bondage()), "")));
        bondage.initialize(u.Admin(), address(token), address(treasury));
        bondage.grantRole(bondage.MANAGER_ROLE(), u.Manager());
        vm.stopPrank();

        vm.startPrank(u.Manager());
        bondage.grantRole(bondage.OPERATOR_ROLE(), u.Operator());
        vm.stopPrank();

        vm.startPrank(u.Nobody());
        weth1.feedMe(100 ether);
        vm.stopPrank();

        // Approve bond budget
        vm.startPrank(u.Admin());
        treasury.approve(treasury.OP_BONDS(), address(token), address(bondage), 30000 ether);
        vm.stopPrank();

        // Create bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleNew();
        bondage.bondSaleAdd(address(weth1), 5000000 gwei, 1, 10000 ether);
        bondage.bondSaleAdd(address(weth2), 5000000 gwei, 1, 10000 ether);
        bondage.bondSaleAdd(address(weth3), 5000000 gwei, 1, 10000 ether);
        bondage.bondSaleStart();
        vm.stopPrank();
    }

    function test_bondSaleClose_Empty() external {
        // Check initial balances
        assertEq(token.balanceOf(address(bondage)), 30000 ether);
        uint256 balance = token.balanceOf(address(treasury));


        // Close bond sale
        vm.startPrank(u.Operator()); // BONDS_MANAGER
        bondage.bondSaleClose();
        vm.stopPrank();

        // Check Balances
        assertEq(token.balanceOf(address(bondage)), 0 ether);
        assertEq(token.balanceOf(address(treasury)), balance + 30000 ether);

        // // Check open bonds
        assertEq(bondage.activeMarkets().length, 0, "activeMarkets > 0");
        assertEq(bondage.bondSaleViewStaging().length, 0, "bondSaleViewStaging > 0");
    }
}


