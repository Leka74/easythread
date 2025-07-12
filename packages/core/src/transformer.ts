import { createRequire } from "module";
// Handle both ESM and CJS environments
const requireUrl = typeof import.meta !== 'undefined' && import.meta.url 
  ? import.meta.url 
  : typeof __filename !== 'undefined' 
    ? 'file://' + __filename 
    : 'file://' + process.cwd() + '/index.js';
const require = createRequire(requireUrl);

// Babel library types are complex and not worth typing for this use case
/* eslint-disable @typescript-eslint/no-explicit-any */

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");
const t = require("@babel/types");

import type { ImportInfo, PluginOptions, WorkerStrategy } from "./types.js";

let ast: any;
let importStatements: any[] = [];
let importBindings = new Map<string, ImportInfo>();

export class EasythreadTransformer {
  private strategy: WorkerStrategy;

  constructor(strategy: WorkerStrategy) {
    this.strategy = strategy;
  }

  transform(code: string, options: PluginOptions = {}): string {
    ast = this.parseCode(code);
    importStatements = [];
    importBindings = new Map();
    this.collectImports(ast);
    const transformedCode = this.transformCode(ast, code, options);
    
    // Add Worker import for Node.js environment if any functions were transformed
    let finalCode = transformedCode;
    if (options.environment === 'node' && transformedCode !== code) {
      // Check if the code contains worker functions
      if (transformedCode.includes('new Worker(')) {
        finalCode = `import { Worker } from 'worker_threads';\n\n${transformedCode}`;
      }
    }
    
    const output = this.generateOutput(finalCode, code);
    return output.code;
  }

