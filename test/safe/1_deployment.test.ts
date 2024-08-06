import { expect } from "chai";
import { deploySafe, setupSigners } from "../utils";

describe("Safe Contract Deployment", function () {
  let safe: any;
  let owner: any;

  beforeEach(async function () {
    [owner] = await setupSigners();
    safe = await deploySafe();
  });

  it("Should set the right owner", async function () {
    expect(await safe.owner()).to.equal(owner.address);
  });
});
