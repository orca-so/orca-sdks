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

  it("valid overrides file names", async () => {
    type TestCase = [string, boolean];
    const tests: TestCase[] = [
      ["overrides.json", true],
      ["xxxx.overrides.json", true],
      ["x23x.overrides.json", false],
      ["xx-.overrides.json", false],
      ["xxxx.Overrides.json", false],
      ["xxxx.OVERRIDES.json", false],
      ["x.y.z.overrides.json", false],
      ["xx.yy.zz.overrides.json", false],
      ["x-y-z.overrides.json", false],
      ["x-y-z.n.overrides.json", false],
      ["-x-y-z.overrides.json", false],
      ["x--z.overrides.json", false],
      ["orca-whitelisted.overrides.json", false],
      ["orca-whitelisted.bob.json", false],
      ["x.overrides", false],
      ["x.overrides.jsx", false],
    ];

    for (const [name, expected] of tests) {
      expect(MintlistFileUtil.validOverridesName(name)).toBe(expected);
    }
  });
});
