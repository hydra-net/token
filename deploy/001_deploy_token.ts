import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { Log } from "../tools/et/log"
import { LoadWallets } from "../tools/et/wallets"
import { Deploy } from "../tools/et/deploy"
import { Deployments } from "../tools/et/deployments"

import { contracts as Contracts } from "../typechain-types"

const ContractName = "Token"

const df: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const log = Log.WithName(ContractName, Log.WithName("deploy"))
    const deploy = new Deploy<Contracts.Token>(hre, log, true)
    const deployments = new Deployments(hre, log)
    const {deployer, admin} = ((await LoadWallets(hre, log)).Wallets)

    // Dependencies
    const TreasuryDeployment = await deployments.get("Treasury")
    if (!TreasuryDeployment) {
        throw new Error("Treasury contract deployment not found")
    }

    // Config
    const treasury = TreasuryDeployment.proxy.address

    // Deploy
    const Deployment = await deploy.Upgradable(ContractName, [treasury])
    if (!Deployment.contractChanged) {
        return
    }

    // Connect
    log.info(`Contract changed, running deployment script`)
    const Contract = await Deployment.connect(deployer)
}

df.dependencies = ["treasury"]
df.tags = ["Token.sol", "Token", "token"]

export default df
