import express from "express";
import { fibonacci, mathConstants } from "./utils";

const app = express();
const PORT = process.env["PORT"] || 3000;

// Middleware
app.use(express.json());

/** @easythread */
async function calculateFibonacci(n: number): Promise<number> {
  console.log(`Calculating fibonacci(${n}) in worker thread`);
  return fibonacci(n);
}

/** @easythread */
async function findPrimesInRange(
  start: number,
  end: number,
): Promise<number[]> {
  console.log(`Finding primes between ${start} and ${end} in worker thread`);
  const primes: number[] = [];

  for (let i = start; i <= end; i++) {
    let isPrime = true;
    if (i <= 1) isPrime = false;
    else if (i <= 3) isPrime = true;
    else if (i % 2 === 0 || i % 3 === 0) isPrime = false;
    else {
      for (let j = 5; j * j <= i; j += 6) {
        if (i % j === 0 || i % (j + 2) === 0) {
          isPrime = false;
          break;
        }
      }
    }

    if (isPrime) {
      primes.push(i);
    }
  }

  return primes;
}

/** @easythread */
async function performHeavyCalculation(
  iterations: number,
): Promise<{ result: number; time: number; constants: typeof mathConstants }> {
  console.log(
    `Performing heavy calculation with ${iterations} iterations in worker thread`,
  );
  const startTime = Date.now();

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * mathConstants.PI;
  }

  const endTime = Date.now();

  return {
    result,
    time: endTime - startTime,
    constants: mathConstants,
  };
}

// Routes
app.get("/", (_req, res) => {
  res.json({
    message: "Easythread Node.js Express Example",
    endpoints: {
      fibonacci: "GET /fibonacci/:n",
      primes: "GET /primes/:start/:end",
      heavy: "POST /heavy-calculation",
    },
  });
});

app.get("/fibonacci/:n", async (req, res) => {
  try {
    const n = parseInt(req.params.n);

    if (isNaN(n) || n < 0) {
      return res.status(400).json({ error: "Invalid number provided" });
    }

    if (n > 45) {
      return res
        .status(400)
        .json({ error: "Number too large (max 45 for demo)" });
    }

    console.log(`Main thread: Received request for fibonacci(${n})`);
    const startTime = Date.now();

    const result = await calculateFibonacci(n);

    const endTime = Date.now();

    return res.json({
      input: n,
      result,
      computedInWorker: true,
      timeMs: endTime - startTime,
    });
  } catch (error) {
    console.log("Error calculating fibonacci:", error);
    return res.status(500).json({ error: "Calculation failed" });
  }
});

app.get("/primes/:start/:end", async (req, res) => {
  try {
    const start = parseInt(req.params.start);
    const end = parseInt(req.params.end);

    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
      return res.status(400).json({ error: "Invalid range provided" });
    }

    if (end - start > 10000) {
      return res
        .status(400)
        .json({ error: "Range too large (max 10000 for demo)" });
    }

    console.log(
      `Main thread: Received request for primes between ${start} and ${end}`,
    );
    const startTime = Date.now();

    const primes = (await findPrimesInRange(start, end)) as any;

    const endTime = Date.now();

    return res.json({
      range: { start, end },
      primes,
      count: primes.length,
      computedInWorker: true,
      timeMs: endTime - startTime,
    });
  } catch (error) {
    return res.status(500).json({ error: "Calculation failed" });
  }
});

app.post("/heavy-calculation", async (req, res) => {
  try {
    const { iterations = 1000000 } = req.body;

    if (
      typeof iterations !== "number" ||
      iterations < 1 ||
      iterations > 10000000
    ) {
      return res.status(400).json({ error: "Invalid iterations (1-10000000)" });
    }

    console.log(
      `Main thread: Received request for heavy calculation with ${iterations} iterations`,
    );
    const startTime = Date.now();

    const result = (await performHeavyCalculation(iterations)) as any;

    const endTime = Date.now();

    return res.json({
      input: { iterations },
      ...result,
      computedInWorker: true,
      totalTimeMs: endTime - startTime,
    });
  } catch (error) {
    return res.status(500).json({ error: "Calculation failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Easythread Express server running on http://localhost:${PORT}`);
  console.log(`Try these endpoints:`);
  console.log(`   GET  /fibonacci/35`);
  console.log(`   GET  /primes/1/1000`);
  console.log(
    `   POST /heavy-calculation (with JSON body: {"iterations": 1000000})`,
  );
  console.log(`\n All heavy computations run in Worker Threads automatically!`);
});
