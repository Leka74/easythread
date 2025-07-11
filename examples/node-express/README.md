# Easythread Node.js Express Example

This example demonstrates how to use easythread with a Node.js Express server to automatically run heavy computations in Worker Threads.

## Features

- **Fibonacci calculation** - Recursive fibonacci computation in worker thread
- **Prime number generation** - Find prime numbers in a range using worker thread
- **Heavy calculations** - CPU-intensive mathematical operations in worker thread
- **Import support** - Uses imported utility functions within worker threads
- **Express integration** - RESTful API endpoints with worker thread processing

## Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Start the server
pnpm start

# Or run in development mode
pnpm run dev
```

## API Endpoints

### GET /
Returns information about available endpoints.

### GET /fibonacci/:n
Calculate the nth Fibonacci number.

**Example:**
```bash
curl http://localhost:3000/fibonacci/35
```

**Response:**
```json
{
  "input": 35,
  "result": 9227465,
  "computedInWorker": true,
  "timeMs": 245
}
```

### GET /primes/:start/:end
Find all prime numbers in the given range.

**Example:**
```bash
curl http://localhost:3000/primes/1/1000
```

**Response:**
```json
{
  "range": { "start": 1, "end": 1000 },
  "primes": [2, 3, 5, 7, 11, ...],
  "count": 168,
  "computedInWorker": true,
  "timeMs": 12
}
```

### POST /heavy-calculation
Perform CPU-intensive mathematical calculations.

**Example:**
```bash
curl -X POST http://localhost:3000/heavy-calculation \
  -H "Content-Type: application/json" \
  -d '{"iterations": 1000000}'
```

**Response:**
```json
{
  "input": { "iterations": 1000000 },
  "result": 1570796326.79,
  "time": 89,
  "constants": {
    "PI": 3.141592653589793,
    "E": 2.718281828459045,
    "SQRT2": 1.4142135623730951
  },
  "computedInWorker": true,
  "totalTimeMs": 95
}
```

## How It Works

1. **Automatic Worker Threads**: Functions marked with `/** @easythread */` are automatically converted to run in Node.js Worker Threads
2. **Import Resolution**: The `@easythread/rollup` plugin detects imported functions (like `mathConstants`) and makes them available in the worker context
3. **Non-blocking**: Heavy computations don't block the main Express server thread
4. **Promise-based**: All easythread functions return Promises for easy async/await usage

## Code Example

```typescript
import { mathConstants } from './utils';

/** @easythread */
async function performHeavyCalculation(iterations: number) {
  // This runs in a Worker Thread automatically!
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * mathConstants.PI; // Imported constant works!
  }
  return result;
}

// Usage in Express route
app.post('/heavy', async (req, res) => {
  const result = await performHeavyCalculation(1000000); // Non-blocking!
  res.json({ result });
});
```

## Performance Benefits

- **Main thread stays responsive** - HTTP requests are handled immediately
- **Parallel processing** - Multiple heavy calculations can run simultaneously
- **Automatic scaling** - Node.js manages worker thread pool efficiently
- **Simple API** - No manual worker thread management required