import hre from "hardhat"
import { Tenderly } from "../tools/et/tenderly";
import { Log } from "../tools/et/log";

async function main() {
  const log = Log.WithName("tenderly-fork")
  const tenderly = new Tenderly(hre)
  const tfm = tenderly.forkManager()

  const chainId = parseInt(await hre.getChainId())
  log.info(`Forking chain ${chainId}`)
  const {forkId, forkedChainId} = await tfm.newFork(chainId)
  log.info(`Tenderly ForkId: ${forkId}`)
  log.info(`Forked ChainId: ${forkedChainId}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
