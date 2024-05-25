import { Address } from "@orca-so/common-sdk";
import { Metadata } from "./metadata";

export type Token = { mint: Address; decimals: number, tokenProgram: Address } & Metadata;

export interface Mintlist {
  name: string;
  version: string;
  mints: Address[];
}
