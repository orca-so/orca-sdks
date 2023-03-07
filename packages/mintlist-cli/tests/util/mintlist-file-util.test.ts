import { MintlistFileUtil } from "../../src/util/mintlist-file-util";
jest.setTimeout(100 * 1000 /* ms */);

describe("mintlist-file-util", () => {
  it("valid json file names", async () => {
    type TestCase = [string, boolean];
    const tests: TestCase[] = [
      ["xxxx.tokenlist.json", true],
      ["x235.tokenlist.json", true],
      ["x23x.tokenlist.json", true],
      ["xx-.tokenlist.json", false],
      ["xxxx.TokenList.json", false],
      ["xxxx.TOKENLIST.json", false],
      ["x.y.z.tokenlist.json", false],
      ["xx.yy.zz.tokenlist.json", false],
      ["x-y-z.tokenlist.json", true],
      ["x-y-z.n.tokenlist.json", false],
      ["-x-y-z.tokenlist.json", false],
      ["x--z.tokenlist.json", false],
      ["orca-whitelisted.tokenlist.json", true],
      ["orca-whitelisted.bob.json", false],
      ["x.tokenlist", false],
      ["x.tokenlist.jsx", false],
    ];

    for (const [name, expected] of tests) {
      expect(MintlistFileUtil.validTokenlistName(name)).toBe(expected);
    }
  });
});
