# Mintlist CLI Utilities

CLI for working with JSON mintlists and other token classes from the `@orca-so/token-sdk` package.

This package is currently used by the `@orca-so/orca-mintlists-demo` repository for managing mintlists.
The goal is to separate dev dependencies from the `token-sdk` package and the `orca-mintlists` package.

## Commands

- `add-mint`: Adds a mint to a mintlist. No-op if duplicate. Sorts mints.
- `remove-mint`: Removes a mint from a mintlist. No-op if duplicate. Sorts mints.
- `lint`: Lints mintlists and overrides files by detecting formatting issues and alphabetical sorting.
- `format`: Formats files by fixing any detected lint errors.
