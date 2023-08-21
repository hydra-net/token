// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./libraries/templates/ContractBase.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./Treasury.sol";


/// @custom:security-contact security@hydranet.ai
contract Bondage is ContractUpgradableDelegatable, ReentrancyGuardUpgradeable {
    // CONFIG
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // STATE
    IERC20Metadata private _token;
    Treasury private _treasury;
    BondMap private _maturingBonds;
    BondMarketMap private _bondMarkets;
    uint256 private _startTimestamp;

    // EVENTS
    event BondMarketCreated(BondMarket market);
    event BondMarketDeleted(BondMarket market);
    event BondMarketOpened(BondMarket market);
    event BondMarketClosed(BondMarket market);
    event BondSold(address indexed owner, Bond bond);
    event BondClaimed(address indexed owner, Bond bond);

    // ERRORS
    error BondIndexCorrupted();
    error BondSaleActive();
    error BondSaleNotActive();
    error BondMarketNotActive(uint id);
    error BondMarketInsufficientVolume(uint id, uint amount, uint volume);
    error BondMarketFundingTransferFailed(uint volume);
    error BondMarketClosingInsufficientBalance(uint amount, uint balance);
    error BondMarketClosingRefundTransferFailed(uint amount);
    error BondNotActive(uint id);
    error BondNotMatured(uint id);
    error BondNotOwnedByCaller(uint id);
    error BondPayoutTransferFailed(uint id);
    error BondBuyTransferFailed(uint market, uint amount, uint quoteAmount);

    // TYPES

    struct BondMarket {
        uint id; // Sequential, generated on creation
        address quoteToken; // ERC-20 Contract representing token used to buy bond
        uint price; // For 1 Token in num. quoteTokens (respecting digits from quoteToken ERC-20)
        uint duration; // Time in seconds from buying bond until maturation
        uint volume; // Total num. of our Tokens (HDN) to be sold in this market (market = "round of bonds")
        uint sold; // Num. of our Tokens (HDN) sold in this market so far
    }

    struct Bond {
        uint id; // Sequential, generated on buy
        uint marketId; // BondMarket.id
        address owner; // Owner of this bond
        uint maturation; // Timestamp when bond is matured and can be claimed
        uint amount; // Num. of our Tokens (HDN) locked in this bond
        uint price; // For 1 Token (1 HDN = 1 * 10 ** HDN.decimals()) in num. quoteTokens
        address quoteToken; // ERC-20 Contract representing token used to buy bond
        uint term; // Duration of bond in seconds (from corresponding BondMarket)
    }

    // Also called a BondSale or "round of bonds"
    struct BondMarketMap {
        CountersUpgradeable.Counter seqId;
        EnumerableSetUpgradeable.UintSet ids;
        mapping(uint => BondMarket) markets;
        uint256 live; // Is the BondSale active (1), in preparation (0), or suspended (3)?
    }

    struct BondMap {
        CountersUpgradeable.Counter seqId; // Sequential ID generator
        EnumerableSetUpgradeable.AddressSet addresses;
        mapping(address => uint[]) index;
        mapping(uint => Bond) bonds;
    }

    ////// INITIALIZATION //////

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address token,
        address treasury
    ) public initializer {
        __BaseContract_init(admin);

        _token = IERC20Metadata(token);
        _treasury = Treasury(treasury);
    }

    ////// PUBLIC //////

    // USER / EVERONE //

    function buyBond(uint marketId, uint amount) public nonReentrant {
        if (!_bondMarkets.ids.contains(marketId)) {
            revert BondMarketNotActive(marketId);
        }
        BondMarket memory market = _bondMarkets.markets[marketId];
        if (market.volume - market.sold < amount) {
            revert BondMarketInsufficientVolume(
                marketId,
                amount,
                market.volume
            );
        }

        // Pay for bond
        IERC20 quoteToken = IERC20(market.quoteToken);
        uint quoteAmount = (amount * market.price) / 10 ** _token.decimals();
        // TODO: Permit2 (Allowance Management)
        bool success = quoteToken.transferFrom(
            _msgSender(),
            address(_treasury),
            quoteAmount
        );
        if (!success) {
            revert BondBuyTransferFailed(marketId, amount, quoteAmount);
        }

        // Store maturing bond
        _maturingBonds.seqId.increment();
        Bond memory bond = Bond(
            _maturingBonds.seqId.current(),
            marketId,
            _msgSender(),
            block.timestamp + market.duration,
            amount,
            market.price,
            market.quoteToken,
            market.duration
        );
        _maturingBonds.bonds[bond.id] = bond;
        _maturingBonds.index[bond.owner].push(bond.id);
        _maturingBonds.addresses.add(bond.owner);

        // Update market
        market.sold += amount;
        _bondMarkets.markets[marketId].sold = market.sold;
        if (market.volume == market.sold) {
            _closeBondMarket(marketId);
        }

        emit BondSold(_msgSender(), bond);
    }

    function claimBond(uint bondId) public nonReentrant {
        _claimBond(bondId);
    }

    function claimBonds(uint[] calldata bondIds) public nonReentrant {
        for (uint i = 0; i < bondIds.length; i++) {
            _claimBond(bondIds[i]);
        }
    }

    // BONDS MANAGER //

    function bondMarketClose(uint id) public onlyRole(OPERATOR_ROLE) {
        if (_bondMarkets.live != 1) {
            revert BondSaleNotActive();
        }
        _closeBondMarket(id);
    }

    function bondSaleNew() public onlyRole(OPERATOR_ROLE) {
        if (_bondMarkets.live == 1) {
            revert BondSaleActive();
        }

        if (_bondMarkets.ids.length() > 0) {
            for (uint i = 0; i < _bondMarkets.ids.length(); i++) {
                uint id = _bondMarkets.ids.at(i);
                emit BondMarketDeleted(_bondMarkets.markets[id]);
                delete _bondMarkets.markets[id];
                _bondMarkets.ids.remove(id);
            }
        }
    }

    function bondSaleAdd(
        address quoteToken,
        uint price,
        uint duration,
        uint volume
    ) public onlyRole(OPERATOR_ROLE) {
        if (_bondMarkets.live == 1) {
            revert BondSaleActive();
        }
        _createBondMarket(quoteToken, price, duration, volume);
    }

    function bondSaleStart() public onlyRole(OPERATOR_ROLE) {
        if (_bondMarkets.live == 1) {
            revert BondSaleActive();
        }
        for (uint i = 0; i < _bondMarkets.ids.length(); i++) {
            uint id = _bondMarkets.ids.at(i);
            emit BondMarketOpened(_bondMarkets.markets[id]);
        }
        _bondMarkets.live = 1;
        _startTimestamp = block.timestamp;
    }

    function bondSaleClose() public onlyRole(OPERATOR_ROLE) {
        if (_bondMarkets.live != 1) {
            revert BondSaleNotActive();
        }
        for (uint i = 0; i < _bondMarkets.ids.length(); i++) {
            uint id = _bondMarkets.ids.at(i);
            _closeBondMarket(id);
        }
        _bondMarkets.live = 0;
        _startTimestamp = 0;
    }

    // BONDS MANAGER VIEWS //

    function bondSaleViewStaging() public view returns (BondMarket[] memory) {
        if (_bondMarkets.live == 1) {
            revert BondSaleActive();
        }

        return _viewActiveMarkets();
    }

    //// PUBLIC VIEW FUNCTIONS ////

    function activeMarkets() public view returns (BondMarket[] memory) {
        if (_bondMarkets.live != 1) {
            return new BondMarket[](0);
        }

        return _viewActiveMarkets();
    }

    function maturingBonds(address owner) public view returns (Bond[] memory) {
        Bond[] memory bonds = new Bond[](_maturingBonds.index[owner].length);
        for (uint i = 0; i < _maturingBonds.index[owner].length; i++) {
            bonds[i] = _maturingBonds.bonds[_maturingBonds.index[owner][i]];
        }
        return bonds;
    }

    function allMaturingBonds() public view returns (Bond[] memory) {
        // Determine num. of bonds
        uint length = 0;
        for (uint i = 0; i < _maturingBonds.addresses.length(); i++) {
            address owner = _maturingBonds.addresses.at(i);
            length += _maturingBonds.index[owner].length;
        }
        Bond[] memory bonds = new Bond[](length);
        uint ix = 0;
        for (uint i = 0; i < _maturingBonds.addresses.length(); i++) {
            address owner = _maturingBonds.addresses.at(i);
            for (uint j = 0; j < _maturingBonds.index[owner].length; j++) {
                bonds[ix] = _maturingBonds.bonds[
                    _maturingBonds.index[owner][j]
                ];
                ix++;
            }
        }
        return bonds;
    }

    function claimableBonds() public view returns (Bond[] memory) {
        Bond[] memory bonds = allMaturingBonds();
        uint length = 0;
        for (uint i = 0; i < bonds.length; i++) {
            if (bonds[i].maturation < block.timestamp) {
                length++;
            }
        }
        Bond[] memory overdueBonds = new Bond[](length);
        uint ix = 0;
        for (uint i = 0; i < bonds.length; i++) {
            if (bonds[i].maturation < block.timestamp) {
                overdueBonds[ix] = bonds[i];
                ix++;
            }
        }
        return overdueBonds;
    }

    function bondSaleStartDate() public view returns (uint256) {
        return _startTimestamp;
    }


    ////// INTERNAL //////

    // DOMAIN LOGIC //

    function _createBondMarket(
        address quoteToken,
        uint price,
        uint duration,
        uint volume
    ) internal {
        _bondMarkets.seqId.increment();
        BondMarket memory market = BondMarket(
            _bondMarkets.seqId.current(),
            quoteToken,
            price,
            duration,
            volume,
            0
        );
        _bondMarkets.markets[market.id] = market;
        _bondMarkets.ids.add(market.id);

        _treasury.withdraw(_treasury.OP_BONDS(), address(_token), volume);
        emit BondMarketCreated(market);
    }

    function _closeBondMarket(uint id) private {
        if (!_bondMarkets.ids.contains(id)) {
            revert BondMarketNotActive(id);
        }
        BondMarket memory market = _bondMarkets.markets[id];
        _bondMarkets.ids.remove(id);
        delete _bondMarkets.markets[id];

        // Refund remaining volume
        uint amount = market.volume - market.sold;
        if (amount > 0) {
            IERC20 token = IERC20(_token);
            uint balance = token.balanceOf(address(this));
            if (amount > balance) {
                revert BondMarketClosingInsufficientBalance(amount, balance);
            }
            bool success = token.transfer(address(_treasury), amount);
            if (!success) {
                revert BondMarketClosingRefundTransferFailed(amount);
            }
        }

        emit BondMarketClosed(market);
    }

    function _claimBond(uint id) private {
        Bond memory bond = _maturingBonds.bonds[id];
        if (bond.id == 0) {
            revert BondNotActive(id);
        }
        if (
            bond.owner != _msgSender() && !hasRole(MANAGER_ROLE, _msgSender())
        ) {
            revert BondNotOwnedByCaller(id);
        }
        if (bond.maturation > block.timestamp) {
            revert BondNotMatured(id);
        }

        // Remove Bond ID from index
        if (_maturingBonds.index[bond.owner].length == 0) {
            revert BondIndexCorrupted();
        } else if (_maturingBonds.index[bond.owner].length == 1) {
            delete _maturingBonds.index[bond.owner];
            _maturingBonds.addresses.remove(bond.owner);
        } else {
            uint length = _maturingBonds.index[bond.owner].length;
            for (uint i = 0; i < length; i++) {
                if (_maturingBonds.index[bond.owner][i] == id) {
                    _maturingBonds.index[bond.owner][i] = _maturingBonds.index[
                        bond.owner
                    ][length - 1];
                    _maturingBonds.index[bond.owner].pop();
                    break;
                }
            }
        }

        // Delete Bond from active set
        delete _maturingBonds.bonds[id];

        // Payout Bond
        bool success = IERC20(_token).transfer(bond.owner, bond.amount);
        if (!success) {
            revert BondPayoutTransferFailed(id);
        }
        emit BondClaimed(bond.owner, bond);
    }

    ////// INTERNAL VIEWS //////

    function _viewActiveMarkets() internal view returns (BondMarket[] memory) {
        BondMarket[] memory markets = new BondMarket[](
            _bondMarkets.ids.length()
        );
        for (uint i = 0; i < _bondMarkets.ids.length(); i++) {
            markets[i] = _bondMarkets.markets[_bondMarkets.ids.at(i)];
        }
        return markets;
    }
}
