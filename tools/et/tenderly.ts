import fs from "fs"
import os from "os"
import path from "path"
import process from "process"
import * as axios from "axios"
import * as yaml from "yaml"
import { BigNumber, ethers, providers, Signer } from "ethers"
import { TransactionRequest, TransactionResponse } from "@ethersproject/abstract-provider"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { ExtendedArtifact } from "hardhat-deploy/types"
import { TenderlyPlugin } from "@tenderly/hardhat-tenderly/dist/type-extensions"
import { ContractByName } from "@tenderly/hardhat-tenderly/dist/tenderly/types"
import { TenderlyContract, TenderlyContractConfig } from "tenderly/types"
import { Logger, ILogObj } from "tslog";
import { Deferrable, hexlify } from "ethers/lib/utils"


export const TENDERLY_API_BASE_URL = "https://api.tenderly.co";
export const TENDERLY_DASHBOARD_BASE_URL = "https://dashboard.tenderly.co";
export const TENDERLY_RPC_BASE = "https://rpc.tenderly.co";
export const HEADERS = {
    ACCESS_KEY: "X-Access-Key"
}

export function isTenderly(hre: HardhatRuntimeEnvironment): boolean {
    return hre.network.name.includes("tenderly")
}

export function isTenderlyFork(hre: HardhatRuntimeEnvironment): boolean {
    return isTenderly(hre) && NewTenderly(hre).getForkId() !== undefined
}

export function NewTenderly(hre: HardhatRuntimeEnvironment, logger?: Logger<ILogObj>, cfg?: Config): Tenderly {
    return new Tenderly(hre, logger, cfg)
}

export class Tenderly {
    static IsTenderly = isTenderly
    static IsTenderlyFork = isTenderlyFork
    
    public hre: HardhatRuntimeEnvironment
    private log: Logger<ILogObj>
    private cfg: Config = new EnvConfig("TENDERLY_", {
        GAS_LIMIT: "1200000",
        GAS_PRICE: "50000000000",
    })

    public axios = {
        Api: (): axios.AxiosInstance => {
            const cfg = this.getConfig()
            return axios.default.create({
                baseURL: `${TENDERLY_API_BASE_URL}/api/v1/account/${cfg.username}/project/${cfg.project}`,
                headers: { [HEADERS.ACCESS_KEY]: cfg.access_key }
            })
        },
        Rpc: (): axios.AxiosInstance => {
            const cfg = this.getConfig()
            return axios.default.create({
                baseURL: TENDERLY_RPC_BASE,
                headers: {
                    [HEADERS.ACCESS_KEY]: cfg.access_key,
                    Head: cfg.head !== undefined ? cfg.head : ""
                }
            })
        }
    }

    public constructor(hre: HardhatRuntimeEnvironment, logger?: Logger<ILogObj>, cfg?: Config) {
        this.hre = hre;
        this.log = logger ? logger : new Logger<ILogObj>()
        this.cfg = cfg ?? this.cfg
    }

    public async run(fn: (tenderly: TenderlyPlugin) => Promise<void>): Promise<void> {
        if (!isTenderly(this.hre)) {
            return
        }
        await fn.call(this, this.hre.tenderly)
    }

    public async advanceTime(seconds: number | BigNumber): Promise<void> {
        await this.run(async () => {
            const res = await this.hre.ethers.provider.send("evm_increaseTime", [
                this.hre.ethers.utils.hexValue(seconds),
            ])
            this.log.info(`Advancing Blocktime on tenderly fork by ${seconds} seconds: ${res}`)
        })
    }

    public async setBalance(balance: bigint, addresses: string[]): Promise<void> {
        await this.run(async () => {
            const res = await this.hre.ethers.provider.send("tenderly_setBalance", [
                addresses,
                this.hre.ethers.utils.hexValue(balance),
            ])
            const balanceETH = this.hre.ethers.utils.formatUnits(balance, 18)
            this.log.info(`Setting balance to ${balanceETH} ETH using tenderly fork API: ${res}`)
        })
    }

    public async setStorageAt(contract: ContractByName, slot: bigint | number, key: string, value: bigint | number | string): Promise<void> {
        await this.run(async () => {
            const index = this.hre.ethers.utils.solidityKeccak256(
                ["uint256", "uint256"],
                [key, slot] // key, slot
            );
            const res = await this.hre.ethers.provider.send("tenderly_setStorageAt", [
                contract.address,
                index,
                this.hre.ethers.utils.hexZeroPad(this.hre.ethers.utils.hexValue(value), 32),
            ])
            this.log.info(`Setting storage variable in contract ${contract.name} (address: ${contract.address}) at slot ${slot} to ${value} using tenderly fork API: ${res}`)
        })
    }

