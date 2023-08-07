// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";
import "./libraries/templates/ContractBase.sol";
import "./interfaces/IERC20.sol";

/// @custom:security-contact security@hydranet.ai
contract Treasury is ContractUpgradableDelegatable {
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;

    // OPERATIONS
    bytes32 public constant OP_BONDS = keccak256("BONDS_OPERATION");

    // STATE
    EnumerableMapUpgradeable.UintToUintMap internal _allowances;
    Index internal _index;

    // EVENTS
    event AllowanceApproved(
        address approver,
        bytes32 operation,
        address token,
        address spender,
        uint256 amount
    );
    event AllowanceRevoked(
        address revoker,
        bytes32 operation,
        address token,
        address spender
    );
    event Withdrawal(
        address recipient,
        bytes32 operation,
        address token,
        uint256 amount
    );

    // ERRORS
    error InsufficientAllowance(
        bytes32 operation,
        address token,
        address spender,
        uint256 allowance,
        uint256 amount
    );
    error InsufficientBalance(address token, uint256 balance, uint256 amount);

    // TYPES
    struct Allowance {
        bytes32 operation;
        address token;
        address spender;
        uint256 amount;
    }
    struct Index {
        mapping(bytes32 => mapping(address => mapping(address => uint256))) ix;
        mapping(uint256 => bytes32) operation;
        mapping(uint256 => address) token;
        mapping(uint256 => address) spender;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __BaseContract_init(admin);
    }

    ////// IMPLEMENTATION //////

    function approve(
        bytes32 operation,
        address token,
        address spender,
        uint256 amount
    ) public onlyRole(OPERATOR_ROLE) returns (bool) {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) {
            revert InsufficientBalance(token, bal, amount);
        }

        uint256 ix = _index.ix[operation][token][spender];
        if (ix == 0) {
            ix = _allowances.length() + 1;
            _index.ix[operation][token][spender] = ix;
            _index.operation[ix] = operation;
            _index.token[ix] = token;
            _index.spender[ix] = spender;
        }
        _allowances.set(ix, amount);
        emit AllowanceApproved(_msgSender(), operation, token, spender, amount);
        return true;
    }

    function revoke(
        bytes32 operation,
        address token,
        address spender
    ) public onlyRole(OPERATOR_ROLE) returns (bool) {
        uint256 ix = _index.ix[operation][token][spender];
        if (ix == 0) {
            revert InsufficientAllowance(operation, token, spender, 0, 0);
        }
        if (_allowances.get(ix) == 0) {
            revert InsufficientAllowance(operation, token, spender, 0, 0);
        }

        _allowances.remove(ix);
        delete _index.ix[operation][token][spender];
        delete _index.operation[ix];
        delete _index.token[ix];
        delete _index.spender[ix];
        emit AllowanceRevoked(_msgSender(), operation, token, spender);
        return true;
    }

    function withdraw(bytes32 operation, address token, uint amount) public returns (bool) {
        IERC20 _token = IERC20(token);
        uint256 _balance = _token.balanceOf(address(this));
        uint256 ix = _index.ix[operation][token][_msgSender()];

        // Check allowance & balance
        if (ix == 0) {
            revert InsufficientAllowance(
                operation,
                token,
                _msgSender(),
                0,
                amount
            );
        }
        uint256 _allowance = _allowances.get(ix);
        if (_allowance < amount) {
            revert InsufficientAllowance(
                operation,
                token,
                _msgSender(),
                _allowance,
                amount
            );
        }
        if (_balance < amount) {
            revert InsufficientBalance(token, _balance, amount);
        }

        // Update allowance
        uint256 _new_allowance = _allowance - amount;
        if (_new_allowance > 0) {
            _allowances.set(ix, _new_allowance);
        } else {
            _allowances.remove(ix);
            delete _index.ix[operation][token][_msgSender()];
            delete _index.operation[ix];
            delete _index.token[ix];
            delete _index.spender[ix];
        }

        // Process withdrawal
        _token.transfer(_msgSender(), amount);
        emit Withdrawal(_msgSender(), operation, token, amount);
        return true;
    }

    ////// PUBLIC VIEWS //////

    function allowance(bytes32 operation, address token) public view returns (uint256) {
        return allowance(operation, token, _msgSender());
    }

    function allowance(bytes32 operation, address token, address spender) public view returns (uint256) {
        uint256 ix = _index.ix[operation][token][spender];
        if (ix == 0) return 0;
        return _allowances.get(ix);
    }

    function allowance(uint256 ix) public view returns (uint256) {
        return _allowances.get(ix);
    }

    function allowances() public view returns (Allowance[] memory) {
        Allowance[] memory alls = new Allowance[](_allowances.length());
        for (uint i = 0; i < _allowances.length(); i++) {
            (uint256 ix, uint256 val) = _allowances.at(i);
            alls[i] = Allowance(
                _index.operation[ix],
                _index.token[ix],
                _index.spender[ix],
                val
            );
        }
        return alls;
    }
}
