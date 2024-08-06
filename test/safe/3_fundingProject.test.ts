import { ethers } from "hardhat";
import { expect } from "chai";
import { deploySafe, deployTestERC20, setupSigners } from "../utils";

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

  it("Should allow the client to fund the project", async function () {
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

    // Fund the project
    await safe.connect(client).fundProject(0);

    // Fetch the project details
    const project = await safe.projects(0);

    // Validate project funding status
    expect(project.isFunded).to.equal(true);
    expect(await token.balanceOf(safe.target)).to.equal(totalAmount);
  });
});
