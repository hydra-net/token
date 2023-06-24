import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

import { Log } from "../tools/et/log"
import { LoadWallets } from "../tools/et/wallets"
import { Deploy } from "../tools/et/deploy"
import { RBAC } from "../tools/et/rbac"

import { contracts as Contracts } from "../typechain-types"

const ContractName = "Treasury"

const df: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const log = Log.WithName(ContractName, Log.WithName("deploy"))
    const deploy = new Deploy<Contracts.Treasury>(hre, log, true)
    const {deployer, admin} = ((await LoadWallets(hre, log)).Wallets)

    // Deploy
    const Deployment = await deploy.Upgradable(ContractName, [])
    if (!Deployment.contractChanged) {
        return
    }

    // Connect
    log.info(`Contract changed, running deployment script`)
    const Contract = await Deployment.connect(deployer)

    // RBAC: Ensure correct permissions
    const rbac = new RBAC<Contracts.Treasury>(hre, log)
    log.info("Configuring RBAC for TREASURY")
    rbac.tx(async () => {
        await rbac.grantRole(Contract, await Contract.MANAGER_ROLE(), admin)
        await rbac.grantRole(Contract, await Contract.OPERATOR_ROLE(), admin)
    })
    log.info("Configured RBAC for TREASURY")
}

df.tags = ["Treasury.sol", "Treasury", "treasury"]

export default df
