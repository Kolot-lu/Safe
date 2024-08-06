import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

describe("Safe Contract Project Cancellation", function () {
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

  it("Should allow the client or executor to cancel the project and refund the client", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39.5", 18),
    ];
    const platformFeePercent = 50; // 0.5%

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
    await safe.connect(client).fundProject(0);

    // Calculate platform fee
    const platformFee =
      (totalAmount * BigInt(platformFeePercent)) / BigInt(10000);

    // Calculate the total amount after deducting the platform fee
    const deductedTotalAmount = totalAmount - platformFee;

    // Cancel the project
    await safe.connect(client).cancelProject(0);

    // Fetch the project details
    const project = await safe.projects(0);

    // Validate project cancellation status
    expect(project.isCancelled).to.equal(true);

    // Validate client refund
    const clientRefund = ethers.parseUnits("1000", 18) - platformFee;
    expect(await token.balanceOf(client.address)).to.equal(clientRefund);
  });
});
