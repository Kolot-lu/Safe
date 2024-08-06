import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

describe("Safe Contract Milestone Confirmation", function () {
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

  it("Should allow the client to confirm milestones and release funds", async function () {
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
    await safe.connect(client).createProject(
      executor.address,
      totalAmount,
      milestoneAmounts,
      platformFeePercent,
      token.target
    );
    await safe.connect(client).fundProject(0);

    // Confirm the first milestone
    await safe.connect(client).confirmMilestone(0);
    let project = await safe.projects(0);
    expect(project.currentMilestone).to.equal(1);
    expect(await token.balanceOf(executor.address)).to.equal(
      milestoneAmounts[0]
    );

    // Confirm the second milestone
    await safe.connect(client).confirmMilestone(0);
    project = await safe.projects(0);
    expect(project.currentMilestone).to.equal(2);
    expect(await token.balanceOf(executor.address)).to.equal(
      milestoneAmounts[0] + milestoneAmounts[1]
    );

    // Confirm the third milestone
    await safe.connect(client).confirmMilestone(0);
    project = await safe.projects(0);
    expect(project.currentMilestone).to.equal(3);
    expect(await token.balanceOf(executor.address)).to.equal(
      milestoneAmounts[0] + milestoneAmounts[1] + milestoneAmounts[2]
    );
    expect(project.isCompleted).to.equal(true);
  });
});
