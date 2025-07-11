# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Easythread is a Vite plugin that simplifies Web Worker usage by automatically transforming functions marked with `@easythread` comments to run in worker threads. This prevents UI blocking during heavy computations while maintaining a simple, synchronous-looking API.

## Common Development Commands

- `npm run dev` - Start the Vite development server with hot reload
- `npm run build` - Type-check with TypeScript then build for production
- `npm run lint` - Run ESLint to check code style and potential issues
- `npm run preview` - Preview the production build locally

## Architecture

### Core Components

1. **easythread-plugin.ts** - Vite plugin entry point that intercepts file transformations
2. **transformer.js** - Babel-based AST transformer that:
   - Identifies `@easythread` annotated functions
   - Extracts external variable dependencies
   - Generates Web Worker wrapper code
   - Returns Promise-based implementations

### How It Works

1. Developer adds `/** @easythread */` comment above any function
2. During build/dev, the Vite plugin intercepts `.ts`, `.tsx`, `.js`, and `.jsx` files
3. The transformer:
   - Parses the AST using Babel
   - Finds functions with the easythread comment
   - Detects external variables used within the function
   - Generates a Web Worker that executes the original function
   - Replaces the function with a Promise-returning wrapper
4. At runtime, function calls execute in a worker thread and return results via Promises

### Key Implementation Details

- **Supported function types**: Function declarations, variable declarations with function expressions, anonymous functions, exported functions
- **External variable handling**: Automatically detects and serializes variables from outer scopes
- **Import handling**: Tracks and resolves ES module imports used within easythread functions
  - Collects all import statements at the module level
  - Identifies which imports are used within each easythread function
  - Generates dynamic imports within the worker using `await import()`
  - Resolves relative paths to absolute URLs for the browser
- **Promise-based API**: All transformed functions return Promises for async handling
- **TypeScript support**: Full TypeScript support with type information preserved
- **Worker type**: Uses module workers (`{ type: 'module' }`) to support ES modules

### Project Structure

```
src/                    # React demo application
├── App.tsx            # Demo showing easythread vs normal function performance
├── main.tsx           # React entry point
easythread-plugin.ts   # Vite plugin implementation
transformer.js         # Core AST transformation logic
```

## Development Tips

- When modifying the transformer, test with various function patterns (declarations, expressions, anonymous, exported)
- The demo app in `src/App.tsx` is useful for testing changes - it shows a counter that updates every 16ms to visualize UI responsiveness
- Check the browser console for worker messages and any serialization issues
- Remember that workers have limitations: no DOM access, no function passing, and complex objects may not serialize properly