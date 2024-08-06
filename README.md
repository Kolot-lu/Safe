# Safe
**(!This project is currently under development and testing!)**

## Overview

Safe.kolot.lu is a decentralized escrow contract for secure milestone-based project payments. It facilitates secure transactions between clients and executors with transparent and fair fund management using ERC20/TRC20 tokens.

## Features

- **Decentralized Escrow**: Securely manage payments between clients and executors.
- **Milestone-Based Payments**: Break down project payments into milestones.
- **Platform Fees**: Deduct platform fees from project budgets.
- **Cancellation and Refunds**: Allow project cancellation and client refunds.
- **Upgradeable Contracts**: Utilize OpenZeppelin's upgradeable contracts.

## Smart Contracts

- `Safe.sol`: The main contract handling project creation, milestone payments, and cancellations.
- `TestERC20.sol`: A mock ERC20 token used for testing.

## Project Structure

```
.
├── LICENSE
├── README.md
├── contracts
│   ├── Safe.sol
│   └── ...
├── hardhat.config.ts
├── package-lock.json
├── package.json
├── scripts
│   ├── deploy.ts
│   └── ...
├── test
│   ├── utils.ts
│   └── safe
│       ├── 1_deployment.test.ts
│       ├── 2_projectCreation.test.ts
│       └── ...
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js
- npm or yarn
- Hardhat
- An Ethereum wallet with testnet or mainnet access

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Kolot-lu/Safe.git
cd Safe
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory and add the following variables:

```plaintext
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=your_private_key
TRON_SHASTA_URL=https://api.shasta.trongrid.io
TRON_PRIVATE_KEY=your_tron_private_key
```

### Compiling Contracts

Compile the smart contracts using Hardhat:

```bash
npx hardhat compile
```

### Running Tests

Run the tests to ensure everything is working correctly:

```bash
npx hardhat test
```

## Deployment

### Deploy to Local Network

To deploy the contracts to a local Hardhat network:

```bash
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

### Deploy to Testnet/Mainnet

To deploy the contracts to a testnet (e.g., Sepolia) or mainnet:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
# or
npx hardhat run scripts/deploy.ts --network mainnet
```

## Usage

### Creating a Project

Use the `createProject` function to create a new project with specified milestones and platform fee.

```solidity
function createProject(
    address _executor,
    uint256 _totalAmount,
    uint256[] memory _milestoneAmounts,
    uint256 _platformFeePercent,
    IERC20 _token
) public
```

### Funding a Project

Use the `fundProject` function to fund a previously created project.

```solidity
function fundProject(uint256 _projectId) public
```

### Confirming a Milestone

Use the `confirmMilestone` function to confirm the completion of a milestone and release funds to the executor.

```solidity
function confirmMilestone(uint256 _projectId) public
```

### Cancelling a Project

Use the `cancelProject` function to cancel a project and refund the client.

```solidity
function cancelProject(uint256 _projectId) public
```

### Withdrawing Platform Funds

The owner can withdraw accumulated platform fees using the `withdrawPlatformFunds` function.

```solidity
function withdrawPlatformFunds(IERC20 _token) public onlyOwner
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [OpenZeppelin](https://openzeppelin.com) for their excellent library of secure smart contract components.
- [Hardhat](https://hardhat.org) for providing a robust development environment for Ethereum software.