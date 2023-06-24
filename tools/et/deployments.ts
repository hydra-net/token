import { Logger, ILogObj } from "tslog"
import { ethers } from "hardhat"
import { HardhatRuntimeEnvironment, HardhatEthersHelpers } from "hardhat/types"
import { Deployment } from "hardhat-deploy/dist/types"
import { ExtendedArtifact } from "hardhat-deploy/types"
import { Contract } from "ethers"
import { ContractInstance, ConnectedContracts, ContractDeployment, ProxiedContractDeployment } from "./contract"
import { ActiveWallets } from "./wallets"

import ERC1967Proxy from "@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json"


const INTERNAL_SUFFIXES: Record<string, string> = {
    UpgradeProposal: "UpgradeProposal",
    ProxyUUPS: "ERC1967Proxy",
    Implementation: "Impl"
}

const TOOLS = {
    ethers: (hh_ethers?: HardhatEthersHelpers): HardhatEthersHelpers => hh_ethers ?? ethers,
    connect: (ethers: HardhatEthersHelpers, name: string, address: string) => ethers.getContractAt.bind(this, name, address)
}

export class Deployments {
    hre: HardhatRuntimeEnvironment;
    log?: Logger<ILogObj>

    constructor(hre: HardhatRuntimeEnvironment, log?: Logger<ILogObj>) {
        this.hre = hre
        this.log = log ?? new Logger<ILogObj>()
    }

    async connect<C extends Contract = Contract>(deployments: ContractDeployment<C>[], wallets: ActiveWallets): Promise<ConnectedContracts<C>> {
        const instances: ConnectedContracts<C> = {}
        for (const deployment of deployments) {
            instances[deployment.name] = await ContractInstance.Connect<C>(deployment, wallets)
        }
        return instances
    }

    async getFromHardhat(deployments: HardhatDeployments): Promise<ProxiedContractDeployment[]> {
        const pcd: ProxiedContractDeployment[] = []
        const keys = Object.keys(deployments)
        for (const ix in keys) {
            const key = keys[ix]
            if (Deployments.isInternalSuffix(key)) {
                continue
            }
            const cd = await this.get(key)
            if (!cd) {
                this.log?.warn(`Could not find deployment for ${key}`)
                continue
            }
            pcd.push(cd)
        }
        return pcd
    }

    async get(contract: string): Promise<ProxiedContractDeployment | null> {
        const proxy = await this.hre.deployments.getOrNull(this.proxyName(contract))
        const implementation = await this.hre.deployments.getOrNull(this.implName(contract))
        if (!proxy || !implementation) {
            return null
        }
        const deployment = this.new(contract, proxy, implementation)
        const proposal = await this.hre.deployments.getOrNull(this.upgradeProposalName(contract))
        if (!!proposal && proposal.address !== implementation.address) {
            deployment.upgradePending = true
        }
        return deployment
    }

    async save(deployment: ProxiedContractDeployment): Promise<void> {
        await this.hre.deployments.save(deployment.name, {...deployment.implementation, address: deployment.proxy.address, implementation: deployment.implementation.address})
        await this.hre.deployments.save(this.implName(deployment.name), deployment.implementation)
        await this.hre.deployments.save(this.proxyName(deployment.name), { ...ERC1967Proxy, address: deployment.proxy.address, implementation: deployment.implementation.address })
    }

    async newProposal(deployment: ProxiedContractDeployment, index?: number): Promise<ProxiedContractDeployment> {
        await this.hre.deployments.save(this.upgradeProposalName(deployment.name, index), deployment.implementation)
        deployment.upgradePending = true
        return deployment
    }

    async hasActiveProposal(contract: string, index?: number): Promise<boolean> {
        const proposal = await this.hre.deployments.getOrNull(this.upgradeProposalName(contract, index))
        return !!proposal
    }