    public async verify(contractNames: string[], extraArtifacts?: Map<string, ExtendedArtifact>, tag?: string): Promise<void> {
        if (contractNames.length == 0) {
            throw "no contract names given"
        }
        await this.run(async (tenderly) => {
            const project = this.hre.config.tenderly.project
            const username = this.hre.config.tenderly.username
            const fork = await this.getForkId()
            const contracts = await this.extractContracts(contractNames, extraArtifacts)

            if (contracts.length == 0) {
                throw "no contract metadata could be extracted from Hardhat Runtime Environment (hre)"
            }

            if (fork !== undefined) {
                await tenderly.verifyForkAPI({
                    config: contracts[0].config,
                    contracts: contracts,
                    tag: tag,
                    root: "",
                },
                    project, username, fork)
            } else {
                await tenderly.verifyAPI({
                    config: contracts[0].config,
                    contracts: contracts,
                    tag: tag,
                })
            }
        })
    }

    public async extractContracts(contractNames: string[], extraArtifacts?: Map<string, ExtendedArtifact>): Promise<TenderlyContractEx[]> {
        const tenderlyContracts: TenderlyContractEx[] = []
        for (let i = 0; i < contractNames.length; i++) {
            const contract = contractNames[i];
            let artifactEx
            // artifactEx = await this.hre.deployments.getExtendedArtifact(contract)
            if (extraArtifacts?.has(contract)) {
                artifactEx = extraArtifacts.get(contract) as ExtendedArtifact
            } else {
                artifactEx = await this.hre.deployments.getExtendedArtifact(contract)
            }
            const metadata = JSON.parse(artifactEx.metadata as string) as ContractMetadata

            for (const [key, value] of Object.entries(metadata.sources)) {
                const cn = metadata.settings.compilationTarget[key]
                tenderlyContracts.push({
                    contractName: (() => {
                        if (cn && (value.content as string).includes(`contract ${cn}`)) {
                            return cn
                        }
                        // TODO: Extract correct contract name for non-compilation target as well
                        return key.split("/").slice(-1)[0].split(".")[0]
                    })(),
                    networks: await (async () => {
                        if (!cn) {
                            return undefined
                        }
                        const deployment = await this.hre.deployments.get(cn)
                        if (!deployment || !deployment.address) {
                            return undefined
                        }
                        const fork = await this.getForkId()
                        const netKey = fork ? fork : this.hre.network.config.chainId
                        if (!netKey) {
                            throw "unable to determine tenderly fork or network chain ID"
                        }
                        return {
                            [netKey]: {
                                address: deployment.address
                            }
                        }
                    })(),
                    sourcePath: key,
                    source: value.content,
                    config: {
                        compiler_version: metadata.compiler.version,
                        evm_version: metadata.settings.evmVersion,
                        optimizations_used: metadata.settings.optimizer.enabled,
                        optimizations_count: metadata.settings.optimizer.runs,
                    }
                })
            }
        }
        return tenderlyContracts
    }

    public simulationSigner(signer: Signer): Signer {
        if (!isTenderly(this.hre)) {
            return signer
        }
        return new TenderlySimulationSigner(this, signer)
    }

    public forkManager(): TenderlyForkManager {
        return new TenderlyForkManager(this)
    }

    public disableGasEstimation<P extends providers.Provider>(provider: P): P {
        // const newProvider = Object.assign({}, provider)
        provider.estimateGas = async () => { return Promise.resolve(BigNumber.from(hexlify(this.cfg.get("GAS_LIMIT")))) }
        provider.getGasPrice = async () => { return Promise.resolve(BigNumber.from(hexlify(this.cfg.get("GAS_PRICE")))) }
        return provider
    }

    public async getForkId(): Promise<string | undefined> {
        try {
            return await this.hre.tenderly.network().getForkID()
        } catch (error) {
            this.log.info(`Unable to determine tenderly fork. Not a fork? Not using 'tenderly' network? Error: ${error}`)
            return undefined
        }
    }

    public getConfig(): TenderlyConfig {
        let cfg: TenderlyConfig
        // ~/.tenderly/config.yaml
        const filepath = path.join(os.homedir(), ".tenderly", "config.yaml");
        try {
            cfg = yaml.parse(fs.readFileSync(filepath).toString())

        } catch (error) {
            const err = error as Error
            err.message = `error parsing tenderly config.yaml (path: ${filepath}): ${err.message}`
            throw err
        }
        if (cfg.access_key == null) {
            throw `Access token not provided at filepath ${filepath}.\n` +
            `You can find the token at ${TENDERLY_DASHBOARD_BASE_URL}/account/authorization`
        }
        // $cwd/tenderly.yaml
        const filepath2 = path.join(process.cwd(), "tenderly.yaml")
        let cfg2: TenderlyConfig
        try {
            cfg2 = yaml.parse(fs.readFileSync(filepath2).toString())

        } catch (error) {
            const err = error as Error
            err.message = `error parsing tenderly.yaml (path: ${filepath2}): ${err.message}`
            throw err
        }
        if (cfg2.account_id && cfg.account_id && cfg.account_id !== cfg2.account_id) {
            throw `Account Id mismatch between tenderly configs.
            ${filepath}: account_id=${cfg.account_id}
            ${filepath2}: account_id=${cfg2.account_id}`
        }
        if (cfg2.project_slug) {
            const projectSlug = cfg2.project_slug.split("/")
            if (projectSlug.length != 2) {
                throw "Invalid project slug specified in tenderly.yaml"
            }
            cfg.username = projectSlug[0]
            cfg.project = projectSlug[1]
        }
        return cfg
    }