  private parseCode(code: string) {
    return parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "decorators-legacy", "jsx"],
      attachComment: true,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      strictMode: false,
    });
  }

  private collectImports(ast: any) {
    traverse(ast, {
      ImportDeclaration(path: any) {
        const importSource = path.node.source.value;
        const importCode = path.node;

        importStatements.push({
          source: importSource,
          node: importCode,
          start: path.node.start,
          end: path.node.end,
        });

        path.node.specifiers.forEach((specifier: any) => {
          if (t.isImportSpecifier(specifier)) {
            const localName = specifier.local.name;
            const importedName = specifier.imported.name;
            importBindings.set(localName, {
              type: "named",
              source: importSource,
              importedName,
              localName,
            });
          } else if (t.isImportDefaultSpecifier(specifier)) {
            const localName = specifier.local.name;
            importBindings.set(localName, {
              type: "default",
              source: importSource,
              localName,
            });
          } else if (t.isImportNamespaceSpecifier(specifier)) {
            const localName = specifier.local.name;
            importBindings.set(localName, {
              type: "namespace",
              source: importSource,
              localName,
            });
          }
        });
      },
    });
  }

  private transformCode(ast: any, code: string, options: PluginOptions) {
    let transformedCode = "";
    let lastIndex = 0;

    traverse(ast, {
      enter: (path: any) => {
        if (this.shouldTransformNode(path)) {
          transformedCode += code.slice(lastIndex, path.node.start);
          transformedCode += this.transformNode(path.node, code, options);
          lastIndex = path.node.end;
        }
      },
    });

    transformedCode += code.slice(lastIndex);
    return transformedCode;
  }

  private shouldTransformNode(path: any): boolean {
    if (
      path.isVariableDeclaration() ||
      path.isFunctionDeclaration() ||
      path.isExportNamedDeclaration() ||
      path.isExpressionStatement()
    ) {
      const leadingComments = path.node.leadingComments || [];
      return leadingComments.some((comment: any) => {
        const trimmedComment = comment.value.trim();
        return (
          trimmedComment === "@easythread" || trimmedComment === "* @easythread"
        );
      });
    }
    return false;
  }

  private transformNode(node: any, code: string, options: PluginOptions): string {
    if (t.isVariableDeclaration(node)) {
      return this.transformVariableDeclaration(node, code, options);
    } else if (t.isFunctionDeclaration(node)) {
      return this.transformFunctionDeclaration(node, code, options);
    } else if (t.isExportNamedDeclaration(node)) {
      return this.transformExportNamedDeclaration(node, code, options);
    } else if (t.isExpressionStatement(node)) {
      return this.transformExpressionStatement(node, code, options);
    }
    return "";
  }

  private transformVariableDeclaration(node: any, code: string, options: PluginOptions): string {
    let result = "";
    node.declarations.forEach((declarator: any) => {
      if (this.isTransformableFunction(declarator)) {
        const functionName = declarator.id.name;
        const functionCode = this.extractFunctionCode(declarator, code);
        result += this.createWorkerCode(functionName, functionCode, true, options);
      } else {
        result += code.slice(declarator.start, declarator.end);
      }
    });
    return result;
  }

  private transformFunctionDeclaration(node: any, code: string, options: PluginOptions): string {
    const functionName = node.id.name;
    const functionCode = code.slice(node.start, node.end);
    return this.createWorkerCode(functionName, functionCode, false, options);
  }

  private transformExportNamedDeclaration(node: any, code: string, options: PluginOptions): string {
    if (t.isVariableDeclaration(node.declaration)) {
      const transformedDeclaration = this.transformVariableDeclaration(
        node.declaration,
        code,
        options
      );
      return `export ${transformedDeclaration}`;
    } else if (t.isFunctionDeclaration(node.declaration)) {
      const functionName = node.declaration.id.name;
      const functionCode = code.slice(node.declaration.start, node.declaration.end);
      const workerCode = this.createWorkerCode(functionName, functionCode, false, options);
      
      // Split the worker code into lines and add export to the function line
      const lines = workerCode.split('\n');
      const exportedLines = lines.map(line => {
        // Find the line that declares the function (not the blob)
        if (line.trim().startsWith(`const ${functionName} = `)) {
          return `export ${line}`;
        }
        return line;
      });
      
      return exportedLines.join('\n');
    }
    return code.slice(node.start, node.end);
  }

  private transformExpressionStatement(node: any, code: string, options: PluginOptions): string {
    if (
      t.isCallExpression(node.expression) &&
      t.isFunction(node.expression.callee)
    ) {
      const functionCode = code.slice(node.start, node.end);
      return this.createAnonymousWorkerCode(functionCode, options);
    }
    return code.slice(node.start, node.end);
  }

  private isTransformableFunction(declarator: any): boolean {
    const init = declarator.init;
    const id = declarator.id;
    return (
      init &&
      (init.type === "FunctionExpression" ||
        init.type === "ArrowFunctionExpression") &&
      id.type === "Identifier"
    );
  }

  private extractFunctionCode(declarator: any, code: string): string {
    return code.slice(declarator.start, declarator.end);
  }

  private createWorkerCode(
    functionName: string,
    functionCode: string,
    isVariableDeclaration: boolean,
    options: PluginOptions
  ): string {
    const jsCode = this.removeTypeAnnotations(functionCode);
    const { externalVarsString, usedImports } = this.getExternalVariables(functionName);
    const workerFunctionCode = this.strategy.createWorkerRuntime(
      jsCode,
      functionName,
      isVariableDeclaration,
      usedImports,
      options
    );
    return this.strategy.generateWorkerSetup(
      functionName,
      workerFunctionCode,
      externalVarsString,
      usedImports
    );
  }

  private createAnonymousWorkerCode(functionCode: string, options: PluginOptions): string {
    const jsCode = this.removeTypeAnnotations(functionCode);
    const workerFunctionCode = this.strategy.createWorkerRuntime(
      jsCode,
      "anonymousWorker",
      false,
      [],
      options
    );
    const uniqueId = this.generateUniqueId();
    return this.createAnonymousWorkerSetupCode(workerFunctionCode, uniqueId);
  }

  private removeTypeAnnotations(functionCode: string): string {
    try {
      const result = babel.transformSync(functionCode, {
        presets: ["@babel/preset-typescript"],
        filename: "file.ts",
      });
      return result?.code || functionCode;
    } catch (error) {
      // If Babel transformation fails, return original code
      // This handles cases where the code might have syntax that Babel can't parse
      console.warn(`TypeScript transformation failed, using original code: ${(error as Error).message}`);
      return functionCode;
    }
  }

  private getExternalVariables(functionName: string): { externalVarsString: string; usedImports: ImportInfo[] } {
    const externalVars = new Set<string>();
    const usedImports = new Set<string>();
    const workerGlobals = new Set([
      "self", "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
      "addEventListener", "removeEventListener", "postMessage", "importScripts",
      "crypto", "indexedDB", "fetch", "WebSocket", "XMLHttpRequest",
      "TextEncoder", "TextDecoder", "URL", "Blob", "Worker", "URLSearchParams",
      "FormData", "File", "FileReader", "FileList", "Promise", "Date",
      "Array", "Object", "String", "Number", "Boolean", "Math", "JSON",
      "RegExp", "Error", "Map", "Set", "WeakMap", "WeakSet", "Symbol",
      "BigInt", "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array",
      "Int16Array", "Int32Array", "Float32Array", "Float64Array",
      "ArrayBuffer", "DataView",
    ]);

    traverse(ast, {
      Function: (path: any) => {
        if (
          (path.node.id && path.node.id.name === functionName) ||
          (path.parent.type === "VariableDeclarator" &&
            path.parent.id.name === functionName)
        ) {
          const functionScope = path.scope;
          const outerScope = path.parentPath.scope;

          path.traverse({
            Identifier: (idPath: any) => {
              const name = idPath.node.name;
              if (idPath.isReferencedIdentifier()) {
                const binding = idPath.scope.getBinding(name);

                if (importBindings.has(name)) {
                  usedImports.add(name);
                } else if (
                  !binding ||
                  (binding.scope !== functionScope &&
                    binding.scope === outerScope)
                ) {
                  if (
                    !workerGlobals.has(name) &&
                    !path.node.params.some((param: any) => param.name === name) &&
                    name !== functionName // Don't include the function itself as external var
                  ) {
                    externalVars.add(name);
                  }
                }
              }
            },
          });

          path.stop();
        }
      },
    });

    const functionNode = this.findFunctionNode(functionName);
    if (functionNode && functionNode.params) {
      functionNode.params.forEach((param: any) => {
        if (t.isIdentifier(param)) {
          externalVars.delete(param.name);
        } else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
          externalVars.delete(param.left.name);
        }
      });
    }

    return {
      externalVarsString: Array.from(externalVars)
        .map((varName) => `${varName}: ${varName}`)
        .join(", "),
      usedImports: Array.from(usedImports).map(name => importBindings.get(name)!),
    };
  }

  private findFunctionNode(functionName: string): any {
    let foundNode = null;
    traverse(ast, {
      Function: (path: any) => {
        if (
          (path.node.id && path.node.id.name === functionName) ||
          (path.parent.type === "VariableDeclarator" &&
            path.parent.id.name === functionName)
        ) {
          foundNode = path.node;
          path.stop();
        }
      },
    });
    return foundNode;
  }

  private createAnonymousWorkerSetupCode(workerFunctionCode: string, uniqueId: string): string {
    const blobVarName = `__easythread_anonymousWorkerBlob_${uniqueId}`;
    const escapedWorkerFunction = workerFunctionCode
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");

    return `
const ${blobVarName} = new Blob([\`${escapedWorkerFunction}\`], { type: 'text/javascript' });
(function(...args) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(${blobVarName});
    const worker = new Worker(url);

    function handleMessage(e) {
      worker.removeEventListener('message', handleMessage);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.result);
      }
      worker.terminate();
      URL.revokeObjectURL(url);
    }

    worker.addEventListener('message', handleMessage);
    worker.postMessage(args);
  });
})();
`;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateOutput(transformedCode: string, _originalCode: string): { code: string } {
    // Return the transformed code directly since it's already been processed
    // and contains worker setup code that shouldn't be re-parsed
    return { code: transformedCode };
  }

}