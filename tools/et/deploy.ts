import { Logger, ILogObj } from "tslog"
import { HardhatRuntimeEnvironment } from "hardhat/types"

import { Log } from "./log"
import { ProxiedContractDeployment } from "./contract"
import { LoadWallets, LogWalletConfig, Wallets } from "./wallets"
import { Hardhat } from "./hardhat"
import { Tenderly } from "./tenderly"
import { Deployments } from "./deployments"
import { RBAC, RbacContract } from "./rbac"
import { Contract } from "ethers"


export class Deploy<C extends Contract = Contract> {
    hre: HardhatRuntimeEnvironment;
    log: Logger<ILogObj>
    autoVerify: boolean

    constructor(hre: HardhatRuntimeEnvironment, log?: Logger<ILogObj>, autoVerify: boolean = true) {
        this.hre = hre
        this.log = Log.WithName("deploy", log)
        this.autoVerify = autoVerify
    }

    async Upgradable<T extends Contract = C>(contract: string, contractArgs?: unknown[], verify?: boolean): Promise<ProxiedContractDeployment<T>> {
        const log = Log.WithName(contract, this.log)
        if (verify === undefined) {
            verify = this.autoVerify
        }

        // Configure wallets
        const wallets = (await LoadWallets(this.hre, log)).Wallets
        LogWalletConfig(log, wallets)

        // Deploy
        const deployed = await deployWithProxy(this.hre, this.log, wallets, contract, contractArgs) as ProxiedContractDeployment<T>

        if (deployed.contractChanged) {

            // Connect
            log.info("Contract changed, running deployment script")
            const Contract = await deployed.connect(wallets.deployer) as T

            // RBAC: Ensure correct permissions
            if ((Contract as unknown as RbacContract).DEFAULT_ADMIN_ROLE !== undefined) {
                log.info("Contract supports RBAC interface, configuring admin permissions")
                const rbac = new RBAC(this.hre, log)
                rbac.configure_admin(Contract as unknown as RbacContract)
                log.info("Finished configuring RBAC")
            }
        }

        // Return deployed & configured contract
        return deployed
    }
}

async function deployWithProxy(hre: HardhatRuntimeEnvironment, log: Logger<ILogObj>, wallets: Wallets, contract: string, contractArgs?: unknown[]): Promise<ProxiedContractDeployment> {
    const deployments = await new Deployments(hre, log)
    const tenderly = await new Tenderly(hre, log)
    const { ethers, upgrades, defender, artifacts } = hre
    const { deployer, admin, upgrader } = wallets

    // Set deployer balance if on tenderly
    await tenderly.setBalance(BigInt("100000000000000000000"), [deployer.address])

    const contractName = contract
    const contractFactory = await ethers.getContractFactory(contractName)
    let deployment = await deployments.get(contractName)

    if (!deployment) {
        // Contracts not deployed yet -> NEW deployment
        // CONVENTION: First argument is always admin address to configure RBAC on initialization
        let args: unknown[] = [ethers.utils.getAddress(admin.address)]
        if (contractArgs) {
            args = [...args, ...contractArgs]
        }
        const proxy = await upgrades.deployProxy(contractFactory, args, { kind: 'uups' })

        // Store deployment
        deployment = await deployments.create(contractName, proxy.address)
        deployment.contractChanged = true
        log.info(`Implementation deployed to ${deployment.implementation.address}`)
        log.info(`Proxy deployed to ${deployment.proxy.address}`)
    } else {
        // Contracts already deployed -> UPGRADE deployment
        // Resolve upgrade proposal if it exists and was executed in the meantime
        if (await deployments.hasActiveProposal(contractName)) {
            const upgraded = await deployments.resolveProposal(contractName)
            if (!upgraded) {
                log.info("Contract has an active, pending upgrade proposal. Please execute or reject the upgrade before deploying again.")
                return deployment
            }
            log.info(`Resolved completed upgrade. New Implementation: ${deployment.implementation.address}`)
            deployment = upgraded
            deployment.contractChanged = true
        }


        // Only upgrade if contract has changed
        const compiledContract = await artifacts.readArtifact(contractName)
        if (compiledContract.bytecode === deployment.implementation.bytecode) {
            log.info(`No changes detected`)
            return deployment
        }
        deployment.contractChanged = true

        // Attempt direct upgrade with current deployer wallet
        try {
            await upgrades.upgradeProxy(deployment.proxy.address, contractFactory)
            deployment = await deployments.refreshImplementation(deployment)
            log.info(`New Implementation deployed to ${deployment.implementation.address}`)
            log.info(`Proxy at ${deployment.proxy.address} updated to new implementation`)
            await verify(hre, deployment.implementation.address)
            await verify(hre, deployment.proxy.address)
        } catch (error: any) {
            // NO PERMISSION for direct upgrade -> propose upgrade via OZ DEFENDER
            if (!error.reason || !(error.reason as string).includes("AccessControl")) {
                // Re-throw if not AccessControl error
                throw error
            }
            log.info(`Deployer doesn't have permission for direct upgrade.`)
            log.info(`Proposing upgrade via OpenZeppelin Defender`)
            const proposal = await defender.proposeUpgrade(deployment.proxy.address, contractFactory, { title: `Upgrade Contract: ${contractName}`, multisig: upgrader.address })
            if (proposal.metadata?.newImplementationAddress) {
                log.info(`New implementation deployed to: ${proposal.metadata.newImplementationAddress}`)
            }
            log.info(`Upgrade proposal created at: ${proposal.url}`)

            // Save Upgrade Proposal in temporary deployment -> resolve before next deploy for same contract
            if (!proposal.metadata?.newImplementationAddress) {
                throw new error("Error determining new implementation address of OZ Defender proposal. Don't forget to manually update the hardhat deployment store after executing the upgrade.")
            }
            deployment = await deployments.refreshImplementation(deployment, proposal.metadata.newImplementationAddress)
            deployments.newProposal(deployment)
            deployment.contractChanged = false
            await verify(hre, deployment.implementation.address)
            return deployment
        }
    }

    // Verify contracts on tenderly (if on tenderly network)
    // await tenderly(hre, log).verify([contractName, proxyName], new Map<string,ExtendedArtifact>([[proxyName, ERC1967Proxy]]))
    await tenderly.verify([contractName])
    await verify(hre, deployment.proxy.address)
    return deployment
}

// Verify if contract changed and enabled
async function verify(hre: HardhatRuntimeEnvironment, address: string): Promise<any> {
    let verify: boolean
    switch (process.env.ET_AUTO_VERIFY) {
        case "true": verify = true; break
        case "false": verify = false; break
        default: {
            const stage = process.env.ET_STAGE?.toLowerCase()
            if (!stage || Tenderly.IsTenderly(hre) || Hardhat.IsHardhat(hre)) {
                verify = false; break
            }
            verify = stage === "dev"; break
        }
    }
    if (verify) {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: []
        })
    }
}

// NOTES
// https://github.com/wighawag/hardhat-deploy/issues/242#issuecomment-998790266
// https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/449
// https://ethereum.stackexchange.com/questions/103530/how-to-get-implementation-address-after-deployproxy-open-zepplin-hardhat-up
// https://forum.openzeppelin.com/t/integrating-hardhat-deploy-and-openzeppelin-hardhat-upgrades/5585/4
// https://ethereum.stackexchange.com/questions/101535/using-hardhat-deploy-plugin-for-deploying-openzeppelin-upgradable-contracts
