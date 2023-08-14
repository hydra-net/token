import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { ethers } from "ethers"

import { Log } from "../tools/et/log"
import { LoadWallets } from "../tools/et/wallets"
import { Deploy } from "../tools/et/deploy"
import { Deployments } from "../tools/et/deployments"
import { RBAC } from "../tools/et/rbac"

import { contracts as Contracts } from "../typechain-types"

const ContractName = "Info"

const df: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const log = Log.WithName(ContractName, Log.WithName("deploy"))
    const deploy = new Deploy<Contracts.Info>(hre, log, true)
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
}

df.dependencies = ["token", "treasury"]
df.tags = ["Info.sol", "Info", "info"]

export default df
