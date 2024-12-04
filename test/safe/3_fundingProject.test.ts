import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("Safe Contract Project Funding", function () {
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

  it("Should allow the client to fund the project using ERC20 tokens", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const platformFee =
      (totalAmount * BigInt(platformFeePercent)) / BigInt(10000);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);

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
    await safe.connect(client).fundProject(0);

    // Fetch the project details
    const project = await safe.projects(0);

    // Validate project funding status
    expect(project.isFunded).to.equal(true);

    // Validate balance on the contract
    const contractBalance = await token.balanceOf(safe.target);
    expect(contractBalance).to.equal(totalAmount);

    // Validate platform fee
    const recordedPlatformFee = await safe.platformFunds(token.target);
    expect(recordedPlatformFee).to.equal(platformFee);

    // Validate milestone amount balance (remaining funds for milestones)
    const remainingFundsForMilestones = totalAmount - platformFee;
    expect(contractBalance - recordedPlatformFee).to.equal(
      remainingFundsForMilestones
    );
  });

  it("Should allow the client to fund the project using native currency", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const platformFee =
      (totalAmount * BigInt(platformFeePercent)) / BigInt(10000);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

    // Executor initiates the project with native currency
    await safe
      .connect(executor)
      .executorInitiateProject(
        client.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        ZERO_ADDRESS
      );

    // Client funds the project using native currency
    await safe.connect(client).fundProject(0, { value: totalAmount });

    // Fetch the project details
    const project = await safe.projects(0);

    // Validate project funding status
    expect(project.isFunded).to.equal(true);

    // Validate balance on the contract
    const contractBalance = await ethers.provider.getBalance(safe.target);
    expect(contractBalance).to.equal(totalAmount);

    // Validate platform fee for native currency
    const recordedPlatformFee = await safe.nativeCurrencyPlatformFunds();
    expect(recordedPlatformFee).to.equal(platformFee);

    // Validate milestone amount balance (remaining funds for milestones)
    const remainingFundsForMilestones = totalAmount - platformFee;
    expect(contractBalance - recordedPlatformFee).to.equal(
      remainingFundsForMilestones
    );
  });

  it("Should revert if a non-client tries to fund the project", async function () {
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

    // Attempt to fund the project as a non-client
    await expect(safe.connect(executor).fundProject(0)).to.be.revertedWith(
      "Only the designated client can fund the project"
    );
  });

  it("Should revert if the project is already funded", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);

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

    // Fund the project
    await safe.connect(client).fundProject(0);

    // Attempt to fund the project again
    await expect(safe.connect(client).fundProject(0)).to.be.revertedWith(
      "Project is already funded"
    );
  });

  it("Should revert if the native currency sent does not match the total amount", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const platformFeePercent = 100; // 1%
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];

    // Executor initiates the project with native currency
    await safe
      .connect(executor)
      .executorInitiateProject(
        client.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        ZERO_ADDRESS
      );

    // Attempt to fund the project with insufficient native currency
    await expect(
      safe
        .connect(client)
        .fundProject(0, { value: ethers.parseUnits("50", 18) })
    ).to.be.revertedWith("Incorrect native currency value sent");
  });
});
