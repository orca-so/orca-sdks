import { Mint, getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { BasicSupportedTypes, ParsableEntity, ParsableMintInfo, ParsableTokenAccountInfo, SimpleAccountCache } from "../../../src/web3";
import { TestContext, createNewMint, createTestContext, requestAirdrop } from "../../test-context";
import { expectMintEquals } from "../../utils/expectations";

jest.setTimeout(100 * 1000 /* ms */);

describe("simple-account-cache", () => {
  let ctx: TestContext = createTestContext();
  const retentionPolicy = new Map<ParsableEntity<BasicSupportedTypes>, number>([[ParsableMintInfo, 1000], [ParsableTokenAccountInfo, 1000]]);
  const testMints: PublicKey[] = [];

  beforeAll(async () => {
    await requestAirdrop(ctx);
    for (let i = 0; i < 10; i++) {
      testMints.push(await createNewMint(ctx));
    }
  });

  beforeEach(() => {
    ctx = createTestContext();
    jest.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getAccount", () => {
    it("fetch brand new account equals on-chain", async () => {
      const mintKey = testMints[0];

      const expected = await getMint(ctx.connection, mintKey);

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getAccountInfo");
      const cached = await cache.getAccount(mintKey, ParsableMintInfo);

      expect(spy).toBeCalledTimes(1);
      expect(cached).toBeDefined();
      expectMintEquals(cached!, expected);
    });

    it("returns cached value within retention window", async () => {
      const mintKey = testMints[0];
      const expected = await getMint(ctx.connection, mintKey);
      const now = Date.now();
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getAccountInfo");
      await cache.getAccount(mintKey, ParsableMintInfo, undefined, now);
      const cached = await cache.getAccount(mintKey, ParsableMintInfo, undefined, now + retention);

      expect(spy).toBeCalledTimes(1);
      expect(cached).toBeDefined();
      expectMintEquals(cached!, expected);
    });

    it("fetch new value when call is outside of retention window", async () => {
      const mintKey = testMints[0];
      const expected = await getMint(ctx.connection, mintKey);
      const now = 32523523523;
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getAccountInfo");
      await cache.getAccount(mintKey, ParsableMintInfo, undefined, now);
      const cached = await cache.getAccount(
        mintKey,
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );

      expect(spy).toBeCalledTimes(2);
      expect(cached).toBeDefined();
      expectMintEquals(cached!, expected);
    });

    it("getAccount - return cache value when call does not exceed custom ttl", async () => {
      const mintKey = testMints[0];
      const expected = await getMint(ctx.connection, mintKey);
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const ttl = 50;
      const spy = jest.spyOn(ctx.connection, "getAccountInfo");
      await cache.getAccount(mintKey, ParsableMintInfo, { ttl }, now);
      const cached = await cache.getAccount(mintKey, ParsableMintInfo, { ttl }, now + ttl);

      expect(spy).toBeCalledTimes(1);
      expect(cached).toBeDefined();
      expectMintEquals(cached!, expected);
    });

    it("fetch new value when call exceed custom ttl", async () => {
      const mintKey = testMints[0];
      const expected = await getMint(ctx.connection, mintKey);
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const ttl = 50;
      const spy = jest.spyOn(ctx.connection, "getAccountInfo");
      await cache.getAccount(mintKey, ParsableMintInfo, { ttl }, now);
      const cached = await cache.getAccount(mintKey, ParsableMintInfo, { ttl }, now + ttl + 1);

      expect(spy).toBeCalledTimes(2);
      expect(cached).toBeDefined();
      expectMintEquals(cached!, expected);
    });

    it("fetching invalid account returns null", async () => {
      const mintKey = PublicKey.default;
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const cached = await cache.getAccount(mintKey, ParsableMintInfo, undefined, now);

      expect(cached).toBeNull();
    });

    it("fetching valid account but invalid account type returns null", async () => {
      const mintKey = testMints[0];
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const cached = await cache.getAccount(mintKey, ParsableTokenAccountInfo, undefined, now);

      expect(cached).toBeNull();
    });

    it("fetching null-cached accounts will respect ttl", async () => {
      const mintKey = testMints[0];
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getAccountInfo");
      await cache.getAccount(mintKey, ParsableTokenAccountInfo, undefined, now);
      const cached = await cache.getAccount(mintKey, ParsableTokenAccountInfo, undefined, now + 5);

      expect(spy).toBeCalledTimes(1);
      expect(cached).toBeNull();
    });
  });

  describe("getAccounts", () => {
    let expectedMintInfos: Mint[] = [];

    beforeAll(async () => {
      for (const mint of testMints) {
        expectedMintInfos.push(await getMint(ctx.connection, mint));
      }
    });

    it("nothing cached, fetching all values", async () => {
      const mintKeys = testMints;
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const resultMap = await cache.getAccounts(mintKeys, ParsableMintInfo, undefined, now);

      expect(spy).toBeCalledTimes(1);

      Array.from(resultMap.values()).forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("all are cached, fetching all values will not call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts(mintKeys, ParsableMintInfo, undefined, now);
      const resultMap = await cache.getAccounts(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention
      );
      expect(spy).toBeCalledTimes(1);
      Array.from(resultMap.values()).forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("all are cached but expired, fetching all values will call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts(mintKeys, ParsableMintInfo, undefined, now);
      const resultMap = await cache.getAccounts(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );
      expect(spy).toBeCalledTimes(2);
      Array.from(resultMap.values()).forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("some are cached, fetching all values will call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts([testMints[0], testMints[1]], ParsableMintInfo, undefined, now);
      const resultMap = await cache.getAccounts(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention
      );
      expect(spy).toBeCalledTimes(2);
      Array.from(resultMap.values()).forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("some are cached, some expired, fetching all values will call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts([testMints[0], testMints[1]], ParsableMintInfo, undefined, now);
      await cache.getAccounts([testMints[2], testMints[3]], ParsableMintInfo, undefined, now + 5);
      const resultMap = await cache.getAccounts(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );
      expect(spy).toBeCalledTimes(3);
      Array.from(resultMap.values()).forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("some are cached, some expired, some invalid", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts([testMints[0], testMints[1]], ParsableMintInfo, undefined, now);
      await cache.getAccounts([testMints[2], testMints[3], PublicKey.default], ParsableMintInfo, undefined, now + 5);
      const resultMap = await cache.getAccounts(
        [...mintKeys, PublicKey.default],
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );
      expect(spy).toBeCalledTimes(3);
      Array.from(resultMap.values()).forEach((value, index) => {
        if (index <= mintKeys.length - 1) {
          expect(value).toBeDefined();
          expectMintEquals(value!, expectedMintInfos[index]);
        } else {
          // Expect the last value, which is invalid, to be null
          expect(value).toBeNull();
        }
      });
    });
  });

  describe("getAccountsAsArray", () => {
    let expectedMintInfos: Mint[] = [];

    beforeAll(async () => {
      for (const mint of testMints) {
        expectedMintInfos.push(await getMint(ctx.connection, mint));
      }
    });

    it("nothing cached, fetching all values", async () => {
      const mintKeys = testMints;
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const resultArray = await cache.getAccountsAsArray(mintKeys, ParsableMintInfo, undefined, now);

      expect(spy).toBeCalledTimes(1);

      resultArray.forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("duplicated values are shown", async () => {
      const mintKeys = [...testMints, ...testMints];
      const expected = [...expectedMintInfos, ...expectedMintInfos];
      const now = 32523523523;

      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);

      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const resultArray = await cache.getAccountsAsArray(mintKeys, ParsableMintInfo, undefined, now);

      expect(spy).toBeCalledTimes(1);

      resultArray.forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expected[index]);
      });
    });

    it("all are cached, fetching all values will not call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts(mintKeys, ParsableMintInfo, undefined, now);
      const result = await cache.getAccountsAsArray(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention
      );
      expect(spy).toBeCalledTimes(1);
      result.forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("all are cached but expired, fetching all values will call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts(mintKeys, ParsableMintInfo, undefined, now);
      const result = await cache.getAccountsAsArray(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );
      expect(spy).toBeCalledTimes(2);
      result.forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("some are cached, fetching all values will call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts([testMints[0], testMints[1]], ParsableMintInfo, undefined, now);
      const result = await cache.getAccountsAsArray(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention
      );
      expect(spy).toBeCalledTimes(2);
      result.forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("some are cached, some expired, fetching all values will call for update", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts([testMints[0], testMints[1]], ParsableMintInfo, undefined, now);
      await cache.getAccounts([testMints[2], testMints[3]], ParsableMintInfo, undefined, now + 5);
      const result = await cache.getAccountsAsArray(
        mintKeys,
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );
      expect(spy).toBeCalledTimes(3);
      result.forEach((value, index) => {
        expect(value).toBeDefined();
        expectMintEquals(value!, expectedMintInfos[index]);
      });
    });

    it("some are cached, some expired, some invalid", async () => {
      const mintKeys = testMints;
      const now = 32523523523;
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const retention = retentionPolicy.get(ParsableMintInfo)!;

      await cache.getAccounts([testMints[0], testMints[1]], ParsableMintInfo, undefined, now);
      await cache.getAccounts([testMints[2], testMints[3], PublicKey.default], ParsableMintInfo, undefined, now + 5);
      const result = await cache.getAccountsAsArray(
        [...mintKeys, PublicKey.default],
        ParsableMintInfo,
        undefined,
        now + retention + 1
      );
      expect(spy).toBeCalledTimes(3);
      result.forEach((value, index) => {
        if (index <= mintKeys.length - 1) {
          expect(value).toBeDefined();
          expectMintEquals(value!, expectedMintInfos[index]);
        } else {
          // Expect the last value, which is invalid, to be null
          expect(value).toBeNull();
        }
      });
    });
  })

  describe("refreshAll", () => {
    it("refresh all updates all keys", async () => {
      const cache = new SimpleAccountCache(ctx.connection, retentionPolicy);
      const now = 32523523523;

      // Populate cache
      await cache.getAccounts(
        testMints,
        ParsableMintInfo,
        undefined,
        now
      );

      const spy = jest.spyOn(ctx.connection, "getMultipleAccountsInfo");
      const renewNow = now + 500000;
      await cache.refreshAll(renewNow);
      expect(spy).toBeCalledTimes(1);
      cache.cache.forEach((value, _) => {
        expect(value.fetchedAt).toEqual(renewNow);
      });
    })
  });
});
