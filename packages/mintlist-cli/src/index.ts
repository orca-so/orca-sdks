#!/usr/bin/env node

import program from "./program";

async function main() {
  await program.parseAsync();
}

main()
  .then(() => {})
  .catch((e) => console.error(e));
