import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

  it("Should allow the client or executor to cancel the project and refund the client (ERC20)", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];
    const platformFeePercent = 100; // 1%

    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);

    // Create a new project
    await safe
      .connect(client)
      .createProject(
        executor.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        token.target
      );

    // Cancel the project
    await safe.connect(client).cancelProject(0);

    // Fetch the project details
    const project = await safe.projects(0);
    expect(project.isCancelled).to.equal(true);

    // Validate refund
    const platformFee = (BigInt(totalAmount.toString()) * BigInt(platformFeePercent)) / BigInt(10000);

    const initialClientBalance = BigInt(ethers.parseUnits("1000", 18).toString());
    const clientBalanceAfter = BigInt((await token.balanceOf(client.address)).toString());

    expect(clientBalanceAfter).to.equal(initialClientBalance - platformFee);
  });


  it("Should allow the client to cancel the project and refund the client (Native Currency)", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];
    const platformFeePercent = 100; // 1%

    // Create a project with native currency
    await safe
      .connect(client)
      .createProject(
        executor.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        ZERO_ADDRESS,
        { value: totalAmount }
      );

    const clientBalanceBefore = BigInt(
      await ethers.provider.getBalance(client.address)
    );

    // Cancel the project
    const tx = await safe.connect(client).cancelProject(0);
    const receipt = await tx.wait();

    const gasUsed = BigInt(receipt.gasUsed.toString());
    const gasPrice = BigInt(tx.gasPrice!.toString());
    const gasCost = gasUsed * gasPrice;

    const clientBalanceAfter = BigInt(
      await ethers.provider.getBalance(client.address)
    );

    // Fetch the project details
    const project = await safe.projects(0);
    expect(project.isCancelled).to.equal(true);

    // Validate refund
    const platformFee = (BigInt(totalAmount.toString()) * BigInt(platformFeePercent)) / BigInt(10000);
    const refundedAmount = BigInt(totalAmount.toString()) - platformFee;

    expect(clientBalanceAfter).to.equal(
      clientBalanceBefore + refundedAmount - gasCost
    );
  });

  it("Should revert if the project is already completed", async function () {
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

    // Confirm all milestones
    await safe.connect(client).confirmMilestone(0);
    await safe.connect(client).confirmMilestone(0);
    await safe.connect(client).confirmMilestone(0);

    // Attempt to cancel the project after completion
    await expect(safe.connect(client).cancelProject(0)).to.be.revertedWith(
      "Project is completed"
    );
  });
});
