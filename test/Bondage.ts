// TODO CONTRACT:
// Permit2 Integration: https://gasperpre.com/how-to-implement-uniswap-permit2-in-your-protocol
// Claim multiple Bonds in one tx
// Suspend Bond Markets (to counter attacks on quote token and to simplify prematurely closing markets)

// TODO TESTS:
// Fuzzing
// RBAC cases
import hre from "hardhat"

import { Logger, ILogObj } from "tslog"
import { Tokens, Contracts as ExternalContracts, Token, Contract as ExternalContract } from "../tools/et/external"
import { ContractInstance } from "../tools/et/contract"
import { UniqueWallets } from "../tools/et/wallets"
import { Tenderly, isTenderlyFork } from "../tools/et/tenderly"
import {
    CONSTANTS, SetupEnv, SetupContracts, SetupTokenContracts, TestEnvironment, Utils,
    TestContracts, TokenContracts as GenericTokenContracts
} from "../tools/et/test"

import { contracts as Contract } from "../typechain-types";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

// CONTRACTS //

const CONTRACT = "Bondage"
const CONTRACTS = [CONTRACT, "Token"]
const TOKEN_CONTRACTS: Record<string, Token> = {
    WETH: Tokens.WETH
}
const EXTERNAL_CONTRACTS: Record<string, [string, ExternalContract]> = {
    WETH: ["IWETH9", ExternalContracts.WETH.WETH9],
}

// TYPECHAIN SUPPORT //

interface Contracts extends TestContracts {
    Token: ContractInstance<Contract.Token>
    Bondage: ContractInstance<Contract.Bondage>
    WETH: ContractInstance<Contract.interfaces.external.IWETH9>
}

interface TokenContracts extends GenericTokenContracts {
    WETH: ContractInstance<IERC20>
}

// TEST ENVIRONMENT //

let log: Logger<ILogObj>
let t: TestEnvironment<Contracts, TokenContracts>



// TESTS //

