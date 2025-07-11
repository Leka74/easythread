import { formatNumber, calculateSum } from "./utils";
import utilsDefault from "./utils";

/** @easythread */
async function processNumbers(): Promise<string> {
  const numbers = Array.from({ length: 10000000 }, (_, i) => i + 1);
  const sum = calculateSum(numbers);
  calculateSum(numbers);
  const formatted = formatNumber(sum);
  console.log("Using utils version:", utilsDefault.version);
  return `Total: ${formatted}`;
}

export function TestImports() {
  const handleClick = async () => {
    processNumbers().then(console.log);
    console.log("processing numbers with imports");
  };

  return (
    <div>
      <h3>Test Import Support</h3>
      <button onClick={handleClick}>Process Numbers with Imports</button>
    </div>
  );
}
