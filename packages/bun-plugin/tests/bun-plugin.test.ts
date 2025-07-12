import { describe, it, expect, beforeEach, vi } from 'vitest';
import easythreadPlugin from '../src/index.js';

// Mock Bun APIs
const mockBun = {
  file: vi.fn(),
  build: vi.fn()
};

// Mock the file API
const mockFile = {
  text: vi.fn()
};

// Mock build context
const mockBuild = {
  onLoad: vi.fn()
};

// Set up global Bun mock
globalThis.Bun = mockBun as any;

describe('Bun Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('plugin creation', () => {
    it('should create a plugin with correct name', () => {
      const plugin = easythreadPlugin();
      
      expect(plugin.name).toBe('bun-plugin-easythread');
      expect(plugin.setup).toBeDefined();
      expect(typeof plugin.setup).toBe('function');
    });

    it('should create plugin with custom options', () => {
      const customFilter = /\.custom$/;
      const plugin = easythreadPlugin({ 
        filter: customFilter,
        namespace: 'custom'
      });
      
      expect(plugin.name).toBe('bun-plugin-easythread');
      expect(plugin.setup).toBeDefined();
    });

    it('should use default filter when none provided', () => {
      const plugin = easythreadPlugin();
      
      // Setup the plugin and verify it calls onLoad with default filter
      plugin.setup(mockBuild as any);
      
      expect(mockBuild.onLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.any(RegExp),
          namespace: 'file'
        }),
        expect.any(Function)
      );
    });
  });

  describe('plugin setup', () => {
    it('should register onLoad hook with correct parameters', () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      expect(mockBuild.onLoad).toHaveBeenCalledTimes(1);
      
      const [config, callback] = mockBuild.onLoad.mock.calls[0];
      expect(config.filter).toEqual(/\.(js|jsx|ts|tsx)$/);
      expect(config.namespace).toBe('file');
      expect(typeof callback).toBe('function');
    });

    it('should use custom filter and namespace', () => {
      const customFilter = /\.test$/;
      const plugin = easythreadPlugin({
        filter: customFilter,
        namespace: 'test'
      });
      
      plugin.setup(mockBuild as any);

      const [config] = mockBuild.onLoad.mock.calls[0];
      expect(config.filter).toBe(customFilter);
      expect(config.namespace).toBe('test');
    });
  });

  describe('onLoad callback', () => {
    it('should return undefined when no easythread functions found', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      const mockArgs = { path: '/test/file.js' };
      
      // Mock file content without easythread functions
      mockFile.text.mockResolvedValue(`
        function normalFunction(x) {
          return x * 2;
        }
        export { normalFunction };
      `);
      mockBun.file.mockReturnValue(mockFile);

      const result = await callback(mockArgs);
      expect(result).toBeUndefined();
      expect(mockBun.file).toHaveBeenCalledWith('/test/file.js');
    });

    it('should transform code when easythread functions found', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      const mockArgs = { path: '/test/file.js' };
      
      // Mock file content with easythread function
      mockFile.text.mockResolvedValue(`
        /** @easythread */
        function heavyFunction(x) {
          return x * 2;
        }
        export { heavyFunction };
      `);
      mockBun.file.mockReturnValue(mockFile);

      const result = await callback(mockArgs);
      
      expect(result).toBeDefined();
      expect(result.contents).toContain('new Blob');
      expect(result.contents).toContain('new Worker');
      expect(result.contents).toContain('heavyFunction');
      expect(result.loader).toBe('js');
    });

    it('should determine correct loader based on file extension', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      
      mockFile.text.mockResolvedValue(`
        /** @easythread */
        function test() { return 42; }
      `);
      mockBun.file.mockReturnValue(mockFile);

      // Test TypeScript file
      let result = await callback({ path: '/test/file.ts' });
      expect(result.loader).toBe('ts');

      // Test TSX file
      result = await callback({ path: '/test/file.tsx' });
      expect(result.loader).toBe('tsx');

      // Test JSX file
      result = await callback({ path: '/test/file.jsx' });
      expect(result.loader).toBe('jsx');

      // Test JS file
      result = await callback({ path: '/test/file.js' });
      expect(result.loader).toBe('js');
    });

    it('should handle file read errors gracefully', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      const mockArgs = { path: '/test/nonexistent.js' };
      
      // Mock file read error
      mockFile.text.mockRejectedValue(new Error('File not found'));
      mockBun.file.mockReturnValue(mockFile);

      const result = await callback(mockArgs);
      
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.errors[0].text).toContain('Failed to transform');
      expect(result.errors[0].text).toContain('File not found');
    });

    it('should handle transformation errors gracefully', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      const mockArgs = { path: '/test/invalid.js' };
      
      // Mock file content with invalid syntax that might cause transformation error
      mockFile.text.mockResolvedValue(`
        /** @easythread */
        function invalid syntax here
      `);
      mockBun.file.mockReturnValue(mockFile);

      const result = await callback(mockArgs);
      
      // Should either return undefined (no transformation) or error
      if (result && result.errors) {
        expect(result.errors).toBeDefined();
        expect(result.errors[0].text).toContain('Failed to transform');
      }
    });
  });

  describe('plugin options', () => {
    it('should pass environment as "bun" to transformer', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      const mockArgs = { path: '/test/file.js' };
      
      mockFile.text.mockResolvedValue(`
        /** @easythread */
        function test() { return 42; }
      `);
      mockBun.file.mockReturnValue(mockFile);

      const result = await callback(mockArgs);
      
      // The transformation should include Bun-specific features
      if (result && result.contents) {
        expect(result.contents).toContain('Bun Worker Error');
      }
    });

    it('should include filePath in transformation options', async () => {
      const plugin = easythreadPlugin();
      plugin.setup(mockBuild as any);

      const callback = mockBuild.onLoad.mock.calls[0][1];
      const testPath = '/test/specific/file.js';
      const mockArgs = { path: testPath };
      
      mockFile.text.mockResolvedValue(`
        /** @easythread */
        function test() { return 42; }
      `);
      mockBun.file.mockReturnValue(mockFile);

      await callback(mockArgs);
      
      // Verify that Bun.file was called with the correct path
      expect(mockBun.file).toHaveBeenCalledWith(testPath);
    });
  });

  describe('named exports', () => {
    it('should export plugin as both default and named export', async () => {
      // Test default export
      expect(easythreadPlugin).toBeDefined();
      expect(typeof easythreadPlugin).toBe('function');

      // Test named export using dynamic import
      const module = await import('../src/index.js');
      expect(module.easythreadPlugin).toBeDefined();
      expect(module.easythreadPlugin).toBe(easythreadPlugin);
    });
  });
});