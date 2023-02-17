import invariant from "tiny-invariant";
import { Token } from "./models";

export type TokenTransformFn<T> = (response: T) => Token[];

export async function fromUrlToTokens<T>(
  url: string,
  transform: TokenTransformFn<T>
): Promise<Record<string, Token>> {
  const response = await fetch(url);
  invariant(response.ok, "Failed to fetch");
  let json: T;
  try {
    json = (await response.json()) as T;
  } catch (e) {
    throw new Error("Failed to parse response");
  }
  const tokens = transform(json);
  return Object.fromEntries(tokens.map((token) => [token.mint, token]));
}
