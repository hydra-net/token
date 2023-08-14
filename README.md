# HDN Token
Repository for new Hydranet (HDN) Token.

Based on ERC-20 standard and implemented using OpenZeppelin Contract Library.

## Addresses
### Mainnet (Arbitrum One)
#### Contracts
* **HDN Token** [0x3404149e9EE6f17Fb41DB1Ce593ee48FBDcD9506](https://arbiscan.io/address/0x3404149e9EE6f17Fb41DB1Ce593ee48FBDcD9506)
* **DAO Info** [0x84e91FDD4cfb22d4266f8Be309e8C4E2f9f24fcB](https://arbiscan.io/address/0x84e91FDD4cfb22d4266f8Be309e8C4E2f9f24fcB)
* **Treasury** [0x3a9104CF804039EaD55E987556f3E647875FBe15](https://arbiscan.io/address/0x3a9104CF804039EaD55E987556f3E647875FBe15)
* **Bonds** [0x15740F6057b5427C2155FdA85ed5E9AaAb3bF3e7](https://arbiscan.io/address/0x15740F6057b5427C2155FdA85ed5E9AaAb3bF3e7)

#### MultiSig
* **Admin** [0xC5888C4C261a1C5e8745EB1977eb54FcB21d2A28](https://arbiscan.io/address/0xC5888C4C261a1C5e8745EB1977eb54FcB21d2A28)

### Testnet (Arbitrum Goerli)
#### Contracts
* **HDN Token** [0xC59DA616B7f3De41D7EA4D02F95abAF7C77b9D0A](https://goerli.arbiscan.io/address/0xC59DA616B7f3De41D7EA4D02F95abAF7C77b9D0A)
* **DAO Info** [0x67635527C0a8D872AD6c1b7E9c3d53a771FAe3e5](https://goerli.arbiscan.io/address/0x67635527C0a8D872AD6c1b7E9c3d53a771FAe3e5)
* **Treasury** [0x56CDBdd6c4577De978c131C658a3934f93298920](https://goerli.arbiscan.io/address/0x56CDBdd6c4577De978c131C658a3934f93298920)
* **Bonds** [0xc7e1D8c2d53D74346cD92D97299E3505B25908b1](https://goerli.arbiscan.io/address/0xc7e1D8c2d53D74346cD92D97299E3505B25908b1)

#### MultiSig
* **Admin** [0xb527238736a8B9ABFa35E14C1990d2BC6b0b52B0](https://goerli.arbiscan.io/address/0xb527238736a8B9ABFa35E14C1990d2BC6b0b52B0)

## Contracts
* **Token** implements ERC-20 standard and security fallbacks (pause / unpause)
* **Treasury** manages finances and approvals for operational spending (including Bonds)
* **Bondage** contains logic for creating, managing, buying, and claiming bonds

## Features
* Implements ERC-20 with possibility to support future interfaces
* Upgradable (UUPS)
* Mint & Burn disabled with possibility to enable through upgrades in the future
* Prepared for On-Chain Governance (but not yet implemented)

## Development
* `npm install` to install dependencies
* `npm test` to run tests
* `npm run glue` to copy artifacts and deployments to webapp
* `npx hardhat deploy --network <network-name>` to deploy or upgrade contracts
