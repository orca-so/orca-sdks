import { MintlistFileUtil } from "../../src/util/mintlist-file-util";
jest.setTimeout(100 * 1000 /* ms */);

describe("mintlist-file-util", () => {
  it("valid json file names", async () => {
    type TestCase = [string, boolean];
    const tests: TestCase[] = [
      ["xxxx.mintlist.json", true],
      ["x235.mintlist.json", true],
      ["x23x.mintlist.json", true],
      ["xx-.mintlist.json", false],
      ["xxxx.MintList.json", false],
      ["xxxx.MINTLIST.json", false],
      ["x.y.z.mintlist.json", false],
      ["xx.yy.zz.mintlist.json", false],
      ["x-y-z.mintlist.json", true],
      ["x-y-z.n.mintlist.json", false],
      ["-x-y-z.mintlist.json", false],
      ["x--z.mintlist.json", false],
      ["orca-whitelisted.mintlist.json", true],
      ["orca-whitelisted.bob.json", false],
      ["x.mintlist", false],
      ["x.mintlist.jsx", false],
    ];

    for (const [name, expected] of tests) {
      expect(MintlistFileUtil.validMintlistName(name)).toBe(expected);
    }
  });
});
