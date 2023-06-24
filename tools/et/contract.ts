import { ethers } from "hardhat"
import { Deployment } from "hardhat-deploy/dist/types"
import { Contract, Signer } from "ethers"
import { ActiveWallets } from "./wallets"

export class ContractDeployment<C extends Contract = Contract> implements ContractDeployment<C> {
    constructor(init?: Partial<ContractDeployment<C>>) {
        Object.assign(this, init);
    }

    async connect<T extends Contract = C>(signer?: Signer): Promise<T> {
        return (await ethers.getContractAt(this.interface(), this.address(), signer)) as T
    }

    address(): string {
        return this.implementation.address
    }

    interface(): string {
        return this.interfaceOverride ?? this.name
    }
}

export interface ContractDeployment<C extends Contract = Contract> {
    name: string
    implementation: Deployment
    interfaceOverride?: string
    contractChanged?: Boolean
}

export class ProxiedContractDeployment<C extends Contract = Contract> extends ContractDeployment<C> implements ProxiedContractDeployment<C> {
    constructor(init?: Partial<ProxiedContractDeployment<C>>) {
        super(init)
        Object.assign(this, init);
    }

    override address(): string {
        return this.proxy.address
    }

    // override async connect<T extends Contract = C>(signer?: Signer): Promise<T> {
    //     return (await ethers.getContractAt(this.interface(), this.proxy.address, signer)) as T
    // }

}

export interface ProxiedContractDeployment<C extends Contract = Contract> extends ContractDeployment<C> {
    proxy: Deployment
    proxyType?: string
    upgradePending?: Boolean
}

export class ContractInstance<C extends Contract = Contract> {
    [k: string]: C

    constructor(init: Partial<ContractInstance<C>>) {
        Object.assign(this, init);
    }

    static async Connect<C extends Contract = Contract>(deployment: ContractDeployment, wallets: ActiveWallets): Promise<ContractInstance<C>> {
        const instance = new ContractInstance<C>({})
        for (const key in wallets) {
            instance[key] = await deployment.connect<C>(wallets[key])
        }
        return instance
    }
}

export type ConnectedContracts<C extends Contract = Contract> = Record<string, ContractInstance<C>>