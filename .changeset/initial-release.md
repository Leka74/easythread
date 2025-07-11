---
"@easythread/core": major
"@easythread/vite": major
"@easythread/rollup": major
"@easythread/esbuild": major
---

🎉 Initial release of easythread monorepo!

### Features

- **Multi-environment support**: Browser (Web Workers) + Node.js (Worker Threads)
- **Multi-bundler compatibility**: Vite, Rollup, ESBuild plugins
- **TypeScript support**: Full AST transformation with babel
- **Smart import resolution**: Dynamic imports with ES/CJS compatibility
- **External variable passing**: Seamless variable injection into worker contexts
- **Enhanced error handling**: Comprehensive error categorization and contextual messages

### Packages

- `@easythread/core` - Core transformer and strategies
- `@easythread/vite` - Vite plugin for automatic Web Worker generation
- `@easythread/rollup` - Rollup plugin for Node.js Worker Thread generation
- `@easythread/esbuild` - ESBuild plugin for fast builds

### Testing

- 57 comprehensive unit tests covering all core functionality
- Full CI/CD pipeline with automated testing and publishing
- Multi-Node.js version compatibility (18, 20, 22)

This release represents a production-ready solution for transforming functions to run in workers across multiple bundlers and environments.