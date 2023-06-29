import { Address } from "@orca-so/common-sdk";

export type ReadonlyMetadata = Readonly<Metadata> | null;
export type ReadonlyMetadataMap = Map<string, ReadonlyMetadata>;

export interface MetadataProvider {
  find(address: Address): Promise<ReadonlyMetadata>;
  findMany(addresses: Address[]): Promise<ReadonlyMetadataMap>;
}

export interface Metadata {
  symbol?: string;
  name?: string;
  image?: string;
}
