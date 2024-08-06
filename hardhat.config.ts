import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config"; // Loads environment variables from .env file

/**
 * @type {HardhatUserConfig} Hardhat configuration object
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20", // Specifies the Solidity version to be used for compilation
    settings: {
      optimizer: {
        enabled: true, // Enables the optimizer to reduce gas cost
        runs: 200, // Number of optimization runs
      },
    },
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_URL || "", // URL for the mainnet network
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [], // Private key for deploying contracts on mainnet
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "", // URL for the Sepolia test network
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [], // Private key for deploying contracts on Sepolia
    },
  },
};

export default config;
