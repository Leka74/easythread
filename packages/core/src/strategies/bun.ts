import type { ImportInfo, PluginOptions, WorkerStrategy } from "../types.js";
import path from 'path';

export class BunWorkerStrategy implements WorkerStrategy {
  generateWorkerSetup(
    functionName: string,
    workerCode: string,
    externalVars: string,
    _imports: ImportInfo[]
  ): string {
    const uniqueId = this.generateUniqueId();
    const blobVarName = `__easythread_${functionName}Blob_${uniqueId}`;

    const escapedWorkerFunction = workerCode
      .replace(/\\/g, "\\\\")  // Escape backslashes first
      .replace(/`/g, "\\`")    // Escape backticks for template literals
      .replace(/\$\{/g, "\\${") // Escape template literal expressions
      .replace(/'/g, "\\'")    // Escape single quotes
      .replace(/\n/g, "\\n");  // Escape newlines

    return `const ${blobVarName} = new Blob([\`${escapedWorkerFunction}\`], { type: 'text/javascript' });
const ${functionName} = (...args) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(${blobVarName});
    const worker = new Worker(url, { type: 'module' });

    function handleMessage(e) {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      if (e.data.error) {
        const error = new Error(e.data.error);
        if (e.data.stack) {
          error.stack = e.data.stack;
        }
        if (e.data.importError) {
          error.message = \`Import Error: \${e.data.error}\`;
        }
        reject(error);
      } else {
        resolve(e.data.result);
      }
      worker.terminate();
      URL.revokeObjectURL(url);
    }

    function handleError(error) {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      reject(new Error(\`Bun Worker Error: \${error.message || error}\`));
      worker.terminate();
      URL.revokeObjectURL(url);
    }

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    
    const externalVars = { ${externalVars} };
    const baseURL = import.meta.url;
    worker.postMessage({ args, externalVars, baseURL });
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
self.onmessage = async function(e) {
  const { args, externalVars, baseURL } = e.data;
  
  // Store the base URL for import resolution
  self.__baseURL = baseURL;
  
  // Apply external variables to global scope safely
  try {
    for (const [key, value] of Object.entries(externalVars)) {
      if (key !== 'self' && key !== 'globalThis' && !key.startsWith('__')) {
        self[key] = value;
      }
    }
  } catch (e) {
    // Ignore readonly property errors
  }
  
  // Make Bun globals available in worker context
  if (typeof Bun !== 'undefined') {
    try {
      self.Bun = Bun;
    } catch (e) {
      // Ignore if Bun is readonly
    }
  }
  
  try {
    ${importStatements.loadCode}
    
    ${functionDeclaration}
    
    const result = await Promise.resolve(${functionName}.apply(null, args));
    self.postMessage({ result });
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
      errorData.error = \`ES Module Import Error: \${error.message}. This library may need to be imported differently in Bun.\`;
      errorData.importError = true;
    }
    
    self.postMessage(errorData);
  }
};
`;
  }

  private generateImportStatements(
    usedImports: ImportInfo[],
    options: PluginOptions = {}
  ): { declarations: string; loadCode: string } {
    if (usedImports.length === 0) return { declarations: "", loadCode: "" };

    const importStatements: string[] = [];

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

    // Generate import statements - Bun has excellent ES module support
    importsBySource.forEach((imports, source) => {
      let resolvedSource = source;
      
      // For relative imports, resolve the path using Bun's resolution
      if (source.startsWith(".") && options.filePath) {
        // Convert relative path to absolute path
        const fileDir = path.dirname(options.filePath);
        const resolvedPath = path.resolve(fileDir, source);
        
        // Bun handles extension resolution automatically
        // But we can help with explicit extensions for better compatibility
        if (!path.extname(resolvedPath)) {
          // Check for common extensions that Bun supports
          const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
          for (const ext of extensions) {
            try {
              // Bun's file API can check existence efficiently
              const testPath = resolvedPath + ext;
              resolvedSource = testPath;
              break;
            } catch {
              // Continue to next extension
            }
          }
        } else {
          resolvedSource = resolvedPath;
        }
      }

      const moduleVar = `__module_${source.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // Use dynamic import - Bun has excellent support for this
      if (source.startsWith(".")) {
        // Relative imports - use file path resolution
        const fileUrl = path.isAbsolute(resolvedSource) 
          ? `'file://${resolvedSource}'`
          : `new URL('${resolvedSource}', self.__baseURL).href`;
        importStatements.push(`const ${moduleVar} = await import(${fileUrl});`);
      } else {
        // NPM packages - Bun handles these excellently
        importStatements.push(`const ${moduleVar} = await import('${source}');`);
      }

      // Handle different import types
      if (imports.default) {
        importStatements.push(`const ${imports.default} = ${moduleVar}.default || ${moduleVar};`);
      }
      
      if (imports.namespace) {
        importStatements.push(`const ${imports.namespace} = ${moduleVar};`);
      }
      
      imports.named.forEach(({ importedName, localName }) => {
        importStatements.push(`const ${localName} = ${moduleVar}.${importedName};`);
      });
    });

    return {
      declarations: "",
      loadCode: importStatements.join('\n    ')
    };
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
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