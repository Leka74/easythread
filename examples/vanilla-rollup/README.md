# Easythread Vanilla Rollup Example

This example demonstrates how to use easythread with vanilla TypeScript and Rollup to automatically run computations in Worker Threads in a Node.js environment.

## Features

- **Sorting algorithms** - QuickSort and MergeSort running in worker threads
- **Binary search** - Fast searching in sorted arrays using worker threads  
- **Data processing** - Chunk-based data processing in worker threads
- **Performance comparison** - Main thread vs Worker thread execution timing
- **Import support** - Uses imported algorithms and constants within worker threads

## Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run the demo
pnpm start

# Or run in development mode with auto-rebuild
pnpm run dev
```

## What It Demonstrates

### 1. Automatic Worker Thread Creation
Functions marked with `/** @easythread */` automatically run in Node.js Worker Threads:

```typescript
/** @easythread */
async function sortLargeArray(algorithm: 'quick' | 'merge', data: number[]) {
  // This runs in a Worker Thread automatically!
  if (algorithm === 'quick') {
    return quickSort(data);  // Imported function works!
  } else {
    return mergeSort(data);
  }
}
```

### 2. Import Resolution
Imported functions and constants are automatically available in worker threads:

```typescript
import { quickSort, mergeSort, sortingConfig } from './algorithms';

/** @easythread */
async function processData(data: number[]) {
  // Both imported functions and constants work in the worker!
  const sorted = quickSort(data);
  const maxSize = sortingConfig.maxArraySize;
  return { sorted, maxSize };
}
```

### 3. Performance Benefits
- **Non-blocking**: Heavy computations don't block the main thread
- **Parallel processing**: Multiple worker threads can run simultaneously
- **Automatic scaling**: Node.js manages the worker thread pool

## Example Output

```
🚀 Easythread Vanilla Rollup Example
=====================================

📊 Running performance comparisons...

1. Sorting Performance Test
---------------------------
🧵 Worker: Sorting 10000 items using quick sort
🧵 Worker: Max array size allowed: 100000
🧵 Worker: Sorting completed in 3.45ms
🧵 Quick Sort (Worker): 15.20ms
🧵 Worker: Sorting 10000 items using merge sort
🧵 Worker: Sorting completed in 4.12ms
🧵 Merge Sort (Worker): 18.67ms
✅ Quick sort result valid: true
✅ Merge sort result valid: true

2. Binary Search Test
---------------------
🧵 Worker: Searching for 5 targets in sorted array of 10000 items
🧵 Worker: Search completed, found 3/5 targets
🧵 Binary Search (Worker): 8.34ms
Search results:
  Target 42 found at index 567
  Target 123 found at index 1234
  Target 456 not found
  Target 789 found at index 7890
  Target 999 not found

3. Data Processing Test
-----------------------
🧵 Worker: Processing data in chunks of 500
🧵 Worker: Processed 20 chunks, sum=5043210, average=504.32
🧵 Chunk Processing (Worker): 45.78ms
Processed 20 chunks
Total sum: 5043210
Average: 504.32

4. Main Thread vs Worker Thread Comparison
-------------------------------------------
🧵 Worker thread tasks completed above ☝️
🏠 Quick Sort (Main Thread - smaller array): 1.23ms

✨ Demo completed!
📝 Key observations:
   • Heavy computations run in worker threads automatically
   • Main thread remains responsive
   • Imported functions (algorithms) work seamlessly in workers
   • Imported constants (sortingConfig) are available in workers
   • Promise-based API makes async coordination easy
```

## Code Structure

- **`src/index.ts`** - Main demo script with easythread functions
- **`src/algorithms.ts`** - Utility functions for sorting and searching
- **`rollup.config.js`** - Rollup configuration with easythread plugin
- **`tsconfig.json`** - TypeScript configuration

## How It Works

1. **Build Process**: Rollup with `@easythread/rollup` plugin transforms the code
2. **Function Detection**: Functions with `/** @easythread */` are identified
3. **Worker Generation**: Each function is wrapped in Worker Thread code
4. **Import Resolution**: Dependencies are resolved and included in worker context
5. **Runtime Execution**: When called, functions execute in isolated worker threads

This example shows how easythread makes it trivial to offload CPU-intensive work to worker threads while maintaining a simple, synchronous-looking API.