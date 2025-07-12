import { fibonacci, isPrime, heavyComputation } from "./utils.js";

console.log("🚀 Easythread Bun Example");
console.log("=========================");

async function runExample() {
  console.log("\n1. Computing Fibonacci(40) in worker thread...");
  const startTime = performance.now();
  
  try {
    const fibResult = await fibonacci(40);
    const fibTime = performance.now() - startTime;
    console.log(`✅ Fibonacci(40) = ${fibResult} (computed in ${fibTime.toFixed(2)}ms)`);
  } catch (error) {
    console.error("❌ Fibonacci computation failed:", error);
  }

  console.log("\n2. Checking if 982451653 is prime in worker thread...");
  const primeStartTime = performance.now();
  
  try {
    const primeResult = await isPrime(982451653);
    const primeTime = performance.now() - primeStartTime;
    console.log(`✅ 982451653 is ${primeResult ? 'prime' : 'not prime'} (computed in ${primeTime.toFixed(2)}ms)`);
  } catch (error) {
    console.error("❌ Prime check failed:", error);
  }

  console.log("\n3. Running heavy computation (10M iterations) in worker thread...");
  const heavyStartTime = performance.now();
  
  try {
    const heavyResult = await heavyComputation(10_000_000);
    const heavyTime = performance.now() - heavyStartTime;
    console.log(`✅ ${heavyResult} (computed in ${heavyTime.toFixed(2)}ms)`);
  } catch (error) {
    console.error("❌ Heavy computation failed:", error);
  }

  console.log("\n🎉 All computations completed! Main thread was never blocked.");
  console.log("💡 Try running multiple instances to see parallel processing in action.");
}

// Show that main thread is responsive during computations
let counter = 0;
const interval = setInterval(() => {
  console.log(`🔄 Main thread tick ${++counter} (every 100ms)`);
  if (counter >= 50) { // Stop after 5 seconds
    clearInterval(interval);
  }
}, 100);

runExample().catch(console.error);