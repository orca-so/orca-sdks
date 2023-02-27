import { TokenMetadata } from "./types";

export class MetadataUtil {
  public static isPartial(metadata: Partial<TokenMetadata>): boolean {
    return !metadata.name || !metadata.symbol || !metadata.image;
  }

  public static merge(...metadatas: Partial<TokenMetadata | null>[]): Partial<TokenMetadata> {
    const merged: Partial<TokenMetadata> = {};
    metadatas.forEach((metadata) => {
      if (!metadata) {
        return;
      }
      if (!merged.name) {
        merged.name = metadata.name;
      }
      if (!merged.symbol) {
        merged.symbol = metadata.symbol;
      }
      if (!merged.image) {
        merged.image = metadata.image;
      }
    });
    return merged;
  }
}
