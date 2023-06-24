import { Logger, ILogObj } from "tslog"
import { ethers, deployments as hhdeploy } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ABI } from "hardhat-deploy/types";
import { BigNumber, Contract } from "ethers"
import { Token, Contract as ExternalContract, ChainId, Address } from "./external"
import { ContractDeployment, ContractInstance } from "./contract"
import { Deployments } from "./deployments"
import { Tenderly } from "./tenderly"
import { LoadWallets, CreateRandomWallet, ActiveWallets, ActiveWallet } from "./wallets"

import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

export const CONSTANTS = {
    INFINITE_ALLOWANCE: "0xfe00000000000000000000000000000000000000000000000000000000000000"
}


export async function SetupEnv(hre: HardhatRuntimeEnvironment): Promise<TestEnvironment> {
    const log = new Logger<ILogObj>()
    const wallets = await LoadWallets(hre)
    const activeWallets = wallets.ActiveWallets()
    if (!activeWallets.deployer) {
        throw new Error("No deployer wallet")
    }
    if (!activeWallets.admin) {
        log.warn("No admin wallet, creating ephemeral test wallet. Will not work testnets (only local)")
        activeWallets.admin = CreateRandomWallet("admin", hre.ethers.provider)
    }
    activeWallets.user = CreateRandomWallet("user", hre.ethers.provider)
    return {
        log: log,
        deployments: new Deployments(hre, log),
        tenderly: new Tenderly(hre, log),
        hardhat: new HardhatTools(hre, log),
        utils: new Utils(hre, log),
        Contracts: {},
        TokenContracts: {},
        Wallets: {
            deployer: activeWallets.deployer,
            admin: activeWallets.admin,
            user: activeWallets.user,
        },
    }
}

export async function SetupContracts(hre: HardhatRuntimeEnvironment, t: TestEnvironment,
    contracts: string | string[],
    externalContracts?: Record<string, [string, ExternalContract]>): Promise<TestContracts> {
    if (contracts.length == 0) {
        throw new Error("No contract specified")
    }
    const hhContractDeployments = await hre.deployments.fixture(contracts);
    const deployed = await t.deployments.getFromHardhat(hhContractDeployments)
    const instances = await t.deployments.connect(deployed, t.Wallets)

    // External contracts
    if (!!externalContracts) {
        const chainId = parseInt(await hre.getChainId())
        const edepl: ContractDeployment[] = []
        for (const [name, [iface, contract]] of Object.entries(externalContracts)) {
            const address = contract[chainId]
            if (!address) {
                t.log.warn(`No address for External Contract ${name} on chain ${chainId}`)
                continue
            }
            edepl.push(Utils.ExternalContractDeployment(name, address, iface))
        }
        if (edepl.length > 0) {
            const eint = await t.deployments.connect(edepl, t.Wallets)
            Object.assign(instances, eint)
        }
    }

    return instances
}

export async function SetupTokenContracts(hre: HardhatRuntimeEnvironment, t: TestEnvironment, contracts: Record<string, Token>): Promise<TokenContracts> {
    const chainId = parseInt(await hre.getChainId())
    const deployments: ContractDeployment<IERC20>[] = []
    for (const [name, token] of Object.entries(contracts)) {
        const address = token[chainId]
        if (!address) {
            t.log.warn(`No address for Token ${name} on chain ${chainId}`)
            continue
        }
        deployments.push(Utils.ExternalContractDeployment(name, address, "IERC20"))
    }
    const instances = await t.deployments.connect(deployments, t.Wallets)
    return instances
}

export function Fixtures() {
    interface SetupEnvOptions {
    }
    const SetupEnvFixture = hhdeploy.createFixture(async (hre, opts: SetupEnvOptions | undefined): Promise<TestEnvironment> => {
        return await SetupEnv(hre)
    })

    interface SetupContractsOptions {
        test: TestEnvironment | undefined
        contracts: string | string[]
        externalContracts?: Record<string, [string, ExternalContract]>
    }
    const SetupContractsFixture = hhdeploy.createFixture(async (hre, options: SetupContractsOptions | undefined): Promise<TestContracts> => {
        let contracts = options?.contracts
        if (!contracts || contracts.length == 0) {
            throw new Error("No contract specified")
        }
        const test = options?.test ?? await SetupEnvFixture()
        return await SetupContracts(hre, test, contracts, options?.externalContracts)
    })

    return {
        SetupEnv: SetupEnvFixture,
        SetupContracts: SetupContractsFixture
    }
}

export class TestEnvironment<ContractTypes = TestContracts> {
    constructor(init: TestEnvironment) {
        Object.assign(this, init)
    }
}

export interface TestEnvironment<ContractTypes = TestContracts, TokenContractTypes = TokenContracts> {
    log: Logger<ILogObj>
    deployments: Deployments
    tenderly: Tenderly
    hardhat: HardhatTools
    utils: Utils

    Wallets: TestWallets
    Contracts: ContractTypes
    TokenContracts: TokenContractTypes
}

export interface TestWallets extends ActiveWallets {
    deployer: ActiveWallet,
    admin: ActiveWallet,
    user: ActiveWallet,
}
export type TestContracts = Record<string, ContractInstance<Contract>>
export type TokenContracts = Record<string, ContractInstance<IERC20>>

export class HardhatTools {
    hre: HardhatRuntimeEnvironment;
    log: Logger<ILogObj>

    constructor(hre: HardhatRuntimeEnvironment, log?: Logger<ILogObj>) {
        this.hre = hre
        this.log = log ?? new Logger<ILogObj>()
    }

    isHardhat(): boolean {
        return (this.hre.network.name == "hardhat")
    }

    async setBalance(address: string, balance: BigNumber) {
        const res = await this.hre.ethers.provider.send("hardhat_setBalance", [
            address,
            this.hre.ethers.utils.hexValue(balance),
        ]);
        const balanceETH = this.hre.ethers.utils.formatUnits(balance, 18)
        this.log.info(`Setting balance to ${balanceETH} ETH using hardhat API: ${res}`)
        return res
    }
}

export class Utils {
    static ConnectContract = ethers.getContractAt

    // Abuse our deployment system that was intended for proxied contracts for contracts that we didn't even touch
    static ExternalContractDeployment(name: string, address: string, interfaceOverride?: string): ContractDeployment {
        return new ContractDeployment({
            name: name,
            interfaceOverride: interfaceOverride,
            implementation: {
                address: address,
                abi: {} as ABI,
            }
        })
    }

    static ETH(amount: number) { return ethers.utils.parseEther(amount.toString()) }
    static HexValue = ethers.utils.hexValue

    hre: HardhatRuntimeEnvironment
    log: Logger<ILogObj>
    constructor(hre: HardhatRuntimeEnvironment, log: Logger<ILogObj>) {
        this.hre = hre
        this.log = log
    }

    async CurrentChain(contract: Record<ChainId, Address>): Promise<Address> {
        const chainId = parseInt(await this.hre.getChainId())
        const address = contract[chainId]
        if (!address) {
            this.log.warn(`No address for Token ${name} on chain ${chainId}`)
        }
        return address
    }
}
