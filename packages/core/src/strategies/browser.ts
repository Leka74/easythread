import type { ImportInfo, PluginOptions, WorkerStrategy } from "../types.js";

export class BrowserWorkerStrategy implements WorkerStrategy {
  generateWorkerSetup(
    functionName: string,
    workerCode: string,
    externalVars: string,
    _imports: ImportInfo[]
  ): string {
    const uniqueId = this.generateUniqueId();
    const blobVarName = `__easythread_${functionName}Blob_${uniqueId}`;

    const escapedWorkerFunction = workerCode
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");

    return `
const ${blobVarName} = new Blob([\`${escapedWorkerFunction}\`], { type: 'text/javascript' });
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
      reject(new Error(\`Worker Error: \${error.message || error}\`));
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

    const dynamicImports = this.generateDynamicImports(imports, options);

    return `
${dynamicImports.declarations}
self.onmessage = async function(e) {
  const { args, externalVars, baseURL } = e.data;
  Object.assign(self, externalVars);
  
  // Store the base URL for import resolution
  self.__baseURL = baseURL;
  
  try {
    ${dynamicImports.loadCode}
    
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
      error.message.includes('ENOENT')
    )) {
      errorData.importError = true;
      errorData.error = \`Failed to import dependency: \${error.message}\`;
    }
    
    // Check if this is a function execution error
    if (error.message && error.message.includes('is not defined')) {
      errorData.error = \`Variable/function not found: \${error.message}. Check if all required imports are available.\`;
    }
    
    self.postMessage(errorData);
  }
};
`;
  }

  private generateDynamicImports(
    usedImports: ImportInfo[],
    _options: PluginOptions = {}
  ): { declarations: string; loadCode: string } {
    if (usedImports.length === 0) return { declarations: "", loadCode: "" };

    const declarations: string[] = [];
    const loadStatements: string[] = [];

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

    // Generate dynamic import statements
    let moduleIndex = 0;
    importsBySource.forEach((imports, source) => {
      const moduleVar = `__module${moduleIndex++}`;

      // Keep the original source path for relative imports
      const resolvedSource = source;

      // Add module declaration
      declarations.push(`let ${moduleVar};`);

      // Add declarations for imported values
      if (imports.default) {
        declarations.push(`let ${imports.default};`);
      }
      if (imports.namespace) {
        declarations.push(`let ${imports.namespace};`);
      }
      imports.named.forEach(({ localName }) => {
        declarations.push(`let ${localName};`);
      });

      // Add load statement with proper URL resolution
      if (source.startsWith(".")) {
        loadStatements.push(
          `${moduleVar} = await import(new URL('${resolvedSource}', self.__baseURL).href);`
        );
      } else {
        loadStatements.push(`${moduleVar} = await import('${resolvedSource}');`);
      }

      // Add assignment statements
      if (imports.default) {
        loadStatements.push(`${imports.default} = ${moduleVar}.default;`);
      }
      if (imports.namespace) {
        loadStatements.push(`${imports.namespace} = ${moduleVar};`);
      }
      imports.named.forEach(({ importedName, localName }) => {
        loadStatements.push(`${localName} = ${moduleVar}.${importedName};`);
      });
    });

    return {
      declarations: declarations.join("\n"),
      loadCode: loadStatements.join("\n    "),
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
    cleaned = cleaned.replace(/;+$/, "");
    
    return cleaned;
  }
}