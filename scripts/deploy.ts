import { ethers } from "hardhat";

async function main() {
    const Safe = await ethers.getContractFactory("Safe");
    const safe = await Safe.deploy();
    await safe.deployed();
    console.log("Safe contract deployed to:", safe.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