    // Utils
    static ETH(amount: number): bigint {
        const wei = "000000000000000000"
        return BigInt(String(amount) + wei)
    }
}

export class TenderlySimulationSigner extends Signer {
    private readonly signer: Signer
    private readonly tenderly: Tenderly

    constructor(tenderly: Tenderly, signer: Signer) {
        super()
        this.signer = signer
        this.tenderly = tenderly
    }

    async simulateTx(transaction: Deferrable<TransactionRequest>): Promise<void> {
        const resp = await this.tenderly.axios.Api().post("/simulate", {
            "network_id": transaction.chainId,
            "from": transaction.from,
            "to": transaction.to,
            "input": transaction.data,
            "gas": transaction.gasLimit,
            "gas_price": transaction.gasPrice,
            "value": transaction.value,
            "save": true,
            "save_if_fails": true,
        });
        if (resp.data.simulation.status == false) {
            throw `Simulation failed for transaction: ${transaction}`
        }

        console.log(resp)
    }

    async sendTransaction(transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
        await this.simulateTx(transaction)
        return await this.signer.sendTransaction(transaction);
    }

    getAddress(): Promise<string> {
        return this.signer.getAddress();
    }
    signMessage(message: string | ethers.utils.Bytes): Promise<string> {
        return this.signer.signMessage(message)
    }
    signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
        return this.signer.signTransaction(transaction)
    }
    connect(provider: ethers.providers.Provider): ethers.Signer {
        return this.signer.connect(provider)
    }
}

export class TenderlyForkManager {
    static readonly API_SUBPATH = "/fork"
    public readonly API_SUBPATH = TenderlyForkManager.API_SUBPATH

    private readonly tenderly: Tenderly
    constructor(tenderly: Tenderly) {
        this.tenderly = tenderly
    }

    async newFork(chainId: number): Promise<{forkId: string, forkedChainId: number}> {
        const hdn = 44366 // "HDN" in oldschool mobile. If you don't know, you are too young :P
        const forkedChainId = chainId + hdn
        const blockNumber = await this.tenderly.hre.ethers.provider.getBlockNumber()
        const resp = await this.tenderly.axios.Api().post(this.API_SUBPATH, {
            "network_id": chainId,
            "block_number": blockNumber,
            "chain_config": {
              "chain_id": forkedChainId
            }
        }).catch((err) => {
            throw `Error creating tenderly fork: ${JSON.stringify(err.response?.data?.error ?? err)}`
        })

        const forkId = resp.data.simulation_fork?.id
        return {forkId: forkId ?? JSON.stringify(resp.data), forkedChainId}
    }
}

class EnvConfig implements Config {
    private prefix: string
    private cfg: Record<string, string>

    constructor(prefix: string, defaults: Record<string, string>) {
        this.prefix = prefix
        this.cfg = JSON.parse(JSON.stringify(defaults))
        for (const [key, val] of Object.entries(process.env)) {
            if (val === undefined) {
                continue
            }
            if (!key.startsWith(this.prefix)) {
                continue
            }
            this.cfg[key.substring(this.prefix.length)] = val
        }
    }

    public get(key: string): string {
        const val = this.cfg[key]
        if (val === undefined) {
            throw `Unknown config key: ${key}`
        }
        return val
    }
}

interface Config {
    get(key: string): string
}

// class NoGasProvider extends providers.BaseProvider {
//     private static ENV_PREFIX = "TENDERLY_"
//     private CONFIG: Record<string, string> = {
//         GAS_LIMIT: "1200000",
//         GAS_PRICE: "50000000000",
//     }
//     constructor() {
//         super()
//     }
//     async estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
//         return Promise.resolve(BigNumber.from(hexlify(this.CONFIG.GAS_LIMIT)))
//     }

//     async getGasPrice(): Promise<BigNumber> {
//         return Promise.resolve(BigNumber.from(hexlify(this.CONFIG.GAS_PRICE)))
//     }

//     private _resolve(key: string): string {
//         const val = this.CONFIG[key]
//         if (val === undefined) {
//             throw `Unknown ENV key: ${key}`
//         }
//         return process.env[NoGasProvider.ENV_PREFIX + key] ?? val
//     }
// }


interface ContractMetadata {
    language: string
    compiler: {
        version: string
    }
    settings: {
        evmVersion: string
        optimizer: {
            enabled: boolean
            runs: number
        }
        compilationTarget: Record<string, string>
    }
    sources: Map<string, {
        content: string
    }>
}

interface TenderlyContractEx extends TenderlyContract {
    config: TenderlyContractConfig
}

interface TenderlyConfig {
    account_id: string
    access_key: string
    access_key_id?: string
    email?: string
    head?: string
    token?: string
    username?: string
    project?: string
    project_slug?: string
}
