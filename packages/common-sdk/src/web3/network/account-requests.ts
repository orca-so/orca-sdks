import { Address } from "@project-serum/anchor";
import { Connection, AccountInfo } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { AddressUtil } from "../address-util";
import { ParsableEntity } from "./parsing";

export async function getParsedAccount<T>(
  connection: Connection,
  address: Address,
  parser: ParsableEntity<T>
): Promise<T | null> {
  const value = await connection.getAccountInfo(AddressUtil.toPubKey(address));
  return parser.parse(value?.data);
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
  const results = values
    .map((value) => parser.parse(value?.data))
    .filter((value): value is T | null => value !== undefined);
  invariant(results.length === addresses.length, "not enough results fetched");
  return results;
}

type GetMultipleAccountsInfoResponse = (AccountInfo<Buffer> | null)[];

export async function getMultipleAccounts(
  connection: Connection,
  addresses: Address[]
): Promise<GetMultipleAccountsInfoResponse> {
  if (addresses.length === 0) {
    return [];
  }

  const responses: Promise<GetMultipleAccountsInfoResponse>[] = [];
  const chunk = 100; // getMultipleAccounts has limitation of 100 accounts per request

  for (let i = 0; i < addresses.length; i += chunk) {
    const addressChunk = addresses.slice(i, i + chunk);
    const res = connection.getMultipleAccountsInfo(
      AddressUtil.toPubKeys(addressChunk),
      connection.commitment
    );
    responses.push(res);
  }

  const combinedResult = (await Promise.all(responses)).flat();
  invariant(combinedResult.length === addresses.length, "bulkRequest not enough results");
  return combinedResult;
}