import { ethers } from "hardhat";

/**
 * @dev Deploys the Safe contract and waits for deployment to complete.
 * @return The deployed Safe contract instance.
 */
export async function deploySafe() {
  const Safe = await ethers.getContractFactory("Safe");
  const safe = await Safe.deploy();
  await safe.waitForDeployment();
  return safe;
}

/**
 * @dev Deploys the TestERC20 contract with specified token parameters and waits for deployment to complete.
 * @return The deployed TestERC20 contract instance.
 */
export async function deployTestERC20() {
  const Token = await ethers.getContractFactory("TestERC20");
  const token = await Token.deploy("MockToken", "MTK", 18);
  await token.waitForDeployment();
  return token;
}

/**
 * @dev Retrieves the list of available signers (accounts) in the Hardhat environment.
 * @return An array of signer objects.
 */
export async function setupSigners() {
  const signers = await ethers.getSigners();
  return signers;
}
