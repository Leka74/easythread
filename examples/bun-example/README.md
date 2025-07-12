# Easythread Bun Example

This example demonstrates how to use easythread with Bun for automatic Web Worker generation.

## Features Demonstrated

- **Fibonacci calculation** - Recursive computation that benefits from worker threads
- **Prime number checking** - CPU-intensive algorithm running in parallel
- **Heavy computation** - Mathematical operations with millions of iterations
- **Main thread responsiveness** - Counter showing the main thread remains unblocked

## Setup

1. Install Bun if you haven't already:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

## Running the Example

### Method 1: Direct execution (with built-in transformation)
```bash
bun dev
```

### Method 2: Build then run
```bash
bun run build
bun run dist/index.js
```

## How It Works

1. **Function Annotation**: Functions marked with `/** @easythread */` are automatically transformed
2. **Worker Generation**: The Bun plugin generates Web Worker code during build/runtime
3. **Promise-based API**: All easythread functions return Promises for async handling
4. **Import Resolution**: The plugin handles both relative and npm package imports

## Key Benefits with Bun

- **Fast startup**: Bun's performance makes worker creation even faster
- **Built-in TypeScript**: No additional transpilation needed
- **ES modules**: Native support for modern JavaScript features
- **Excellent compatibility**: Works with both Web Workers and Node.js APIs

## Code Structure

```
src/
├── index.ts     # Main application showing worker usage
├── utils.ts     # Functions marked with @easythread
└── build.ts     # Bun build configuration with easythread plugin
```

## Expected Output

You should see output showing:
- Main thread counter ticking every 100ms (proving responsiveness)
- Fibonacci, prime checking, and heavy computation results
- Timing information for each operation
- Confirmation that computations ran in worker threads