import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NodeWorkerStrategy } from '../../src/strategies/node.js';
import type { ImportInfo } from '../../src/types.js';

// Mock modules need to be defined before vi.mock calls
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: {
    dirname: vi.fn(),
    resolve: vi.fn(), 
    extname: vi.fn(),
    isAbsolute: vi.fn()
  }
}));

// Get the mocked modules after vi.mock
const fs = await import('fs').then(m => m.default);
const path = await import('path').then(m => m.default);

describe('NodeWorkerStrategy', () => {
  let strategy: NodeWorkerStrategy;

  beforeEach(() => {
    strategy = new NodeWorkerStrategy();
    vi.clearAllMocks();
  });

  describe('generateWorkerSetup', () => {
    it('should generate valid worker setup code for Node.js', () => {
      const result = strategy.generateWorkerSetup(
        'testFunction',
        'console.log("worker code")',
        'param1: param1, param2: param2',
        []
      );

      expect(result).toContain('new Worker(');
      expect(result).toContain('testFunction');
      expect(result).toContain('param1: param1, param2: param2');
      expect(result).toContain('eval: true');
      expect(result).toContain('worker.terminate()');
    });

    it('should properly escape worker code for Node.js', () => {
      const workerCodeWithSpecialChars = `
        console.log('test');
        const template = \`hello \${world}\`;
        const backslash = '\\n';
      `;
      
      const result = strategy.generateWorkerSetup(
        'testFunction',
        workerCodeWithSpecialChars,
        '',
        []
      );

      // Check that the worker code is properly escaped in the template literal
      expect(result).toContain('const workerCode = `');
      expect(result).toContain("console.log(\\'test\\')");
      expect(result).toContain('\\`hello \\${world}\\`');
      expect(result).toContain("\\'\\\\n\\'");
    });

    it('should include enhanced error handling', () => {
      const result = strategy.generateWorkerSetup('testFunction', 'code', '', []);
      
      expect(result).toContain('handleMessage');
      expect(result).toContain('handleError');
      expect(result).toContain('worker.on(\'message\'');
      expect(result).toContain('worker.on(\'error\'');
      expect(result).toContain('result.stack');
      expect(result).toContain('importError');
    });
  });

  describe('createWorkerRuntime', () => {
    it('should generate worker runtime code with performance polyfill', () => {
      const result = strategy.createWorkerRuntime(
        'function test(x) { return x * 2; }',
        'test',
        false,
        [],
        {}
      );

      expect(result).toContain('parentPort');
      expect(result).toContain('worker_threads');
      expect(result).toContain('const { performance } = require(\'perf_hooks\')');
      expect(result).toContain('global.performance = performance');
      expect(result).toContain('const test = ');
      expect(result).toContain('x * 2');
    });

    it('should handle variable declarations correctly', () => {
      const result = strategy.createWorkerRuntime(
        'const test = (x) => x * 2;',
        'test',
        true,
        [],
        {}
      );

      expect(result).toContain('(x) => x * 2');
      expect(result).not.toContain('const test = const test = ');
    });

    it('should place function declaration after imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy.createWorkerRuntime(
        'function test() { return helper(42); }',
        'test',
        false,
        imports,
        { filePath: '/test/src/index.ts' }
      );

      // Function declaration should come after import
      const importIndex = result.indexOf('await import(');
      const functionIndex = result.indexOf('const test = ');
      
      expect(importIndex).toBeGreaterThan(-1);
      expect(functionIndex).toBeGreaterThan(-1);
      expect(functionIndex).toBeGreaterThan(importIndex);
    });

    it('should include enhanced error handling with Node.js specific errors', () => {
      const result = strategy.createWorkerRuntime(
        'function test() { return 42; }',
        'test',
        false,
        [],
        {}
      );

      expect(result).toContain('catch (error)');
      expect(result).toContain('ERR_REQUIRE_ESM');
      expect(result).toContain('Cannot resolve module');
      expect(result).toContain('is not defined');
      expect(result).toContain('importError');
    });
  });

  describe('generateImportStatements', () => {
    beforeEach(() => {
      // Setup default mocks
      path.dirname.mockReturnValue('/test/src');
      path.resolve.mockImplementation((dir, file) => `${dir}/${file}`);
      path.extname.mockImplementation((file) => {
        if (file.endsWith('.js')) return '.js';
        if (file.endsWith('.cjs')) return '.cjs';
        if (file.endsWith('.ts')) return '.ts';
        return '';
      });
      path.isAbsolute.mockImplementation((file) => file.startsWith('/'));
      fs.existsSync.mockReturnValue(true);
    });

    it('should return empty for no imports', () => {
      const result = strategy['generateImportStatements']([], {});
      
      expect(result.declarations).toBe('');
      expect(result.loadCode).toBe('');
    });

    it('should handle named imports with pathToFileURL', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy['generateImportStatements'](imports, { 
        filePath: '/test/src/index.ts' 
      });
      
      expect(result.loadCode).toContain('await import(pathToFileURL(');
      expect(result.loadCode).toContain('const helper = __module___utils.helper;');
    });

    it('should handle default imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'default',
          source: 'lodash',
          localName: 'lodash'
        }
      ];

      const result = strategy['generateImportStatements'](imports, {});
      
      expect(result.loadCode).toContain('const lodash = __module_lodash.default || __module_lodash;');
    });

    it('should handle namespace imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'namespace',
          source: './utils',
          localName: 'utils'
        }
      ];

      const result = strategy['generateImportStatements'](imports, { 
        filePath: '/test/src/index.ts' 
      });
      
      expect(result.loadCode).toContain('const utils = __module___utils;');
    });

    it('should prefer .cjs files when they exist', () => {
      // Mock file existence: .cjs exists, .js doesn't
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('.cjs');
      });

      path.resolve.mockImplementation((dir, file) => {
        if (file === './utils.cjs') return '/test/dist/utils.cjs';
        if (file === './utils.js') return '/test/dist/utils.js';
        return `${dir}/${file}`;
      });

      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy['generateImportStatements'](imports, { 
        filePath: '/test/src/index.ts' 
      });
      
      expect(result.loadCode).toContain('.cjs');
    });

    it('should handle src to dist directory mapping', () => {
      path.dirname.mockReturnValue('/test/src');
      path.resolve.mockImplementation((dir, file) => {
        if (dir.includes('dist')) return `/test/dist/${file.replace('./', '')}`;
        return `${dir}/${file}`;
      });

      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: './utils',
          importedName: 'helper',
          localName: 'helper'
        }
      ];

      const result = strategy['generateImportStatements'](imports, { 
        filePath: '/test/src/index.ts' 
      });
      
      expect(result.loadCode).toContain('/test/dist/');
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

      const result = strategy['generateImportStatements'](imports, { 
        filePath: '/test/src/index.ts' 
      });
      
      // Should only have one import statement for ./utils
      expect((result.loadCode.match(/await import\(/g) || []).length).toBe(1);
      expect(result.loadCode).toContain('helper1 = __module___utils.helper1;');
      expect(result.loadCode).toContain('helper2 = __module___utils.helper2;');
    });

    it('should handle absolute module imports', () => {
      const imports: ImportInfo[] = [
        {
          type: 'named',
          source: 'lodash',
          importedName: 'map',
          localName: 'map'
        }
      ];

      const result = strategy['generateImportStatements'](imports, {});
      
      expect(result.loadCode).toContain("await import('lodash')");
      expect(result.loadCode).not.toContain('pathToFileURL');
    });
  });

  describe('cleanFunctionCode', () => {
    it('should clean function code the same as browser strategy', () => {
      const testCases = [
        {
          input: 'export function test() { return 42; }',
          expected: 'function() { return 42; }'
        },
        {
          input: 'const test = (x) => x * 2;',
          expected: '(x) => x * 2'
        },
        {
          input: 'export async function test() { return 42; }',
          expected: 'async function() { return 42; }'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = strategy['cleanFunctionCode'](input);
        expect(result).toBe(expected);
      });
    });
  });
});