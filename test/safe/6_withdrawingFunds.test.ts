import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

describe("Safe Contract Withdrawing Platform Funds", function () {
  let safe: any;
  let owner: any;
  let client: any;
  let executor: any;
  let token: any;

  // Deploy contracts and set up initial state before each test
  beforeEach(async function () {
    [owner, client, executor] = await setupSigners();
    token = await deployTestERC20();
    safe = await deploySafe();
    await token.transfer(client.address, ethers.parseUnits("1000", 18));
  });

  it("Should allow the owner to withdraw accumulated platform fees", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];
    const platformFeePercent = 100; // 1%

    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);

    // Create and fund the project
    await safe
      .connect(client)
      .createProject(
        executor.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        token.target
      );

    // Calculate platform fee
    const platformFee =
      (totalAmount * BigInt(platformFeePercent)) / BigInt(10000);

    // Withdraw platform fees
    const ownerInitialBalance = await token.balanceOf(owner.address);
    await safe.connect(owner).withdrawPlatformFunds(token.target);
    const ownerFinalBalance = await token.balanceOf(owner.address);

    // Validate platform fee withdrawal
    expect(ownerFinalBalance - ownerInitialBalance).to.equal(platformFee);
  });
});
