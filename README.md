# Easythread

Vite experimental plugin for improving the DX for worker threads.

## Usage

### Simple usage

```ts
/** @easythread */
function heavyComputation(data: number[]) {
  let result = 0;
  for (let i = 0; i < data.length; i++) {
    result += Math.pow(data[i], 2);
  }
  console.log("Result", result);
}

// Use the function as if it's running on the main thread
const data = [1, 2, 3, 4, 5];
heavyComputation(data);

// Main thread continues execution immediately
console.log("Main thread is not blocked!");
```

### Return value from the easythread

```ts
/** @easythread */
async function complexCalculation(x: number, y: number): Promise<number> {
  // Simulate a time-consuming calculation
  return Promise.resolve(x * y + Math.sqrt(x + y));
}

// Use the function and handle the returned promise
complexCalculation(10, 20).then((result) => {
  console.log("Calculation result:", result);
});

console.log(
  "This will be logged immediately, before the calculation completes."
);
```

### Anonymous function

```ts
/** @easythread */
(() => {
  console.log("This is an anonymous function running in a worker thread");
  // Perform some heavy computation here
  for (let i = 0; i < 1000000000; i++) {
    // Simulating complex work
  }
  console.log("Anonymous function completed its work");
})();

console.log("Main thread continues execution immediately");
```

### Using out-of-scope variables

Easythread can automatically detect and pass variables that are defined outside the function's scope:

```ts
const multiplier = 2;
const message = "Calculation complete!";

/** @easythread */
function outOfScopeExample(x: number): number {
  const result = x multiplier;
  console.log(message, result);
  return result;
}

outOfScopeExample(10).then((result) => {
  console.log("Result:", result);
});
```

In this example, `multiplier` and `message` are automatically detected and passed to the worker thread.

#### Limitations

While Easythread can handle most primitive values and plain objects, there are some limitations on what can be passed to a worker thread:

1. Functions: Worker threads cannot receive functions as arguments or use functions from the outer scope.
2. DOM elements: Workers don't have access to the DOM, so DOM elements can't be passed or used.
3. Complex objects: Objects with circular references or those that can't be cloned (like Symbols) cannot be passed to workers.
4. Class instances: Instances of custom classes may lose their methods when passed to a worker.
