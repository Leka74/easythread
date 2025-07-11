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
      .replace(/\\/g, "\\\\")
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
  const { args, externalVars, baseURL } = e.data;
  Object.assign(self, externalVars);
  
  // Store the base URL for import resolution
  self.__baseURL = baseURL;
  
  try {
    // Import dependencies dynamically in worker
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



  private generateWorkerImportAssignments(imports: ImportInfo[]): string {
    if (imports.length === 0) {
      return "";
    }

    // For browser workers, we'll use a different approach:
    // Create a bundled version of dependencies that can be imported
    const importStatements: string[] = [];
    
    // Add a warning comment
    importStatements.push(`// Note: npm dependencies need to be bundled for worker usage`);
    importStatements.push(`// Use a bundler like Vite/Webpack to resolve these imports`);
    
    imports.forEach((importInfo) => {
      const { type, source, importedName, localName } = importInfo;
      
      if (source.startsWith('./') || source.startsWith('../')) {
        // Relative imports - try direct import
        if (type === "named") {
          importStatements.push(`const { ${importedName} } = await import('${source}');`);
          if (importedName !== localName) {
            importStatements.push(`const ${localName} = ${importedName};`);
          }
        } else if (type === "default") {
          importStatements.push(`const ${localName} = (await import('${source}')).default;`);
        } else if (type === "namespace") {
          importStatements.push(`const ${localName} = await import('${source}');`);
        }
      } else {
        // NPM packages - require bundler support
        importStatements.push(`// Import '${source}' requires bundler resolution`);
        if (type === "named") {
          importStatements.push(`const { ${importedName}: ${localName} } = await import('${source}');`);
        } else if (type === "default") {
          importStatements.push(`const ${localName} = (await import('${source}')).default;`);
        } else if (type === "namespace") {
          importStatements.push(`const ${localName} = await import('${source}');`);
        }
      }
    });

    return importStatements.join('\n    ');
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