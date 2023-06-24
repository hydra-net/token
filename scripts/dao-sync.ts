import fs from "fs"
import * as yaml from "yaml"
import { deployments, network } from "hardhat"

const DAO_CFG_FILEPATH = "dao.yaml"

interface DaoConfig {
    multisigs: DaoMultiSig[]
}

interface DaoMultiSig {
    key: string
    accounts: DaoMultiSigAccount[]
    org: string
    team: string
}

interface DaoMultiSigAccount {
    chainId: number
    address: string
    type: string
}

async function main() {
  const dao: DaoConfig = yaml.parse(fs.readFileSync(DAO_CFG_FILEPATH).toString())
  const chainId = network.config.chainId
  for (var multisig of dao.multisigs) {
    for (var acc of multisig.accounts) {
        if (acc.chainId !== chainId) {
            continue
        }
        let addr = (await deployments.getOrNull(multisig.key))?.address
        switch (addr) {
            case acc.address:
                console.log(`${multisig.key} already up to date for chain with ID ${acc.chainId}: ${acc.address}`)
                continue
            case undefined:
                await deployments.save(multisig.key, {address: acc.address, abi: []})
                console.log(`Synced address for previously unknown MultiSig '${multisig.key}' on chain with ID ${acc.chainId}: ${acc.address}`)
                continue
            default:
                await deployments.save(multisig.key, {address: acc.address, abi: []})
                console.log(`Synced new address for known MultiSig '${multisig.key}' on chain with ID ${acc.chainId}: ${acc.address}`)
                continue
        }
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
