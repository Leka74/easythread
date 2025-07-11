import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserWorkerStrategy } from '../../src/strategies/browser.js';
import type { ImportInfo } from '../../src/types.js';

describe('BrowserWorkerStrategy', () => {
  let strategy: BrowserWorkerStrategy;

  beforeEach(() => {
    strategy = new BrowserWorkerStrategy();
  });

  describe('generateWorkerSetup', () => {
    it('should generate valid worker setup code', () => {
      const result = strategy.generateWorkerSetup(
        'testFunction',
        'console.log("worker code")',
        'param1: param1, param2: param2',
        []
      );

      expect(result).toContain('new Blob(');
      expect(result).toContain('new Worker(');
      expect(result).toContain('testFunction');
      expect(result).toContain('param1: param1, param2: param2');
      expect(result).toContain('URL.createObjectURL');
      expect(result).toContain('worker.terminate()');
    });

    it('should generate unique blob variable names', () => {
      const result1 = strategy.generateWorkerSetup('func1', 'code1', '', []);
      const result2 = strategy.generateWorkerSetup('func2', 'code2', '', []);

      // Should contain different blob variable names
      const blobVar1 = result1.match(/__easythread_func1Blob_(\w+)/)?.[0];
      const blobVar2 = result2.match(/__easythread_func2Blob_(\w+)/)?.[0];
      
      expect(blobVar1).toBeDefined();
      expect(blobVar2).toBeDefined();
      expect(blobVar1).not.toBe(blobVar2);
    });

    it('should properly escape worker code', () => {
      const workerCodeWithSpecialChars = 'console.log(`template ${literal}`);';
      
      const result = strategy.generateWorkerSetup(
        'testFunction',
        workerCodeWithSpecialChars,
        '',
        []
      );

      // The worker code should be escaped when placed in template literal
      expect(result).toContain('\\`');
      expect(result).toContain('\\$');
    });

    it('should include error handling', () => {
      const result = strategy.generateWorkerSetup('testFunction', 'code', '', []);
      
      expect(result).toContain('handleMessage');
      expect(result).toContain('handleError');
      expect(result).toContain('addEventListener(\'message\'');
      expect(result).toContain('addEventListener(\'error\'');
      expect(result).toContain('reject(');
      expect(result).toContain('resolve(');
    });
  });

  describe('createWorkerRuntime', () => {
    it('should generate worker runtime code for function declaration', () => {
      const result = strategy.createWorkerRuntime(
        'function test(x) { return x * 2; }',
        'test',
        false,
        [],
        {}
      );

      expect(result).toContain('self.onmessage');
      expect(result).toContain('const test = ');
      expect(result).toContain('x * 2');
      expect(result).toContain('Promise.resolve(test.apply(null, args))');
      expect(result).toContain('self.postMessage');
    });

    it('should generate worker runtime code for variable declaration', () => {
      const result = strategy.createWorkerRuntime(
        'const test = (x) => x * 2;',
        'test',
        true,
        [],
        {}
      );

      // For variable declarations, the cleaned code should be used directly
      expect(result).toContain('(x) => x * 2');
      expect(result).not.toContain('const test = const test = ');
    });

    it('should include imports when provided', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        },
        {
          type: 'default',
          source: 'lodash',
          localName: 'lodash'
        }
      ];

      const result = strategy.createWorkerRuntime(
        'function test() { return helper(lodash.map([1,2,3])); }',
        'test',
        false,
        imports,
        {}
      );

      expect(result).toContain('helper');
      expect(result).toContain('lodash');
      expect(result).toContain('await import(');
    });

    it('should handle performance correctly', () => {
      const result = strategy.createWorkerRuntime(
        'function test() { return performance.now(); }',
        'test',
        false,
        [],
        {}
      );

      expect(result).toContain('performance.now');
    });

    it('should include enhanced error handling', () => {
      const result = strategy.createWorkerRuntime(
        'function test() { return 42; }',
        'test',
        false,
        [],
        {}
      );

      expect(result).toContain('catch (error)');
      expect(result).toContain('error.message');
      expect(result).toContain('error.stack');
      expect(result).toContain('importError');
      expect(result).toContain('is not defined');
    });
  });

  describe('generateDynamicImports', () => {
    it('should return empty for no imports', () => {
      const result = strategy['generateDynamicImports']([], {});
      
      expect(result.declarations).toBe('');
      expect(result.loadCode).toBe('');
    });

    it('should handle named imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy['generateDynamicImports'](imports, {});
      
      expect(result.declarations).toContain('let helper;');
      expect(result.loadCode).toContain('await import(');
      expect(result.loadCode).toContain('helper = __module0.helper;');
    });

    it('should handle default imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'default',
          source: 'lodash',
          localName: 'lodash'
        }
      ];

      const result = strategy['generateDynamicImports'](imports, {});
      
      expect(result.declarations).toContain('let lodash;');
      expect(result.loadCode).toContain('lodash = __module0.default;');
    });

    it('should handle namespace imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'namespace',
          source: './utils',
          localName: 'utils'
        }
      ];

      const result = strategy['generateDynamicImports'](imports, {});
      
      expect(result.declarations).toContain('let utils;');
      expect(result.loadCode).toContain('utils = __module0;');
    });

    it('should handle relative imports with baseURL', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy['generateDynamicImports'](imports, {});
      
      expect(result.loadCode).toContain("new URL('./utils', self.__baseURL).href");
    });

    it('should handle absolute imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: 'lodash',
          importedName: 'map',
          localName: 'map'
        }
      ];

      const result = strategy['generateDynamicImports'](imports, {});
      
      expect(result.loadCode).toContain("await import('lodash')");
      expect(result.loadCode).not.toContain('new URL(');
    });

    it('should group imports by source', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper1',
          localName: 'helper1'
        },
        {
          type: 'named',
          source: './utils',
          importedName: 'helper2',
          localName: 'helper2'
        }
      ];

      const result = strategy['generateDynamicImports'](imports, {});
      
      // Should only have one import statement for ./utils
      expect((result.loadCode.match(/await import\(/g) || []).length).toBe(1);
      expect(result.loadCode).toContain('helper1 = __module0.helper1;');
      expect(result.loadCode).toContain('helper2 = __module0.helper2;');
    });
  });

  describe('cleanFunctionCode', () => {
    it('should remove export keywords', () => {
      const code = 'export function test() { return 42; }';
      const result = strategy['cleanFunctionCode'](code);
      
      expect(result).toBe('function() { return 42; }');
    });

    it('should remove variable declarations', () => {
      const code = 'const test = (x) => x * 2;';
      const result = strategy['cleanFunctionCode'](code);
      
      expect(result).toBe('(x) => x * 2');
    });

    it('should remove function names from function declarations', () => {
      const code = 'function testFunction(x) { return x; }';
      const result = strategy['cleanFunctionCode'](code);
      
      expect(result).toBe('function(x) { return x; }');
    });

    it('should handle async functions', () => {
      const code = 'export async function test() { return 42; }';
      const result = strategy['cleanFunctionCode'](code);
      
      expect(result).toBe('async function() { return 42; }');
    });

    it('should remove trailing semicolons', () => {
      const code = 'const test = () => 42;;';
      const result = strategy['cleanFunctionCode'](code);
      
      expect(result).toBe('() => 42');
    });
  });
});