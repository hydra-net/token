import { Logger, ILogObj } from "tslog"
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BigNumber } from "ethers";

export class Hardhat {
    static IsHardhat(hre: HardhatRuntimeEnvironment): boolean {
        return (hre.network.name == "hardhat")
    }

    hre: HardhatRuntimeEnvironment;
    log: Logger<ILogObj>

    constructor(hre: HardhatRuntimeEnvironment, log?: Logger<ILogObj>) {
        this.hre = hre
        this.log = log ?? new Logger<ILogObj>()
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