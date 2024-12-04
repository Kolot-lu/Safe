import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

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
      
    const platformFee =
    (totalAmount * BigInt(platformFeePercent)) / BigInt(10000);
    
    const contractBalance = await token.balanceOf(safe.target);
    expect(contractBalance).to.equal(totalAmount);

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

  it("Should confirm milestones and release funds for projects initiated by the executor", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

    // Executor initiates the project
    await safe
      .connect(executor)
      .executorInitiateProject(
        client.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        token.target
      );

    // Client funds the project
    await token.connect(client).approve(safe.target, totalAmount);
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

  it("Should revert if a non-client tries to confirm a milestone", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

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

    // Attempt to confirm a milestone as a non-client
    await expect(safe.connect(executor).confirmMilestone(0)).to.be.revertedWith(
      "Only client can confirm milestone"
    );
  });

  it("Should revert if the project is not funded", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);

    // Create the project without funding it
    await safe
      .connect(executor)
      .executorInitiateProject(
        client.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        ZERO_ADDRESS
      );

    // Attempt to confirm a milestone
    await expect(safe.connect(client).confirmMilestone(0)).to.be.revertedWith(
      "Project must be funded"
    );
  });

  it("Should revert if all milestones are already completed", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

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

    // Attempt to confirm another milestone
    await expect(safe.connect(client).confirmMilestone(0)).to.be.revertedWith(
      "Project is completed"
    );
  });

  it("Should revert if the project is cancelled", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

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

    // Cancel the project
    await safe.connect(client).cancelProject(0);

    // Attempt to confirm a milestone
    await expect(safe.connect(client).confirmMilestone(0)).to.be.revertedWith(
      "Project is cancelled"
    );
  });
});
