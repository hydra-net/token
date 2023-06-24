import { Logger, ILogObj } from "tslog"
import { HardhatRuntimeEnvironment } from "hardhat/types"

import { Log } from "./log"
import { Wallet, LoadWallets } from "./wallets"
import { Contract, ContractTransaction } from "ethers"

interface Roles {
    ADMIN_ROLE: string
    UPGRADER_ROLE: string
    PAUSER_ROLE: string
}

interface RbacMethods {
    DEFAULT_ADMIN_ROLE(): Promise<string>
    UPGRADER_ROLE(): Promise<string>
    PAUSER_ROLE(): Promise<string>

    grantRole(role: string, account: string): Promise<ContractTransaction>
    revokeRole(role: string, account: string): Promise<ContractTransaction>
}

export type RbacContract = Contract & RbacMethods

export class RBAC<C extends RbacContract = RbacContract> {
    hre: HardhatRuntimeEnvironment;
    log: Logger<ILogObj>
    constructor(hre: HardhatRuntimeEnvironment, log?: Logger<ILogObj>) {
        this.hre = hre
        this.log = Log.WithName("rbac", log)
    }

    async roles(contract: C): Promise<Roles> {
        return {
            ADMIN_ROLE: await contract.DEFAULT_ADMIN_ROLE(),
            UPGRADER_ROLE: await contract.UPGRADER_ROLE(),
            PAUSER_ROLE: await contract.PAUSER_ROLE()
        }
    }

    async configure_admin(contract: C): Promise<void> {
        const hre = this.hre
        const log = this.log
        const {deployer, admin, upgrader} = (await LoadWallets(hre)).Wallets

        if (deployer.address === upgrader.address) {
            log.info(`No UPGRADER configured, using deployer`)
        }
        if (deployer.address === admin.address) {
            log.info(`No ADMIN configured, using deployer`)
        }
        await this.tx(async () => {
            const {ADMIN_ROLE, UPGRADER_ROLE, PAUSER_ROLE} = await this.roles(contract)
            await this.grantRole(contract, ADMIN_ROLE, admin)
            await this.grantRole(contract, PAUSER_ROLE, admin)
            await this.grantRole(contract, UPGRADER_ROLE, admin)
            if (deployer.address !== upgrader.address) {
                if (await this.revokeRole(contract, UPGRADER_ROLE, deployer)) {
                    log.info("Renounced UPGRADER role from deployer")
                }
            }
            if (deployer.address !== admin.address) {
                if (await this.revokeRole(contract, PAUSER_ROLE, deployer)) {
                    log.info("Renounced PAUSER role from deployer")
                }
                if (await this.revokeRole(contract, ADMIN_ROLE, deployer)) {
                    log.info("Renounced ADMIN role from deployer")
                }
            }
        })
    }

    async grantRole(contract: Contract, role: string, wallet: Wallet): Promise<boolean> {
        if (!await contract.hasRole(role, wallet.name)) {
            await contract.grantRole(role, wallet.name)
            this.log.info(`Granted ${role} to ${wallet.name}`, {[wallet.name]: wallet.address})
            return true
        }
        return false
    }

    async revokeRole(contract: Contract, role: string, wallet: Wallet): Promise<boolean> {
        if (await contract.hasRole(role, wallet.address)) {
            await contract.revokeRole(role, wallet.address)
            this.log.info(`Revoked ${role} from ${wallet.name}`, {[wallet.name]: wallet.address})
            return true
        }
        return false
    }

    async tx(fn: () => Promise<any>) {
        const log = this.log
        try {
            await fn.call(this)
        } catch (error: any) {
            if (!error.reason || !(error.reason as string).includes("AccessControl")) {
                // Re-throw if not AccessControl error
                throw error
            }
            log.info(`Deployer doesn't have permission to configure RBAC. Manually check if roles are correctly configured.`)
        }
    }
}
