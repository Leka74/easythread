import { describe, it, expect, beforeEach } from 'vitest';
import { BunWorkerStrategy } from '../../src/strategies/bun.js';
import type { ImportInfo } from '../../src/types.js';

describe('BunWorkerStrategy', () => {
  let strategy: BunWorkerStrategy;

  beforeEach(() => {
    strategy = new BunWorkerStrategy();
  });

  describe('generateWorkerSetup', () => {
    it('should generate valid worker setup code with Bun-specific features', () => {
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
      expect(result).toContain('Bun Worker Error:');
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

    it('should properly escape worker code for Bun', () => {
      const workerCodeWithSpecialChars = 'console.log(`template ${literal}`);';
      
      const result = strategy.generateWorkerSetup(
        'testFunction',
        workerCodeWithSpecialChars,
        '',
        []
      );

      // The worker code should be escaped when placed in template literal
      expect(result).toContain('\\`');
      expect(result).toContain('\\${');
      expect(result).toContain('\\n');
      expect(result).toContain('\\'');
    });

    it('should include error handling with Bun-specific messaging', () => {
      const result = strategy.generateWorkerSetup('testFunction', 'code', '', []);
      
      expect(result).toContain('handleMessage');
      expect(result).toContain('handleError');
      expect(result).toContain('addEventListener(\'message\'');
      expect(result).toContain('addEventListener(\'error\'');
      expect(result).toContain('reject(');
      expect(result).toContain('resolve(');
      expect(result).toContain('Bun Worker Error:');
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

    it('should include Bun globals in worker context', () => {
      const result = strategy.createWorkerRuntime(
        'function test() { return Bun.version; }',
        'test',
        false,
        [],
        {}
      );

      expect(result).toContain('if (typeof Bun !== \'undefined\')');
      expect(result).toContain('self.Bun = Bun');
    });

    it('should include imports when provided with Bun-optimized resolution', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        },
        {
          type: 'default',
          source: 'nanoid',
          localName: 'nanoid'
        }
      ];

      const result = strategy.createWorkerRuntime(
        'function test() { return helper(nanoid()); }',
        'test',
        false,
        imports,
        { filePath: '/path/to/file.ts' }
      );

      expect(result).toContain('helper');
      expect(result).toContain('nanoid');
      expect(result).toContain('await import(');
      expect(result).toContain('file://');
    });

    it('should handle npm packages efficiently in Bun', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: 'nanoid',
          importedName: 'nanoid',
          localName: 'nanoid'
        },
        {
          type: 'default',
          source: 'lodash',
          localName: 'lodash'
        }
      ];

      const result = strategy.createWorkerRuntime(
        'function test() { return nanoid(10); }',
        'test',
        false,
        imports,
        {}
      );

      // Bun should handle npm packages directly without special resolution
      expect(result).toContain('await import(\'nanoid\')');
      expect(result).toContain('await import(\'lodash\')');
      expect(result).toContain('const nanoid = __module_nanoid.nanoid;');
      expect(result).toContain('const lodash = __module_lodash.default || __module_lodash;');
    });

    it('should include enhanced error handling with Bun-specific errors', () => {
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
      expect(result).toContain('This library may need to be imported differently in Bun');
    });

    it('should handle relative imports with file URL resolution', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './helper',
          importedName: 'calculate',
          localName: 'calculate'
        }
      ];

      const result = strategy.createWorkerRuntime(
        'function test() { return calculate(42); }',
        'test',
        false,
        imports,
        { filePath: '/Users/test/project/src/main.ts' }
      );

      expect(result).toContain('file://');
      expect(result).toContain('const calculate = __module___helper.calculate;');
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

  describe('generateImportStatements', () => {
    it('should handle relative imports with proper path resolution', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy['generateImportStatements'](imports, { 
        filePath: '/Users/test/project/src/main.ts' 
      });

      expect(result.loadCode).toContain('file://');
      expect(result.loadCode).toContain('__module___utils');
      expect(result.loadCode).toContain('const helper = __module___utils.helper;');
    });

    it('should handle npm packages with direct import', () => {
      const imports: ImportInfo[] = [
        {
          type: 'default',
          source: 'lodash',
          localName: 'lodash'
        }
      ];

      const result = strategy['generateImportStatements'](imports, {});

      expect(result.loadCode).toContain('await import(\'lodash\')');
      expect(result.loadCode).toContain('const lodash = __module_lodash.default || __module_lodash;');
    });

    it('should handle namespace imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'namespace',
          source: 'fs',
          localName: 'fs'
        }
      ];

      const result = strategy['generateImportStatements'](imports, {});

      expect(result.loadCode).toContain('await import(\'fs\')');
      expect(result.loadCode).toContain('const fs = __module_fs;');
    });

    it('should handle mixed import types from same source', () => {
      const imports: ImportInfo[] = [
        {
          type: 'default',
          source: './utils',
          localName: 'defaultExport'
        },
        {
          type: 'named',
          source: './utils',
          importedName: 'namedExport',
          localName: 'namedExport'
        }
      ];

      const result = strategy['generateImportStatements'](imports, {
        filePath: '/test/main.ts'
      });

      // Should only import once from the same source
      const importMatches = result.loadCode.match(/await import\(/g);
      expect(importMatches).toHaveLength(1);
      expect(result.loadCode).toContain('const defaultExport = __module___utils.default || __module___utils;');
      expect(result.loadCode).toContain('const namedExport = __module___utils.namedExport;');
    });
  });
});