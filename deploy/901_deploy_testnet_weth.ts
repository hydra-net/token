import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { Log } from "../tools/et/log"
import { LoadWallets } from "../tools/et/wallets"
import { Deploy } from "../tools/et/deploy"

import { contracts as Contracts } from "../typechain-types"

const ContractName = "TwistedWETH"

const df: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const log = Log.WithName(ContractName, Log.WithName("deploy"))
    const deploy = new Deploy<Contracts.Token>(hre, log, true)
    const {deployer, admin} = ((await LoadWallets(hre, log)).Wallets)

    // Config
    const treasury = admin.address

    // Deploy
    const Deployment = await deploy.Upgradable(ContractName, [])
    if (!Deployment.contractChanged) {
        return
    }

    // Connect
    log.info(`Contract changed, running deployment script`)
    const Contract = await Deployment.connect(deployer)
}

df.tags = ["TwistedWETH.sol", "testnet"]

export default df
