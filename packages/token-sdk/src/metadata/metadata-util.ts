import { Metadata } from "./types";

export class MetadataUtil {
  public static isPartial(metadata: Metadata): boolean {
    return !metadata.name || !metadata.symbol || !metadata.image;
  }

  public static merge(...metadatas: Metadata[]): Metadata {
    const merged: Partial<Metadata> = {};
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