describe(`${CONTRACT}`, function () {

    // Global Setup
    before(async function TestEnvironment() {
        t = await SetupEnv(hre) as TestEnvironment<Contracts, TokenContracts>
        log = t.log ?? new Logger<ILogObj>()
    })

    before(async function ConnectTokenContracts() {
        await FIXTURES.ConnectTokenContracts()
    })

    // UNIT TESTS //
    describe("Unit Tests", function () {

        // Only run Unit Tests on hardhat
        before(async function CheckChain() {
            if (!t.hardhat.isHardhat()) {
                this.skip()
            }
        })

        // Reset Contracts & Deploy Helpers
        beforeEach(async function DeployContracts() {
            await FIXTURES.DeployContracts()
        })

        // SetTokenBalances
        beforeEach(async function SetTokenBalances() {
            for (const [key, wallet] of Object.entries(UniqueWallets(t.Wallets))) {
                await t.hardhat.setBalance(wallet.address, Utils.ETH(300))
            }
        })

        it("Hello, I'm here to keep you company :)", async function () { })

    })

    describe("Simulations (Tenderly)", function () {
        // Only run Simulations on tenderly
        before(async function CheckChain() {
            // TODO: Create fork programatically
            if (!isTenderlyFork(hre)) {
                this.skip()
            }
        })

        // Reset Contracts & Deploy Helpers
        before(async function DeployContracts() {
            await FIXTURES.DeployContracts()
        })

        before(async function SetTokenBalances() {
            const wallets = UniqueWallets(t.Wallets)

            // Set Balances
            await t.tenderly.setBalance(Tenderly.ETH(200), Object.values(wallets).map(w => w.address))

            // Swap to WETH
            for (const [key, wallet] of Object.entries(wallets)) {
                t.log.info(`Swapping 100 ETH for WETH`, { wallet: key })
                await t.Contracts.WETH[key].deposit({ value: Utils.ETH(100) })
            }
        })

        describe("General", function () {
            it("We <3 Tenderly", async function () { })

            it("Happy Case :)", async function () {
                let tx, receipt
                let balanceWETH, balanceHDN

                // Initial State
                await Log.Balances("initial balance", "admin")
                await Log.Balances("initial balance", "user")
                await Log.Balances("initial balance", "user", undefined, "Bondage")

                // Create Bond Market
                tx = await t.Contracts.Token.admin.approve(t.Contracts.Bondage.admin.address, Utils.HexValue(CONSTANTS.INFINITE_ALLOWANCE))
                receipt = await tx.wait()
                tx = await t.Contracts.Bondage.admin.bondSaleNew()
                receipt = await tx.wait()
                tx = await t.Contracts.Bondage.admin.bondSaleAdd(t.utils.CurrentChain(Tokens.WETH), Utils.ETH(7), 5, Utils.ETH(100))
                receipt = await tx.wait()
                tx = await t.Contracts.Bondage.admin.bondSaleStart()
                receipt = await tx.wait()

                Log.Balances("createBondMarket success", "admin", { price: Utils.ETH(7), duration: 5, volume: Utils.ETH(100) })
                Log.Balances("contract balance after createBondMarket", "admin", { HDN: balanceHDN, WETH: balanceWETH }, "Bondage")

                // To get market ID. Spoiler: 1
                const activeMarkets = await t.Contracts.Bondage.user.activeMarkets()
                const marketId = 1
                t.log.info({ activeMarkets: activeMarkets })

                // Buy Bond Nr. 1
                tx = await t.TokenContracts.WETH.user.approve(t.Contracts.Bondage.user.address, Utils.HexValue(CONSTANTS.INFINITE_ALLOWANCE))
                receipt = await tx.wait()
                tx = await t.Contracts.Bondage.user.buyBond(marketId, Utils.ETH(10))
                receipt = await tx.wait()

                await Log.Balances("buyBond sucess", "user", { marketId: marketId, amount: Utils.ETH(10) })
                await Log.Balances("BONDS_MANAGER balance after buyBond", "admin")

                // To get bonds ID. Spoiler: 1
                const myBonds = await t.Contracts.Bondage.user.maturingBonds(t.Wallets.user.address)
                const bondId = 1
                t.log.info({ maturingBonds: myBonds, args: { address: t.Wallets.user.address } })

                await Hacks.Delay(6000)

                // Test overdue bonds (admin, for everyone)
                const claimableBonds = await t.Contracts.Bondage.admin.claimableBonds()
                t.log.info({ overdueMaturingBonds: claimableBonds })

                // Claim Bond Nr. 1
                tx = await t.Contracts.Bondage.user.claimBond(1)
                receipt = await tx.wait()

                await Log.Balances("claimBond sucess", "user", { bondId: bondId })
                await Log.Balances("contract balance after claimBond", "user", undefined, "Bondage")

                // DEBUG
                // console.log(tx)
                // console.log(receipt)
            })

        })

        describe("Security", function () { })
        describe("Known Attacks", function () { })
        describe("Regression", function () { })
    })
})


// FIXTURES //

class FIXTURES {
    // static T = Fixtures()

    static async DeployContracts() {
        const extcon = t.hardhat.isHardhat() ? undefined : EXTERNAL_CONTRACTS
        const connectedContracts = await SetupContracts(hre, t, CONTRACTS, extcon)
        t.Contracts = connectedContracts as Contracts
    }

    static async ConnectTokenContracts() {
        const connectedContracts = await SetupTokenContracts(hre, t, TOKEN_CONTRACTS)
        t.TokenContracts = connectedContracts as TokenContracts
    }

}

// HELPER

class Log {
    static async Balances(message: string, wallet: string, args?: any, contract?: string) {
        const target = contract ? t.Contracts[contract][wallet].address : t.Wallets[wallet].address
        const k = contract ? "contract" : "wallet"
        const v = contract ? contract.toLowerCase() : wallet

        const balanceHDN = await t.Contracts.Token[wallet].balanceOf(target)
        const balanceWETH = await t.TokenContracts.WETH[wallet].balanceOf(target)
        t.log.info(message, { [k]: v, HDN: balanceHDN, WETH: balanceWETH, args })
    }
}

class Hacks {
    static Delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}