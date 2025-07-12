# @easythread/bun-plugin

Bun plugin for automatic Web Worker transformation using easythread.

## Installation

```bash
bun add @easythread/bun-plugin
```

## Usage

### Method 1: Runtime Plugin (Recommended for Development)

The runtime plugin transforms `@easythread` functions on-the-fly when files are imported.

#### Option A: Using bunfig.toml (Global)

Add to your `bunfig.toml`:

```toml
preload = ["@easythread/bun-plugin/register"]
```

Then just run your files normally:
```bash
bun run ./my-file.ts
```

#### Option B: Programmatic Registration

```typescript
// At the top of your entry file
import "@easythread/bun-plugin/register";

// Or with options:
import { registerEasythreadRuntime } from "@easythread/bun-plugin/runtime";

registerEasythreadRuntime({
  debug: true,
  exclude: ["node_modules", "dist", ".git"]
});
```

### Method 2: Build Plugin (Recommended for Production)

Use during build process:

```typescript
// build.ts
import easythreadPlugin from "@easythread/bun-plugin";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [easythreadPlugin()]
});
```

## Environment Variables

When using the runtime plugin with `bunfig.toml`:

- `EASYTHREAD_DEBUG=true` - Enable debug logging
- `EASYTHREAD_EXCLUDE=node_modules,dist` - Comma-separated list of paths to exclude

## Example

```typescript
// worker-example.ts
/** @easythread */
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// This will automatically run in a worker!
const result = await fibonacci(40);
console.log(result);
```

## How It Works

1. **Runtime Plugin**: Intercepts file imports and transforms `@easythread` functions into Web Workers
2. **Build Plugin**: Transforms during build process for production use
3. **Worker Creation**: Uses Blob URLs and Web Workers for parallel execution
4. **Promise API**: All transformed functions return Promises

## Limitations

- Functions marked with `@easythread` cannot access DOM or closure variables
- Complex objects may have serialization limitations
- Imports within worker functions need to be bundled or available

## Development Workflow

1. Add to `bunfig.toml`:
   ```toml
   preload = ["@easythread/bun-plugin/register"]
   ```

2. Run your code normally:
   ```bash
   bun run ./src/index.ts
   ```

3. Functions marked with `@easythread` automatically run in workers!

## Production Workflow

1. Create a build script:
   ```typescript
   import easythreadPlugin from "@easythread/bun-plugin";

   await Bun.build({
     entrypoints: ["./src/index.ts"],
     outdir: "./dist",
     target: "bun",
     plugins: [easythreadPlugin()]
   });
   ```

2. Build and run:
   ```bash
   bun run build.ts
   bun ./dist/index.js
   ```

## TypeScript Support

Full TypeScript support with type preservation. The plugin handles `.ts`, `.tsx`, `.js`, and `.jsx` files.

## Performance Benefits

- Main thread stays responsive
- CPU-intensive tasks run in parallel
- Automatic worker management
- Fast worker creation with Bun's performance