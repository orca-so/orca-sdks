import { Address } from "@project-serum/anchor";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { AddressUtil } from "../address-util";
import { ParsableEntity } from "./parsing";

export async function getParsedAccount<T>(
  connection: Connection,
  address: Address,
  parser: ParsableEntity<T>
): Promise<T | null> {
  const value = await connection.getAccountInfo(AddressUtil.toPubKey(address));
  const key = AddressUtil.toPubKey(address);
  return parser.parse(key, value);
}

export async function getMultipleParsedAccounts<T>(
  connection: Connection,
  addresses: Address[],
  parser: ParsableEntity<T>
): Promise<(T | null)[]> {
  if (addresses.length === 0) {
    return [];
  }

  const values = await getMultipleAccounts(connection, AddressUtil.toPubKeys(addresses));
  const results = values.map((val) => {
    if (val[1] === null) {
      return null;
    }
    return parser.parse(val[0], val[1]);
  });
  invariant(results.length === addresses.length, "not enough results fetched");
  return results;
}

// An entry between the key of an address and the account data for that address.
export type FetchedAccountEntry = [PublicKey, AccountInfo<Buffer> | null];
export type FetchedAccountMap = Map<string, AccountInfo<Buffer> | null>;

export async function getMultipleAccountsInMap(
  connection: Connection,
  addresses: Address[],
  timeoutAfterSeconds = 10
): Promise<Readonly<FetchedAccountMap>> {
  const results = await getMultipleAccounts(connection, addresses, timeoutAfterSeconds);
  return results.reduce((map, [key, value]) => {
    map.set(key.toBase58(), value);
    return map;
  }, new Map<string, AccountInfo<Buffer> | null>());
}

export async function getMultipleAccounts(
  connection: Connection,
  addresses: Address[],
  timeoutAfterSeconds = 10
): Promise<Readonly<FetchedAccountEntry[]>> {
  if (addresses.length === 0) {
    return [];
  }

  const promises: Promise<void>[] = [];
  const chunk = 100; // getMultipleAccounts has limitation of 100 accounts per request
  const result: Array<FetchedAccountEntry> = [];

  for (let i = 0; i < addresses.length; i += chunk) {
    const addressChunk = AddressUtil.toPubKeys(addresses.slice(i, i + chunk));
    const promise = new Promise<void>(async (resolve) => {
      const res = await connection.getMultipleAccountsInfo(addressChunk);
      const map = res.map((result, index) => {
        return [addressChunk[index], result] as FetchedAccountEntry;
      });
      result.push(...map);
      resolve();
    });
    promises.push(promise);
  }

  await Promise.race([
    Promise.all(promises),
    timeoutAfter(timeoutAfterSeconds, "connection.getMultipleAccountsInfo timeout"),
  ]);

  invariant(result.length === addresses.length, "getMultipleAccounts not enough results");
  return result;
}

function timeoutAfter(seconds: number, message: string) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, seconds * 1000);
  });
}
