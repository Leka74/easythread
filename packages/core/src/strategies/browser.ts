import type { ImportInfo, PluginOptions, WorkerStrategy } from "../types.js";

export class BrowserWorkerStrategy implements WorkerStrategy {
  generateWorkerSetup(
    functionName: string,
    workerCode: string,
    externalVars: string,
    imports: ImportInfo[]
  ): string {
    const uniqueId = this.generateUniqueId();
    const blobVarName = `__easythread_${functionName}Blob_${uniqueId}`;

    const escapedWorkerFunction = workerCode
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");

    // Generate import resolution code for main thread
    const importResolution = this.generateMainThreadImports(imports);

    return `
const ${blobVarName} = new Blob([\`${escapedWorkerFunction}\`], { type: 'text/javascript' });
const ${functionName} = async (...args) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Resolve imports on the main thread
      ${importResolution.resolveCode}
      
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
      const resolvedImports = { ${importResolution.importsObject} };
      worker.postMessage({ args, externalVars, baseURL, resolvedImports });
    } catch (error) {
      reject(new Error(\`Failed to resolve imports: \${error.message}\`));
    }
  });
};
`;
  }

  createWorkerRuntime(
    jsCode: string,
    functionName: string,
    isVariableDeclaration: boolean,
    imports: ImportInfo[],
    _options: PluginOptions
  ): string {
    const cleanedCode = this.cleanFunctionCode(jsCode);
    let functionDeclaration = `const ${functionName} = ${cleanedCode}`;
    if (isVariableDeclaration) {
      functionDeclaration = `const ${cleanedCode}`;
    }

    const importAssignments = this.generateWorkerImportAssignments(imports);

    return `
self.onmessage = async function(e) {
  const { args, externalVars, baseURL, resolvedImports } = e.data;
  Object.assign(self, externalVars);
  
  // Store the base URL for import resolution
  self.__baseURL = baseURL;
  
  try {
    // Assign resolved imports to worker scope
    ${importAssignments}
    
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


  private generateMainThreadImports(imports: ImportInfo[]): { resolveCode: string; importsObject: string } {
    if (imports.length === 0) {
      return { resolveCode: "", importsObject: "" };
    }

    const resolveStatements: string[] = [];
    const importAssignments: string[] = [];

    // Group imports by source
    const importsBySource = new Map<string, {
      named: Array<{ importedName: string; localName: string }>;
      default: string | null;
      namespace: string | null;
    }>();

    imports.forEach((importInfo) => {
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

    // Generate import resolution code
    let moduleIndex = 0;
    importsBySource.forEach((imports, source) => {
      const moduleVar = `__resolved_module_${moduleIndex++}`;
      
      resolveStatements.push(`const ${moduleVar} = await import('${source}');`);

      if (imports.default) {
        importAssignments.push(`'${imports.default}': ${moduleVar}.default`);
      }
      if (imports.namespace) {
        importAssignments.push(`'${imports.namespace}': ${moduleVar}`);
      }
      imports.named.forEach(({ importedName, localName }) => {
        importAssignments.push(`'${localName}': ${moduleVar}.${importedName}`);
      });
    });

    return {
      resolveCode: resolveStatements.join('\n      '),
      importsObject: importAssignments.join(', ')
    };
  }

  private generateWorkerImportAssignments(imports: ImportInfo[]): string {
    if (imports.length === 0) {
      return "";
    }

    const assignments: string[] = [];

    imports.forEach((importInfo) => {
      const { localName } = importInfo;
      assignments.push(`const ${localName} = resolvedImports['${localName}'];`);
    });

    return assignments.join('\n    ');
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