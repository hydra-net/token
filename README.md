# HDN Token
Repository for new Hydranet (HDN) Token.

Based on ERC-20 standard and implemented using OpenZeppelin Contract Library.

## Contracts
* **Token** implements ERC-20 standard and security fallbacks (pause / unpause)
* **Bondage** contains logic for creating, managing, buying, and claiming bonds (**WIP**)

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
