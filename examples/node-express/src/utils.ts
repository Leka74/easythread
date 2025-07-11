export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  
  return true;
}

export function generatePrimes(limit: number): number[] {
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }
  }
  return primes;
}

export const mathConstants = {
  PI: Math.PI,
  E: Math.E,
  SQRT2: Math.SQRT2
};