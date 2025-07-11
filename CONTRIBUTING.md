# Contributing to Easythread

Thank you for your interest in contributing to Easythread! This document outlines the development and release process.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/leka74/easythread.git
   cd easythread
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build packages**
   ```bash
   pnpm build
   ```

4. **Run tests**
   ```bash
   pnpm test
   ```

## Development Workflow

### Making Changes

1. Create a new branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure all tests pass
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

3. Create a changeset for your changes
   ```bash
   pnpm changeset
   ```

4. Commit your changes and push your branch
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

5. Create a pull request to `main`

### Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versions and releases.

#### Creating a Changeset

When you make changes that should be released, create a changeset:

```bash
pnpm changeset
```

This will:
- Prompt you to select which packages have changed
- Ask for the type of change (patch, minor, major)
- Request a description of the changes

#### Types of Changes

- **Patch** (0.0.X): Bug fixes, documentation updates
- **Minor** (0.X.0): New features, backwards-compatible changes
- **Major** (X.0.0): Breaking changes

#### Examples

**Bug Fix (Patch)**
```bash
pnpm changeset
# Select packages that changed
# Choose "patch"
# Description: "Fix worker thread performance issue"
```

**New Feature (Minor)**
```bash
pnpm changeset
# Select packages that changed  
# Choose "minor"
# Description: "Add support for SharedArrayBuffer in workers"
```

**Breaking Change (Major)**
```bash
pnpm changeset
# Select packages that changed
# Choose "major" 
# Description: "Change transformer API to support plugins"
```

## Release Process

Releases are automated through GitHub Actions:

### 1. Automatic Release (Recommended)

When changesets are merged to `main`, the release workflow will:

1. **CI Pipeline**: Run all tests, linting, and type checking
2. **Version & Publish**: 
   - If there are changesets: Create a "Release" PR with version bumps
   - If Release PR is merged: Publish packages to npm automatically
3. **GitHub Release**: Create a GitHub release with changelog

### 2. Manual Release Workflow

You can also trigger releases manually:

1. **Go to GitHub Actions**
   - Navigate to the "Changeset Version" workflow
   - Click "Run workflow"
   - Select release type (patch/minor/major)

2. **Review and Merge**
   - A PR will be created with version updates
   - Review the changes and merge when ready
   - Packages will be published automatically after merge

### 3. Emergency Hotfix

For urgent fixes:

1. Create a hotfix branch from `main`
2. Make the minimal necessary changes
3. Create a changeset with type "patch"
4. Create PR and get it reviewed quickly
5. Merge to trigger automatic release

## Publishing Workflow Details

### What Happens During Release

1. **Version Bump**: All packages get new version numbers based on changesets
2. **Changelog Generation**: CHANGELOG.md files are updated automatically
3. **Git Tags**: Release tags are created (e.g., `v1.2.3`)
4. **NPM Publishing**: Packages are published to npm with public access
5. **GitHub Release**: Release notes are generated with changelogs

### Published Packages

- [`@easythread/core`](https://www.npmjs.com/package/@easythread/core) - Core transformer
- [`@easythread/vite`](https://www.npmjs.com/package/@easythread/vite) - Vite plugin  
- [`@easythread/rollup`](https://www.npmjs.com/package/@easythread/rollup) - Rollup plugin
- [`@easythread/esbuild`](https://www.npmjs.com/package/@easythread/esbuild) - ESBuild plugin

### Package Versioning

All packages are versioned together to maintain compatibility:
- When core changes, all plugins get the same version bump
- This ensures users can safely update all packages together

## Testing

### Unit Tests
```bash
pnpm test                # Run all tests
pnpm test --coverage     # Run with coverage report
```

### Integration Tests
```bash
pnpm build              # Build all packages
cd examples/vite-react  && pnpm build  # Test Vite integration
cd examples/node-express && pnpm build # Test Node.js integration
```

### CI Pipeline

All PRs automatically run:
- **Linting**: ESLint checks for code quality
- **Type Checking**: TypeScript validation
- **Unit Tests**: All 57 unit tests across Node.js 18, 20, 22
- **Build Tests**: Verify all packages build correctly
- **Integration Tests**: Test all example applications

## Code Style

- **ESLint**: Configured with TypeScript rules
- **Prettier**: Automatic code formatting
- **EditorConfig**: Consistent editor settings

Run formatting:
```bash
pnpm lint:fix    # Fix linting issues
```

## Questions?

- **Issues**: [GitHub Issues](https://github.com/leka74/easythread/issues)
- **Discussions**: [GitHub Discussions](https://github.com/leka74/easythread/discussions)

Thank you for contributing! 🚀