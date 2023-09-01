import { Command } from "commander";
import { addMint } from "./cmd/add-mint";
import { checkFormat } from "./cmd/check-format";
import { format } from "./cmd/format";
import { removeMint } from "./cmd/remove-mint";

const program = new Command();

program.name("mintlist-cli").description("CLI for managing mintlists").version("0.1.0");

program
  .command("add-mint")
  .description("Add a mint to a mintlist")
  .argument("<mintlist>", "Path to mintlist file")
  .argument("<mint...>", "Mint(s) to add to mintlist")
  .action(addMint);

program
  .command("remove-mint")
  .alias("rm-mint")
  .description("Remove a mint from a mintlist")
  .argument("<mintlist>", "Path to mintlist file")
  .argument("<mint...>", "Mint(s) to remove from mintlist")
  .action(removeMint);

program
  .command("format")
  .description("Format the provided mintlists and overrides")
  .alias("fmt")
  .argument("<root_dir>", "Root directory of mintlists and overrides to format")
  .action(format);

program
  .command("check-format")
  .description("Check the provided mintlists and overrides for formatting errors")
  .alias("chkfmt")
  .argument("<root_dir>", "Root directory of mintlists and overrides to check")
  .action(checkFormat);

export default program;
