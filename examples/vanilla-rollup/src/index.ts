import { quickSort, mergeSort, binarySearch, sortingConfig } from './algorithms';

// Generate random array for testing
function generateRandomArray(size: number): number[] {
  return Array.from({ length: size }, () => Math.floor(Math.random() * 1000));
}

// Measure execution time
function measureTime<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${label}: ${(end - start).toFixed(2)}ms`);
  return result;
}

/** @easythread */
async function sortLargeArray(algorithm: 'quick' | 'merge', data: number[]): Promise<number[]> {
  console.log(`Worker: Sorting ${data.length} items using ${algorithm} sort`);
  console.log(`Worker: Max array size allowed: ${sortingConfig.maxArraySize}`);
  
  const start = performance.now();
  
  let result: number[];
  if (algorithm === 'quick') {
    result = quickSort(data);
  } else {
    result = mergeSort(data);
  }
  
  const end = performance.now();
  console.log(`Worker: Sorting completed in ${(end - start).toFixed(2)}ms`);
  
  return result;
}

/** @easythread */
async function findInSortedArray(sortedData: number[], targets: number[]): Promise<{ target: number; index: number }[]> {
  console.log(`Worker: Searching for ${targets.length} targets in sorted array of ${sortedData.length} items`);
  
  const results: { target: number; index: number }[] = [];
  
  for (const target of targets) {
    const index = binarySearch(sortedData, target);
    results.push({ target, index });
  }
  
  console.log(`Worker: Search completed, found ${results.filter(r => r.index !== -1).length}/${targets.length} targets`);
  
  return results;
}

/** @easythread */
async function processDataChunks(data: number[], chunkSize: number = sortingConfig.defaultChunkSize): Promise<{ processedChunks: number; sum: number; average: number }> {
  console.log(`Worker: Processing data in chunks of ${chunkSize}`);
  
  let sum = 0;
  let processedChunks = 0;
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkSum = chunk.reduce((acc, val) => acc + val, 0);
    sum += chunkSum;
    processedChunks++;
    
    // Simulate some processing time
    for (let j = 0; j < 1000; j++) {
      Math.sqrt(j);
    }
  }
  
  const average = sum / data.length;
  console.log(`Worker: Processed ${processedChunks} chunks, sum=${sum}, average=${average.toFixed(2)}`);
  
  return { processedChunks, sum, average };
}

async function main() {
  console.log('Easythread Vanilla Rollup Example');
  console.log('=====================================\n');
  
  // Test data
  const smallArray = generateRandomArray(1000);
  const largeArray = generateRandomArray(10000);
  const searchTargets = [42, 123, 456, 789, 999];
  
  console.log('Running performance comparisons...\n');
  
  // 1. Compare sorting algorithms in worker threads
  console.log('1. Sorting Performance Test');
  console.log('---------------------------');
  
  const quickSortResult = await measureTime(
    () => sortLargeArray('quick', [...largeArray]),
    'Quick Sort (Worker)'
  ) as any;
  
  const mergeSortResult = await measureTime(
    () => sortLargeArray('merge', [...largeArray]),
    'Merge Sort (Worker)'
  ) as any;
  
  // Verify sorting worked
  const isQuickSorted = quickSortResult.every((val, i, arr) => i === 0 || arr[i - 1] <= val);
  const isMergeSorted = mergeSortResult.every((val, i, arr) => i === 0 || arr[i - 1] <= val);
  
  console.log(`✅ Quick sort result valid: ${isQuickSorted}`);
  console.log(`✅ Merge sort result valid: ${isMergeSorted}\n`);
  
  // 2. Search in sorted array using worker thread
  console.log('2. Binary Search Test');
  console.log('---------------------');
  
  const searchResults = await measureTime(
    () => findInSortedArray(quickSortResult, searchTargets),
    'Binary Search (Worker)'
  ) as any;
  
  console.log('Search results:');
  searchResults.forEach(({ target, index }) => {
    if (index !== -1) {
      console.log(`  Target ${target} found at index ${index}`);
    } else {
      console.log(`  Target ${target} not found`);
    }
  });
  console.log();
  
  // 3. Process data in chunks using worker thread
  console.log('3. Data Processing Test');
  console.log('-----------------------');
  
  const processingResult = await measureTime(
    () => processDataChunks(largeArray, 500),
    'Chunk Processing (Worker)'
  ) as any;
  
  console.log(`Processed ${processingResult.processedChunks} chunks`);
  console.log(`Total sum: ${processingResult.sum}`);
  console.log(`Average: ${processingResult.average.toFixed(2)}\n`);
  
  // 4. Compare with main thread execution
  console.log('4. Main Thread vs Worker Thread Comparison');
  console.log('-------------------------------------------');
  
  console.log('Worker thread tasks completed above');
  
  // Quick sort in main thread for comparison
  const mainThreadResult = measureTime(
    () => quickSort([...smallArray]),  // Use smaller array for main thread
    'Quick Sort (Main Thread - smaller array)'
  );
  
  console.log('\n Demo completed!');
  console.log('Key observations:');
  console.log('   • Heavy computations run in worker threads automatically');
  console.log('   • Main thread remains responsive');
  console.log('   • Imported functions (algorithms) work seamlessly in workers');
  console.log('   • Imported constants (sortingConfig) are available in workers');
  console.log('   • Promise-based API makes async coordination easy');
}

// Run the demo
main().catch(console.error);