    async resolveProposal(contract: string, index?: number): Promise<ProxiedContractDeployment | null> {
        const deployment = await this.get(contract)
        const proposal = await this.hre.deployments.getOrNull(this.upgradeProposalName(contract, index))
        // Check if proposal is the current implementation
        if (!!deployment && !!proposal && await this.readImplementationAddress(deployment.proxy.address) === proposal.address) {
            // Update in-memory references of resolved deployments
            deployment.implementation = proposal
            deployment.proxy.implementation = proposal.address
            deployment.upgradePending = false

            this.save(deployment)
            await this.hre.deployments.delete(this.upgradeProposalName(contract, index))
            return deployment
        }
        return null
    }

    async refreshImplementation(deployment: ProxiedContractDeployment, address?: string, artifact?: ExtendedArtifact): Promise<ProxiedContractDeployment> {
        const newImplementation = await this.implementationDeployment(deployment, address, artifact)
        if (newImplementation.address !== deployment.implementation.address) {
            deployment.contractChanged = true
            deployment = this.setImplementation(deployment, newImplementation)
        }
        return deployment
    }

    // Create new deployment from artifact & proxy address and persist
    async create(contract: string, proxyAddress: string, address?: string, artifact?: ExtendedArtifact): Promise<ProxiedContractDeployment> {
        if (!artifact) {
            artifact = await this.readArtifact(contract)
        }
        if (!address) {
            address = await this.readImplementationAddress(proxyAddress)
        }
        const deployment = this.new(contract,
            { ...ERC1967Proxy, address: proxyAddress, implementation: address },
            { ...artifact, address: address })
        await this.save(deployment)
        return deployment
    }

    // New deployment in-memory from existing proxy & implementation deployments
    new(contract: string, proxy: Deployment, implementation: Deployment): ProxiedContractDeployment {
        return new ProxiedContractDeployment({
            name: contract,
            proxy: proxy,
            implementation: implementation,
        })
    }

    // HELPER
    static _internalSuffixTable: string[] = Object.values(INTERNAL_SUFFIXES)
    static isInternalSuffix(text: string): boolean {
        if (!text.includes("-")) {
            return false
        }
        for (const suffix of this._internalSuffixTable) {
            if (text.endsWith(suffix)) {
                return true
            }
        }
        return false
    }

    async implementationDeployment(deployment: ProxiedContractDeployment, address?: string, artifact?: ExtendedArtifact): Promise<Deployment> {
        if (!address) {
            address = await this.readImplementationAddress(deployment.proxy.address)
        }
        if (!artifact) {
            artifact = await this.readArtifact(deployment.name)
        }
        return { address, ...artifact }
    }

    async readImplementationAddress(proxyAddress: string) {
        return await this.hre.upgrades.erc1967.getImplementationAddress(proxyAddress)
    }

    async readArtifact(contract: string): Promise<ExtendedArtifact> {
        return await this.hre.deployments.getExtendedArtifact(contract)
    }

    setImplementation(deployment: ProxiedContractDeployment, implementation: Deployment): ProxiedContractDeployment {
        deployment.implementation = implementation
        deployment.proxy.implementation = deployment.implementation.address
        return deployment
    }

    proxyName(contract: string, type?: string) {
        let suffix: string = INTERNAL_SUFFIXES.ProxyUUPS // Default to UUPS
        switch (type) {
            case "uups" || "UUPS": suffix = INTERNAL_SUFFIXES.ProxyUUPS; break;
        }
        return `${contract}-${suffix}`
    }

    implName(contract: string, type?: string) {
        let suffix: string = INTERNAL_SUFFIXES.Implementation
        return `${contract}-${suffix}`
    }

    upgradeProposalName(contract: string, index?: number) {
        let suffix: string = INTERNAL_SUFFIXES.UpgradeProposal
        if (!!index) {
            suffix = `${suffix}-${index}`
        }
        return `${contract}-${suffix}`
    }
}


type HardhatDeployments = Record<string, Deployment>
