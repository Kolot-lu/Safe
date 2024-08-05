const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config();

const compiledContract = JSON.parse(fs.readFileSync('artifacts/contracts/Safe.sol/Safe.json', 'utf8'));
const abi = compiledContract.abi;
const bytecode = compiledContract.bytecode;

const tronWeb = new TronWeb({
  fullHost: process.env.TRON_PRIVATE_KEY,
  privateKey: process.env.TRON_PRIVATE_KEY,
});

async function deploy() {
  const contract = await tronWeb.contract().new({
    abi: abi,
    bytecode: bytecode,
  });
  console.log('Safe contract deployed to:', contract.address);
}

deploy().catch(console.error);
