import { Address } from "@orca-so/common-sdk";

export interface MetadataProvider {
  find(address: Address): Promise<Readonly<Metadata> | null>;
  findMany(addresses: Address[]): Promise<ReadonlyMap<string, Metadata | null>>;
}

export interface Metadata {
  symbol?: string;
  name?: string;
  image?: string;
}
