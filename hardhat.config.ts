import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-foundry"
import "@nomicfoundation/hardhat-toolbox"
import "@nomiclabs/hardhat-etherscan"
import "@openzeppelin/hardhat-upgrades"
import "@openzeppelin/hardhat-defender"

import "hardhat-deploy";
import * as tenderly from "@tenderly/hardhat-tenderly"

import { resolve } from "path"
import { config as dotenvConfig } from "dotenv"

// Read env-specific config options from .env file
dotenvConfig({ path: resolve(__dirname, "./.env") })

// Central place for variable config
const cfg = {
  chains: {
    arbitrum: {
      one: {
        id: 42161,
        url: "https://arb1.arbitrum.io/rpc",
        tags: ["arbitrum", "mainnet", "one"],
      },
      nova: {
        id: 42170,
        url: "https://nova.arbitrum.io/rpc",
        tags: ["arbitrum", "mainnet", "nova"],
      },
      goerli: {
        id: 421613,
        url: "https://goerli-rollup.arbitrum.io/rpc",
        tags: ["arbitrum", "testnet", "goerli"],
      }
    }
  },
  wallets: {
    deployer: process.env.DEPLOYER_WALLET ? `0x${process.env.DEPLOYER_WALLET}` : "NO DEPLOYER WALLET CONFIGURED",
  },
  tenderly: {
    defaultChain: 86527, // Default Chain = ArbOne FORK
    chain: process.env.TENDERLY_CHAIN ? parseInt(process.env.TENDERLY_CHAIN) ?? 86527 : 86527, 
    project: process.env.TENDERLY_PROJECT ?? "hdn-v1",
    account: process.env.TENDERLY_ACCOUNT ?? "dan4hydranet",
    forkId: process.env.TENDERLY_DEVNET ? undefined : process.env.TENDERLY_FORK,
    url: process.env.TENDERLY_DEVNET ?? `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK}`,
    autoVerify: process.env.TENDERLY_VERIFY_AUTO?.toLowerCase() == "true" ? true : false,
    privateVerify: process.env.TENDERLY_VERIFY_PRIVATE?.toLowerCase() == "true" ? true : false,
    deploymentsDir: process.env.TENDERLY_DEPLOYMENTS_DIR ?? "deployments",
  },
  defender: {
    apiKey: process.env.OZ_DEFENDER_TEAM_API_KEY ?? "",
    apiSecret: process.env.OZ_DEFENDER_TEAM_API_SECRET_KEY ?? "",
  },
  verify: {
    arbiscanApiKey: process.env.ARBISCAN_API_KEY ?? "",
    etherscanApiKey: process.env.ETHERSCAN_API_KEY ?? "",
  },
  settings: {
    reportGas: process.env.HH_REPORT_GAS?.toLowerCase() == "true" ? true : false,
  },
  default: {
    gasLimit: 21000,
    gasPrice: 5000000000,
  },
}

// Initialize and setup plugins
tenderly.setup({ automaticVerifications: cfg.tenderly.autoVerify })

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: cfg.settings.reportGas,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      // forking: {
      //   url: cfg.chains.arbitrum.one.url,
      // },
      chainId: 1337,
    },
    tenderly: {
      chainId: cfg.tenderly.chain,
      url: cfg.tenderly.url,
      accounts: [cfg.wallets.deployer],
      blockGasLimit: 1125899906842624,
      gas: 5000000,
    },
    arbitrumOne: {
      chainId: cfg.chains.arbitrum.one.id,
      url: cfg.chains.arbitrum.one.url,
      accounts: [cfg.wallets.deployer],
    },
    arbitrumNova: {
      chainId: cfg.chains.arbitrum.nova.id,
      url: cfg.chains.arbitrum.nova.url,
      accounts: [cfg.wallets.deployer],
    },
    arbitrumGoerli: {
      chainId: cfg.chains.arbitrum.goerli.id,
      url: cfg.chains.arbitrum.goerli.url,
      accounts: [cfg.wallets.deployer],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
          },
        },
      },
    ]
  },
  tenderly: {
    project: cfg.tenderly.project,
    username: cfg.tenderly.account,
    forkNetwork: cfg.tenderly.forkId,
    privateVerification: cfg.tenderly.privateVerify,
    deploymentsDir: cfg.tenderly.deploymentsDir,
  },
  defender: {
    apiKey: cfg.defender.apiKey,
    apiSecret: cfg.defender.apiSecret,
  },
  etherscan: {
    apiKey: {
      mainnet: cfg.verify.etherscanApiKey,
      arbitrumOne: cfg.verify.arbiscanApiKey,
      arbitrumGoerli: cfg.verify.arbiscanApiKey,
    }
  }
};

export default config;
