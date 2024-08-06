import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

describe("Safe Contract Project Creation", function () {
  let safe: any;
  let client: any;
  let executor: any;
  let token: any;

  // Deploy contracts and set up initial state before each test
  beforeEach(async function () {
    [client, executor] = await setupSigners();
    token = await deployTestERC20();
    safe = await deploySafe();
    await token.transfer(client.address, ethers.parseUnits("1000", 18));
  });

  it("Should create a project and deduct the platform fee", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39.5", 18),
    ];
    const platformFeePercent = 50; // 0.5%

    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);

    // Create a new project
    await safe.connect(client).createProject(
      executor.address,
      totalAmount,
      milestoneAmounts,
      platformFeePercent,
      token.target
    );

    const project = await safe.projects(0);

    // Calculate platform fee and deducted total amount
    const platformFee =
      (totalAmount * BigInt(platformFeePercent)) / BigInt(10000);
    const deductedTotalAmount = totalAmount - platformFee;

    // Validate project details
    expect(project.client).to.equal(client.address);
    expect(project.executor).to.equal(executor.address);
    expect(project.totalAmount).to.equal(deductedTotalAmount);

    // Fetch and validate milestone amounts
    const fetchedMilestoneAmounts = await safe.getMilestoneAmounts(0);
    const milestoneAmountsAsStrings = milestoneAmounts.map((a) => a.toString());
    const fetchedMilestoneAmountsAsStrings = fetchedMilestoneAmounts.map(
      (a: BigInt) => a.toString()
    );

    expect(fetchedMilestoneAmountsAsStrings).to.deep.equal(
      milestoneAmountsAsStrings
    );
    expect(project.currentMilestone).to.equal(0);
    expect(project.isCompleted).to.equal(false);
    expect(project.isCancelled).to.equal(false);
    expect(project.isFunded).to.equal(false);

    // Validate platform fee balance
    expect(await token.balanceOf(safe.target)).to.equal(platformFee);
  });
});
