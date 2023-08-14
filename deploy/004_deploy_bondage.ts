import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { ethers } from "ethers"

import { Log } from "../tools/et/log"
import { LoadWallets } from "../tools/et/wallets"
import { Deploy } from "../tools/et/deploy"
import { Deployments } from "../tools/et/deployments"
import { RBAC } from "../tools/et/rbac"

import { contracts as Contracts } from "../typechain-types"

const ContractName = "Bondage"

const df: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const log = Log.WithName(ContractName, Log.WithName("deploy"))
    const deploy = new Deploy<Contracts.Bondage>(hre, log, true)
    const deployments = new Deployments(hre, log)
    const {deployer, admin} = ((await LoadWallets(hre, log)).Wallets)

    // Dependencies
    const TokenDeployment = await deployments.get("Token")
    if (!TokenDeployment) {
        throw new Error("Token contract deployment not found")
    }
    const TreasuryDeployment = await deployments.get("Treasury")
    if (!TreasuryDeployment) {
        throw new Error("Treasury contract deployment not found")
    }

    // Config
    const token = TokenDeployment.proxy.address
    const treasury = TreasuryDeployment.proxy.address

    // Deploy
    const args = [
        ethers.utils.getAddress(token),     // _token
        ethers.utils.getAddress(treasury),  // _treasury
    ]
    const Deployment = await deploy.Upgradable(ContractName, args)
    if (!Deployment.contractChanged) {
        return
    }

    // Connect
    log.info(`Contract changed, running deployment script`)
    const Contract = await Deployment.connect(deployer)

    // RBAC: Ensure correct permissions
    const rbac = new RBAC<Contracts.Bondage>(hre, log)
    log.info("Configuring RBAC for BONDS_MANAGER")
    rbac.tx(async () => {
        rbac.tx(async () => {
            await rbac.grantRole(Contract, await Contract.MANAGER_ROLE(), admin)
            await rbac.grantRole(Contract, await Contract.OPERATOR_ROLE(), admin)
        })
    })
    log.info("Configured RBAC for BONDS_MANAGER")

    // Add to reserved accounts in Info Contract
    const InfoDeployment = await deployments.get("Info")
    if (!InfoDeployment) {
        log.warn("Info contract deployment not found, manually add bondage contract to reserved accounts")
        return
    }
    const Info = await InfoDeployment.connect<Contracts.Info>(deployer)
    log.info("Adding bondage contract to reserved accounts")
    await Info.addReservedAccount(Contract.address);
    log.info("Successfully added bondage contract to reserved accounts")
}

df.dependencies = ["token", "treasury", "info"]
df.tags = ["Bondage.sol", "Bondage", "bondage", "bonds"]

export default df
