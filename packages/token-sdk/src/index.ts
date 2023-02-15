import { Connection, PublicKey } from "@solana/web3.js";
import { MetaplexProvider } from "./provider";
import { TokenProvider } from "./provider/token-provider";

async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const provider = new TokenProvider(connection, [new MetaplexProvider(connection)]);
  const token = await provider.findMany([
    new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
    new PublicKey("orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE"),
    new PublicKey("H7Qc9APCWWGDVxGD5fJHmLTmdEgT9GFatAKFNg6sHh8A"),
    new PublicKey("z3dn17yLaGMKffVogeFHQ9zWVcXgqgf3PQnDsNs2g6M"),
    new PublicKey("FahAohCrvY8pPE4SadjtL2EnVEMmQ73htxbyXP3sYPpW"),
  ]);
  console.log(token);
}

main()
  .then(() => console.log("Done"))
  .catch((e) => console.error(e));
