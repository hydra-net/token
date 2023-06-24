import { Logger, ILogObj } from "tslog"
import { ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet as EthersWallet, } from "ethers"
import { Provider } from "@ethersproject/providers"
import { Log } from "./log"


export function CreateRandomWallet(name: string, provider?: Provider): ActiveWallet {
    type TempWallet = EthersWallet & { name?: string }
    let wallet: TempWallet & { name?: string } = ethers.Wallet.createRandom()
    if (provider) {
        wallet = wallet.connect(provider)
    }
    wallet.name = name
    return wallet as ActiveWallet
}

export async function LoadWallets(hre: HardhatRuntimeEnvironment, logger?: Logger<ILogObj>): Promise<SmartWallets> {
    const log = logger ?? Log.WithLogLevel(Log.Level.Info)
    const { ethers, deployments } = hre

    // Deployer always from hardhat
    let hh_deployer: SignerWithAddress & { name?: string }
    [hh_deployer] = await ethers.getSigners()

    const deployer = hh_deployer as ActiveWallet

    // Use ADMIN and/or UPGRADE MultiSig if available on current chain
    const upgradesMultiSig = await deployments.getOrNull("External-MultiSig-Upgrades")
    const adminMultiSig = await deployments.getOrNull("External-MultiSig-Admin")
    let admin: Wallet = deployer
    if (adminMultiSig?.address) {
        admin = { address: adminMultiSig.address } as ExternalWallet
        admin.name = "admin"
        log.debug(`Using ADMIN MultiSig: ${admin.address}`)
    }
    let upgrader: Wallet = admin
    if (upgradesMultiSig?.address) {
        upgrader = { address: upgradesMultiSig.address } as ExternalWallet
        upgrader.name = "upgrader"
        log.debug(`Using UPGRADE MultiSig: ${upgrader.address}`)
    }

    const wallets: Wallets = { deployer, admin, upgrader }
    return new SmartWallets(wallets)
}

export function LogWalletConfig(log: Logger<ILogObj>, wallets: Wallets) {
    switch(wallets.admin.address) {
        case wallets.deployer.address: {log.info("Using deployer as ADMIN", { address: wallets.admin.address }); break}
        default: {log.info("Using ADMIN MultiSig as ADMIN", { address: wallets.admin.address }); break}
    }
    switch(wallets.upgrader.address) {
        case wallets.deployer.address: {log.info("Using deployer as UPGRADER", { address: wallets.upgrader.address }); break}
        case wallets.admin.address: {log.info("Using ADMIN MultiSig as UPGRADER", { address: wallets.upgrader.address }); break}
        default: {log.info("Using UPGRADER MultiSig as UPGRADER", { address: wallets.upgrader.address }); break}
    }
}

export function UniqueWallets<W extends AbstractWallet = Wallet>(wallets: Record<string, W>): Record<string, W> {
    const addresses = new Set<string>();
    const unique: Record<string, W> = {}
    for (const [key, wallet] of Object.entries(wallets)) {
        if (addresses.has(wallet.address)) {
            continue
        }
        addresses.add(wallet.address)
        unique[key] = wallet
    }
    return unique
}

export class SmartWallets {
    Wallets: Wallets
    constructor(wallets: Wallets) {
        this.Wallets = wallets
    }

    ActiveWallets(): ActiveWallets {
        const w: ActiveWallets = {}
        for (const [name, wallet] of Object.entries(this.Wallets)) {
            const aw = wallet as ActiveWallet
            if (aw.connect !== undefined) {
                w[name] = aw
            }
        }
        return w
    }
    ExternalWallets(): ExternalWallets {
        const w: ExternalWallets = {}
        for (const [name, wallet] of Object.entries(this.Wallets)) {
            const ew = wallet as ActiveWallet
            if (ew.connect === undefined) {
                w[name] = ew
            }
        }
        return w
    }
}
export interface Wallets extends Record<string, Wallet> {
    deployer: ActiveWallet
    admin: Wallet
    upgrader: Wallet
}
export interface ExternalWallet extends AbstractWallet { }

export interface AbstractWallet {
    name: string
    address: string
}


export type Wallet = ActiveWallet | ExternalWallet
export type ActiveWallet = (EthersWallet | SignerWithAddress) & AbstractWallet
export type ActiveWallets = Record<string, ActiveWallet>
export type ExternalWallets = Record<string, ExternalWallet>