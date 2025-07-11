export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function calculateSum(numbers: number[]): number {
  return numbers.reduce((acc, curr) => acc + curr, 0);
}

export default {
  version: '1.0.0',
  author: 'Easythread'
};