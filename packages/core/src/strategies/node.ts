import type { ImportInfo, PluginOptions, WorkerStrategy } from "../types.js";
import path from 'path';
import fs from 'fs';

export class NodeWorkerStrategy implements WorkerStrategy {
  generateWorkerSetup(
    functionName: string,
    workerCode: string,
    externalVars: string,
    _imports: ImportInfo[]
  ): string {
    const escapedWorkerFunction = workerCode
      .replace(/\\/g, "\\\\")  // Escape backslashes first
      .replace(/`/g, "\\`")    // Escape backticks for template literals
      .replace(/\$\{/g, "\\${") // Escape template literal expressions
      .replace(/'/g, "\\'")    // Escape single quotes
      .replace(/\n/g, "\\n");  // Escape newlines

    return `const ${functionName} = (...args) => {
  return new Promise((resolve, reject) => {
    const workerCode = \`${escapedWorkerFunction}\`;
    const worker = new Worker(workerCode, { eval: true });

    function handleMessage(result) {
      if (result.error) {
        const error = new Error(result.error);
        if (result.stack) {
          error.stack = result.stack;
        }
        if (result.importError) {
          error.message = \`Import Error: \${result.error}\`;
        }
        reject(error);
      } else {
        resolve(result.data);
      }
      worker.terminate();
    }

    function handleError(error) {
      const enhancedError = new Error(\`Worker Thread Error: \${error.message || error}\`);
      if (error.stack) {
        enhancedError.stack = error.stack;
      }
      reject(enhancedError);
      worker.terminate();
    }

    worker.on('message', handleMessage);
    worker.on('error', handleError);
    
    const externalVars = { ${externalVars} };
    worker.postMessage({ args, externalVars });
  });
};
`;
  }

  createWorkerRuntime(
    jsCode: string,
    functionName: string,
    isVariableDeclaration: boolean,
    imports: ImportInfo[],
    options: PluginOptions
  ): string {
    const cleanedCode = this.cleanFunctionCode(jsCode);
    let functionDeclaration = `const ${functionName} = ${cleanedCode}`;
    if (isVariableDeclaration) {
      functionDeclaration = `const ${cleanedCode}`;
    }

    const importStatements = this.generateImportStatements(imports, options);

    return `
import { parentPort } from 'worker_threads';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { performance } from 'perf_hooks';

// Make performance.now() available globally for compatibility
global.performance = performance;

parentPort.on('message', async (data) => {
  const { args, externalVars } = data;
  
  // Apply external variables to global scope
  Object.assign(global, externalVars);
  
  try {
    ${importStatements.loadCode}
    
    ${functionDeclaration}
    
    const result = await Promise.resolve(${functionName}.apply(null, args));
    parentPort.postMessage({ data: result });
  } catch (error) {
    // Enhanced error handling with better context
    const errorData = {
      error: error.message || 'Unknown error occurred',
      stack: error.stack,
      importError: false
    };
    
    // Check if this is an import-related error
    if (error.message && (
      error.message.includes('import') || 
      error.message.includes('module') ||
      error.message.includes('resolve') ||
      error.message.includes('ENOENT') ||
      error.message.includes('Cannot resolve module')
    )) {
      errorData.importError = true;
      errorData.error = \`Failed to import dependency: \${error.message}\`;
    }
    
    // Check if this is a function execution error
    if (error.message && error.message.includes('is not defined')) {
      errorData.error = \`Variable/function not found: \${error.message}. Check if all required imports are available.\`;
    }
    
    // Check for ES module related errors
    if (error.message && error.message.includes('ERR_REQUIRE_ESM')) {
      errorData.error = \`ES Module Import Error: \${error.message}. This library may need to be imported differently.\`;
      errorData.importError = true;
    }
    
    parentPort.postMessage(errorData);
  }
});
`;
  }

  private generateImportStatements(
    usedImports: ImportInfo[],
    options: PluginOptions = {}
  ): { declarations: string; loadCode: string } {
    if (usedImports.length === 0) return { declarations: "", loadCode: "" };

    const requireStatements: string[] = [];
    let hasNpmPackages = false;

    // Group imports by source
    const importsBySource = new Map<string, {
      named: Array<{ importedName: string; localName: string }>;
      default: string | null;
      namespace: string | null;
    }>();

    usedImports.forEach((importInfo) => {
      const { type, source, importedName, localName } = importInfo;

      if (!importsBySource.has(source)) {
        importsBySource.set(source, {
          named: [],
          default: null,
          namespace: null,
        });
      }

      const sourceImports = importsBySource.get(source)!;

      if (type === "named") {
        sourceImports.named.push({ importedName: importedName!, localName });
      } else if (type === "default") {
        sourceImports.default = localName;
      } else if (type === "namespace") {
        sourceImports.namespace = localName;
      }
    });

    // Generate require statements
    importsBySource.forEach((imports, source) => {
      let resolvedSource = source;
      let isNpmPackage = false;
      
      // For relative imports, resolve the path
      if (source.startsWith(".") && options.filePath) {
        // Convert relative path to absolute path for Node.js
        const fileDir = path.dirname(options.filePath);
        let resolvedPath = path.resolve(fileDir, source);
        
        // Add file extension if not present
        if (!path.extname(resolvedPath)) {
          // For Node.js workers with dynamic imports, try to find the compiled file
          // Check if we're in a src/ directory and look for corresponding dist/ file
          if (fileDir && fileDir.includes('src')) {
            const distDir = fileDir.replace(/\/src(\/|$)/, '/dist$1');
            const jsPath = path.resolve(distDir, source + '.js');
            const cjsPath = path.resolve(distDir, source + '.cjs');
            
            // For build tools, prefer .cjs files when available (CommonJS builds)
            // then .js files (ES module builds)
            if (fs.existsSync(cjsPath)) {
              resolvedPath = cjsPath;
            } else if (fs.existsSync(jsPath)) {
              resolvedPath = jsPath;
            } else {
              // Fallback: try extensions in same directory
              if (fs.existsSync(resolvedPath + '.js')) {
                resolvedPath += '.js';
              } else if (fs.existsSync(resolvedPath + '.cjs')) {
                resolvedPath += '.cjs';
              } else if (fs.existsSync(resolvedPath + '.ts')) {
                resolvedPath += '.ts';
              }
            }
          } else {
            // For direct resolution, prefer .cjs files when available (CommonJS builds)
            // then .js files (ES module builds)
            if (fs.existsSync(resolvedPath + '.cjs')) {
              resolvedPath += '.cjs';
            } else if (fs.existsSync(resolvedPath + '.js')) {
              resolvedPath += '.js';
            } else if (fs.existsSync(resolvedPath + '.ts')) {
              resolvedPath += '.ts';
            }
          }
        }
        
        resolvedSource = resolvedPath;
      } else if (!source.startsWith("/") && !source.startsWith("file://")) {
        // This is an npm package
        isNpmPackage = true;
        hasNpmPackages = true;
      }

      const moduleVar = `__module_${source.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      if (isNpmPackage) {
        // For npm packages, use createRequire to resolve from the main thread's context
        requireStatements.push(`const ${moduleVar} = await import(require.resolve('${source}'));`);
      } else {
        // Use dynamic import with file URL for better ES module support
        const fileUrl = path.isAbsolute(resolvedSource) 
          ? `pathToFileURL('${resolvedSource}').href`
          : `'${resolvedSource}'`;
        requireStatements.push(`const ${moduleVar} = await import(${fileUrl});`);
      }

      // Handle different import types
      if (imports.default) {
        requireStatements.push(`const ${imports.default} = ${moduleVar}.default || ${moduleVar};`);
      }
      
      if (imports.namespace) {
        requireStatements.push(`const ${imports.namespace} = ${moduleVar};`);
      }
      
      imports.named.forEach(({ importedName, localName }) => {
        requireStatements.push(`const ${localName} = ${moduleVar}.${importedName};`);
      });
    });

    // If we have npm packages, add createRequire setup at the beginning
    const finalStatements: string[] = [];
    if (hasNpmPackages) {
      finalStatements.push('const require = createRequire(import.meta.url);');
    }
    finalStatements.push(...requireStatements);

    return {
      declarations: "",
      loadCode: finalStatements.join('\n')
    };
  }

  private cleanFunctionCode(code: string): string {
    let cleaned = code.trim();
    
    // Remove export keyword
    cleaned = cleaned.replace(/^export\s+/, "");
    
    // Handle variable declarations (const/let/var name = ...)
    if (cleaned.match(/^(const|let|var)\s+\w+\s*=\s*/)) {
      cleaned = cleaned.replace(/^(const|let|var)\s+\w+\s*=\s*/, "");
    }
    
    // Handle function declarations - preserve async but remove function name
    if (cleaned.match(/^(async\s+)?function\s+\w+/)) {
      cleaned = cleaned.replace(/^(async\s+)?function\s+\w+/, "$1function");
    }
    
    // Remove trailing semicolons
    while (cleaned.endsWith(';')) {
      cleaned = cleaned.slice(0, -1);
    }
    
    return cleaned;
  }
}