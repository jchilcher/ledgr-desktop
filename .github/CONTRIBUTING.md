# Contributing to Ledgr

Thanks for your interest in contributing to Ledgr! This document covers how to get involved.

## Reporting Bugs

If you find a bug, please [open an issue](https://github.com/jchilcher/ledgr/issues/new) with:

- A clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Your OS and Ledgr version
- Screenshots if applicable

## Suggesting Features

Feature ideas are welcome! [Open an issue](https://github.com/jchilcher/ledgr/issues/new) describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Run tests to make sure everything works:
   ```bash
   npm run test:all
   ```

## Pull Request Process

1. **Fork** the repository and create a branch from `main`
2. **Make your changes** — keep commits focused and well-described
3. **Add tests** for new functionality
4. **Run the full test suite** before submitting:
   ```bash
   npm run test:all
   npm run lint
   ```
5. **Open a pull request** against `main` with a clear description of what you changed and why

## Code Style

- **TypeScript** is used throughout the project
- **ESLint** enforces code style — run `npm run lint:fix` to auto-fix issues
- Follow existing patterns in the codebase
- Keep changes minimal and focused on the task at hand

## Project Structure

- `apps/desktop/` — Electron desktop application
- `packages/core/` — Shared business logic
- `tests/` — E2E tests and fixtures

See the [README](../README.md) for more details.

## License

By contributing to Ledgr, you agree that your contributions will be licensed under the [AGPL-3.0 license](../LICENSE).
