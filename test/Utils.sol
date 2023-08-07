// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract Constants {}

contract User {
    address public constant Admin = 0x00000000000000000000000000000000000aD814;
    address public constant Manager =
        0x000000000000000000000000006d616e61676572;
    address public constant Operator =
        0x0000000000000000000000006F70657261746F72;
    address public constant Withdrawer =
        0x0000000000000000000077697468647261776572;
    address public constant Nobody = 0x000000000000000000000000000000000000b1c8;
}

contract Limits is Test {
    modifier limit(uint256 val, uint256 min, uint256 max) {
        if (val < min || val > max) {
            vm.expectRevert();
            _;
            return;
        }
    }
}

contract Actor is Test {
    using EnumerableSet for EnumerableSet.AddressSet;
    mapping(bytes32 => EnumerableSet.AddressSet) internal _actors;
    address internal _actor;
    address internal _admin;
    IAccessControl internal _contract;

    constructor(address acContract, address admin) {
        _contract = IAccessControl(acContract);
        _admin = admin;
    }

    function generateActors(bytes32 role, uint256 count) internal {
        for (uint i = 0; i < count; i++) {
            address addr = address(
                bytes20(keccak256(abi.encodePacked(block.timestamp, role, count)))
            );
            _actors[role].add(addr);
            vm.startPrank(_admin);
            _contract.grantRole(role, addr);
            vm.stopPrank();
        }
    }

    modifier actAs(bytes32 role, uint256 actorIndexSeed) {
        EnumerableSet.AddressSet storage actors = _actors[role];
        // if (actors.length() == 0) return;
        _actor = actors.at(bound(actorIndexSeed, 0, actors.length() - 1));
        vm.startPrank(_actor);
        _;
        vm.stopPrank();
    }
}
