import { describe, it, expect, beforeEach } from 'vitest';
import { EasythreadTransformer, BrowserWorkerStrategy, NodeWorkerStrategy } from '../../src/index.js';

describe('EasythreadTransformer', () => {
  let browserTransformer: EasythreadTransformer;
  let nodeTransformer: EasythreadTransformer;

  beforeEach(() => {
    browserTransformer = new EasythreadTransformer(new BrowserWorkerStrategy());
    nodeTransformer = new EasythreadTransformer(new NodeWorkerStrategy());
  });

  describe('Basic Function Transformation', () => {
    it('should transform a simple easythread function declaration', () => {
      const code = `
        /** @easythread */
        function calculateSquare(x: number): number {
          return x * x;
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('new Blob(');
      expect(result).toContain('new Worker(');
      expect(result).toContain('calculateSquare');
      expect(result).toContain('x * x');
    });

    it('should transform a simple easythread arrow function', () => {
      const code = `
        /** @easythread */
        const calculateSquare = (x: number): number => {
          return x * x;
        };
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('new Blob(');
      expect(result).toContain('calculateSquare');
      expect(result).toContain('x * x');
    });

    it('should not transform functions without @easythread comment', () => {
      const code = `
        function regularFunction(x: number): number {
          return x * x;
        }
      `;

      const result = browserTransformer.transform(code);
      expect(result).toBe(code);
    });

    it('should transform exported easythread functions', () => {
      const code = `
        /** @easythread */
        export function calculateSquare(x: number): number {
          return x * x;
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('export');
      expect(result).toContain('new Blob(');
      expect(result).toContain('calculateSquare');
    });
  });

  describe('Import Handling', () => {
    it('should handle imports in easythread functions', () => {
      const code = `
        import { helper } from './utils';
        
        /** @easythread */
        function processData(data: number[]): number {
          return helper(data);
        }
      `;

      const result = nodeTransformer.transform(code, { 
        environment: 'node',
        filePath: '/test/src/index.ts'
      });
      
      expect(result).toContain('helper');
      expect(result).toContain('import(');
    });

    it('should handle named imports correctly', () => {
      const code = `
        import { add, multiply } from './math';
        
        /** @easythread */
        function calculate(a: number, b: number): number {
          return add(a, multiply(b, 2));
        }
      `;

      const result = nodeTransformer.transform(code, {
        environment: 'node', 
        filePath: '/test/src/index.ts'
      });
      
      expect(result).toContain('add');
      expect(result).toContain('multiply');
    });

    it('should handle default imports correctly', () => {
      const code = `
        import lodash from 'lodash';
        
        /** @easythread */
        function processArray(arr: number[]): number[] {
          return lodash.map(arr, x => x * 2);
        }
      `;

      const result = nodeTransformer.transform(code, {
        environment: 'node',
        filePath: '/test/src/index.ts'
      });
      
      expect(result).toContain('lodash');
    });
  });

  describe('External Variables', () => {
    it('should detect external variables used in easythread functions', () => {
      const code = `
        const multiplier = 5;
        
        /** @easythread */
        function multiply(x: number): number {
          return x * multiplier;
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('multiplier: multiplier');
      expect(result).toContain('Object.assign(self, externalVars)');
    });

    it('should not include function parameters as external variables', () => {
      const code = `
        const multiplier = 5;
        
        /** @easythread */
        function multiply(x: number, factor: number): number {
          return x * factor * multiplier;
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('multiplier: multiplier');
      expect(result).not.toContain('x: x');
      expect(result).not.toContain('factor: factor');
    });

    it('should handle global variables correctly', () => {
      const code = `
        /** @easythread */
        function useGlobals(): number {
          return Math.random() * Date.now();
        }
      `;

      const result = browserTransformer.transform(code);
      
      // Should not include Math or Date as external vars since they're globals
      expect(result).not.toContain('Math: Math');
      expect(result).not.toContain('Date: Date');
    });
  });

  describe('TypeScript Support', () => {
    it('should remove TypeScript annotations', () => {
      const code = `
        /** @easythread */
        function processUser(user: User): string {
          return \`\${user.name} is \${user.age} years old\`;
        }
      `;

      const result = browserTransformer.transform(code);
      
      // The generated worker code should not contain TypeScript syntax in the worker function
      expect(result).toContain('processUser');
      expect(result).toContain('user.name');
      // The function itself should be transformed, but the interface might remain in main code
      const workerCodeStart = result.indexOf('self.onmessage');
      const workerCodeEnd = result.indexOf('};', workerCodeStart);
      const workerCode = result.slice(workerCodeStart, workerCodeEnd);
      
      expect(workerCode).not.toContain(': User');
      expect(workerCode).not.toContain(': string');
    });

    it('should handle generic functions', () => {
      const code = `
        /** @easythread */
        function identity<T>(value: T): T {
          return value;
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('identity');
      expect(result).toContain('return value');
      expect(result).not.toContain('<T>');
    });
  });

  describe('Environment-Specific Transformations', () => {
    it('should generate browser-compatible code for browser strategy', () => {
      const code = `
        /** @easythread */
        function calculate(x: number): number {
          return x * 2;
        }
      `;

      const result = browserTransformer.transform(code, { environment: 'browser' });
      
      expect(result).toContain('new Blob(');
      expect(result).toContain('new Worker(');
      expect(result).toContain('self.onmessage');
      expect(result).toContain('URL.createObjectURL');
    });

    it('should generate Node.js-compatible code for node strategy', () => {
      const code = `
        /** @easythread */
        function calculate(x: number): number {
          return x * 2;
        }
      `;

      const result = nodeTransformer.transform(code, { environment: 'node' });
      
      expect(result).toContain('new Worker(');
      expect(result).toContain('parentPort');
      expect(result).toContain('worker_threads');
      expect(result).toContain('eval: true');
    });

    it('should add Worker import for Node.js environment', () => {
      const code = `
        /** @easythread */
        function calculate(x: number): number {
          return x * 2;
        }
      `;

      const result = nodeTransformer.transform(code, { environment: 'node' });
      
      expect(result).toContain("import { Worker } from 'worker_threads';");
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed code gracefully', () => {
      const code = `
        /** @easythread */
        function incomplete(x: number {
          return x * 2
      `;

      expect(() => {
        browserTransformer.transform(code);
      }).toThrow();
    });

    it('should preserve code when no transformations are needed', () => {
      const code = `
        function regularFunction(x: number): number {
          return x * 2;
        }
        
        const regularVar = 5;
      `;

      const result = browserTransformer.transform(code);
      expect(result).toBe(code);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple easythread functions in same file', () => {
      const code = `
        /** @easythread */
        function add(a: number, b: number): number {
          return a + b;
        }
        
        function regularFunction() {
          return 'normal';
        }
        
        /** @easythread */
        function multiply(a: number, b: number): number {
          return a * b;
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('add');
      expect(result).toContain('multiply');
      expect(result).toContain('regularFunction');
      // Should have two worker setups
      expect((result.match(/new Blob\(/g) || []).length).toBe(2);
    });

    it('should handle nested function calls', () => {
      const code = `
        const BASE = 10;
        
        function helper(x: number): number {
          return x + BASE;
        }
        
        /** @easythread */
        function process(data: number[]): number[] {
          return data.map(x => helper(x * 2));
        }
      `;

      const result = browserTransformer.transform(code);
      
      // Should detect external variables
      expect(result).toContain('externalVars');
      expect(result).toContain('data.map');
      // Check if external variables are properly passed
      // Note: BASE is not included because it's in the same scope as the @easythread function
      expect(result).toMatch(/externalVars.*helper/);
    });

    it('should handle async functions', () => {
      const code = `
        /** @easythread */
        async function fetchAndProcess(url: string): Promise<string> {
          const response = await fetch(url);
          return await response.text();
        }
      `;

      const result = browserTransformer.transform(code);
      
      expect(result).toContain('fetchAndProcess');
      expect(result).toContain('await fetch');
      expect(result).toContain('response.text');
    });
  });
});