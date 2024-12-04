import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

  it("Should create a project using ERC20 tokens and deduct the platform fee", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];
    const platformFeePercent = 100; // 1%
  
    // Approve Safe contract to spend client's tokens
    await token.connect(client).approve(safe.target, totalAmount);
  
    // Create a new project using ERC20 tokens
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
  
    // Validate milestone amounts
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
    expect(project.isFunded).to.equal(true);
  
    // Validate platform fee balance
    const contractBalance = await token.balanceOf(safe.target);
    expect(contractBalance).to.equal(totalAmount); // Total amount should be on the contract
  });


  it("Should create a project using native currency and deduct the platform fee", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];
    const platformFeePercent = 100; // 1%

    // Create a new project using native currency
    await safe.connect(client).createProject(
      executor.address,
      totalAmount,
      milestoneAmounts,
      platformFeePercent,
      ZERO_ADDRESS,
      { value: totalAmount }
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

    // Validate milestone amounts
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
    expect(project.isFunded).to.equal(true);

    // Validate platform fee balance for native currency
    const nativeCurrencyPlatformFunds = await safe.nativeCurrencyPlatformFunds();
    expect(nativeCurrencyPlatformFunds).to.equal(platformFee);
  });

  it("Should revert if the native currency sent does not match the total amount", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39", 18),
    ];
    const platformFeePercent = 100; // 1%

    // Attempt to create a project with insufficient native currency
    await expect(
      safe.connect(client).createProject(
        executor.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        ZERO_ADDRESS,
        { value: ethers.parseUnits("50", 18) }
      )
    ).to.be.revertedWith("Incorrect native currency value sent");
  });

  it("Should revert if milestones do not sum to the remaining amount after platform fee", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("20", 18), // Incorrect sum
      ethers.parseUnits("30", 18),
      ethers.parseUnits("40", 18),
    ];
    const platformFeePercent = 100; // 1%

    // Attempt to create a project with incorrect milestone sum
    await expect(
      safe.connect(client).createProject(
        executor.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        token.target
      )
    ).to.be.revertedWith(
      "Milestones must sum to the remaining amount after platform fee"
    );
  });

  it("Should revert if platform fee percent is less than 1%", async function () {
    const totalAmount = ethers.parseUnits("100", 18);
    const milestoneAmounts = [
      ethers.parseUnits("30", 18),
      ethers.parseUnits("30", 18),
      ethers.parseUnits("39.5", 18),
    ];
    const platformFeePercent = 50; // Less than 1%

    // Attempt to create a project with too low platform fee percent
    await expect(
      safe.connect(client).createProject(
        executor.address,
        totalAmount,
        milestoneAmounts,
        platformFeePercent,
        token.target
      )
    ).to.be.revertedWith("Platform fee percent must be at least 1%");
  });
});
