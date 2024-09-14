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
