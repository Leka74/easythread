import { createRequire } from "module";
const require = createRequire(import.meta.url);

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const babel = require("@babel/core");
const t = require("@babel/types");

let ast;
let importStatements = [];
let importBindings = new Map();

export default function transformEasyThreadFunctions(code, options = {}) {
  ast = parseCode(code);
  importStatements = [];
  importBindings = new Map();
  collectImports(ast);
  const transformedCode = transformCode(ast, code, options);
  const output = generateOutput(transformedCode, code);
  return output.code;
}

function parseCode(code) {
  return parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "decorators-legacy", "jsx"],
    attachComment: true,
  });
}

function collectImports(ast) {
  traverse(ast, {
    ImportDeclaration(path) {
      const importSource = path.node.source.value;
      const importCode = path.node;

      importStatements.push({
        source: importSource,
        node: importCode,
        start: path.node.start,
        end: path.node.end,
      });

      path.node.specifiers.forEach((specifier) => {
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

function transformCode(ast, code, options) {
  let transformedCode = "";
  let lastIndex = 0;

  traverse(ast, {
    enter(path) {
      if (shouldTransformNode(path)) {
        transformedCode += code.slice(lastIndex, path.node.start);
        transformedCode += transformNode(path.node, code, options);
        lastIndex = path.node.end;
      }
    },
  });

  transformedCode += code.slice(lastIndex);
  return transformedCode;
}

function shouldTransformNode(path) {
  if (
    path.isVariableDeclaration() ||
    path.isFunctionDeclaration() ||
    path.isExportNamedDeclaration() ||
    path.isExpressionStatement()
  ) {
    const leadingComments = path.node.leadingComments || [];
    return leadingComments.some((comment) => {
      const trimmedComment = comment.value.trim();
      return (
        trimmedComment === "@easythread" || trimmedComment === "* @easythread"
      );
    });
  }
  return false;
}

function transformNode(node, code, options) {
  if (t.isVariableDeclaration(node)) {
    return transformVariableDeclaration(node, code, options);
  } else if (t.isFunctionDeclaration(node)) {
    return transformFunctionDeclaration(node, code, options);
  } else if (t.isExportNamedDeclaration(node)) {
    return transformExportNamedDeclaration(node, code, options);
  } else if (t.isExpressionStatement(node)) {
    return transformExpressionStatement(node, code, options);
  }
  return "";
}

function transformExportNamedDeclaration(node, code, options) {
  if (t.isVariableDeclaration(node.declaration)) {
    const transformedDeclaration = transformVariableDeclaration(
      node.declaration,
      code,
      options,
    );
    return `export ${transformedDeclaration}`;
  } else if (t.isFunctionDeclaration(node.declaration)) {
    const transformedFunction = transformFunctionDeclaration(
      node.declaration,
      code,
      options,
    );
    return `export ${transformedFunction}`;
  }
  return code.slice(node.start, node.end);
}

function transformVariableDeclaration(node, code, options) {
  let result = "";
  node.declarations.forEach((declarator) => {
    if (isTransformableFunction(declarator)) {
      const functionName = declarator.id.name;
      const functionCode = extractFunctionCode(declarator, code);
      result += createWorkerCode(functionName, functionCode, true, options);
    } else {
      result += code.slice(declarator.start, declarator.end);
    }
  });
  return result;
}

function isTransformableFunction(declarator) {
  const init = declarator.init;
  const id = declarator.id;
  return (
    init &&
    (init.type === "FunctionExpression" ||
      init.type === "ArrowFunctionExpression") &&
    id.type === "Identifier"
  );
}

function extractFunctionCode(declarator, code) {
  return code.slice(declarator.start, declarator.end);
}

function transformFunctionDeclaration(node, code, options) {
  const functionName = node.id.name;
  const functionCode = code.slice(node.start, node.end);
  return createWorkerCode(functionName, functionCode, false, options);
}

function createWorkerCode(
  functionName,
  functionCode,
  isVariableDeclaration,
  options,
) {
  const jsCode = removeTypeAnnotations(functionCode);
  const { externalVarsString, usedImports } =
    getExternalVariables(functionName);
  const workerFunctionCode = createWorkerFunctionCode(
    jsCode,
    functionName,
    isVariableDeclaration,
    usedImports,
    options,
  );
  return createWorkerSetupCode(
    functionName,
    workerFunctionCode,
    options,
    externalVarsString,
  );
}

function removeTypeAnnotations(functionCode) {
  return babel.transformSync(functionCode, {
    presets: ["@babel/preset-typescript"],
    plugins: ["@babel/plugin-transform-typescript"],
    filename: "file.ts",
  }).code;
}

function createWorkerFunctionCode(
  jsCode,
  functionName,
  isVariableDeclaration,
  usedImports = [],
  options = {},
) {
  let cleanedCode = cleanFunctionCode(jsCode);
  let functionDeclaration = `const ${functionName} = ${cleanedCode}`;
  if (isVariableDeclaration) {
    functionDeclaration = `const ${cleanedCode}`;
  }

  // Generate dynamic imports for the worker
  const dynamicImports = generateDynamicImports(usedImports, options);

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
    self.postMessage({ error: error.message });
  }
};
`;
}

function generateDynamicImports(usedImports, options = {}) {
  if (usedImports.length === 0) return { declarations: "", loadCode: "" };

  const declarations = [];
  const loadStatements = [];

  const importsBySource = new Map();

  usedImports.forEach((importName) => {
    const binding = importBindings.get(importName);
    if (binding) {
      const { type, source, importedName, localName } = binding;

      if (!importsBySource.has(source)) {
        importsBySource.set(source, {
          named: [],
          default: null,
          namespace: null,
        });
      }

      const sourceImports = importsBySource.get(source);

      if (type === "named") {
        sourceImports.named.push({ importedName, localName });
      } else if (type === "default") {
        sourceImports.default = localName;
      } else if (type === "namespace") {
        sourceImports.namespace = localName;
      }
    }
  });

  let moduleIndex = 0;
  importsBySource.forEach((imports, source) => {
    const moduleVar = `__module${moduleIndex++}`;

    let resolvedSource = source;

    declarations.push(`let ${moduleVar};`);

    if (imports.default) {
      declarations.push(`let ${imports.default};`);
    }
    if (imports.namespace) {
      declarations.push(`let ${imports.namespace};`);
    }
    imports.named.forEach(({ localName }) => {
      declarations.push(`let ${localName};`);
    });

    if (source.startsWith(".")) {
      loadStatements.push(
        `${moduleVar} = await import(new URL('${resolvedSource}', self.__baseURL).href);`,
      );
    } else {
      loadStatements.push(`${moduleVar} = await import('${resolvedSource}');`);
    }

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

function createWorkerSetupCode(
  functionName,
  workerFunctionCode,
  options,
  externalVarsString = "",
) {
  const uniqueId = generateUniqueId();
  const blobVarName = `__easythread_${functionName}Blob_${uniqueId}`;

  const escapedWorkerFunction = workerFunctionCode
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
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.result);
      }
      worker.terminate();
      URL.revokeObjectURL(url);
    }

    worker.addEventListener('message', handleMessage);
    const externalVars = { ${externalVarsString} };
    const baseURL = import.meta.url;
    worker.postMessage({ args, externalVars, baseURL });
  });
};
`;
}

function getExternalVariables(functionName) {
  let externalVars = new Set();
  let usedImports = new Set();
  const workerGlobals = new Set([
    "self",
    "console",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "addEventListener",
    "removeEventListener",
    "postMessage",
    "importScripts",
    "crypto",
    "indexedDB",
    "fetch",
    "WebSocket",
    "XMLHttpRequest",
    "TextEncoder",
    "TextDecoder",
    "URL",
    "Blob",
    "Worker",
    "URLSearchParams",
    "FormData",
    "File",
    "FileReader",
    "FileList",
    "Promise",
    "Date",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Math",
    "JSON",
    "RegExp",
    "Error",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "Symbol",
    "BigInt",
    "Uint8Array",
    "Uint16Array",
    "Uint32Array",
    "Int8Array",
    "Int16Array",
    "Int32Array",
    "Float32Array",
    "Float64Array",
    "ArrayBuffer",
    "DataView",
  ]);

  traverse(ast, {
    Function(path) {
      if (
        (path.node.id && path.node.id.name === functionName) ||
        (path.parent.type === "VariableDeclarator" &&
          path.parent.id.name === functionName)
      ) {
        const functionScope = path.scope;
        const outerScope = path.parentPath.scope;

        path.traverse({
          Identifier(idPath) {
            const name = idPath.node.name;
            if (idPath.isReferencedIdentifier()) {
              const binding = idPath.scope.getBinding(name);

              // Check if this identifier is an import
              if (importBindings.has(name)) {
                usedImports.add(name);
              } else if (
                !binding ||
                (binding.scope !== functionScope &&
                  binding.scope === outerScope)
              ) {
                if (
                  !workerGlobals.has(name) &&
                  !path.node.params.some((param) => param.name === name)
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

  const functionNode = findFunctionNode(functionName);
  if (functionNode && functionNode.params) {
    functionNode.params.forEach((param) => {
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
    usedImports: Array.from(usedImports),
  };
}

function findFunctionNode(functionName) {
  let foundNode = null;
  traverse(ast, {
    Function(path) {
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

function transformExpressionStatement(node, code, options) {
  if (
    t.isCallExpression(node.expression) &&
    t.isFunction(node.expression.callee)
  ) {
    const functionCode = code.slice(node.start, node.end);
    return createAnonymousWorkerCode(functionCode, options);
  }
  return code.slice(node.start, node.end);
}

function createAnonymousWorkerCode(functionCode, options) {
  const jsCode = removeTypeAnnotations(functionCode);
  const workerFunctionCode = createWorkerFunctionCode(
    jsCode,
    "anonymousWorker",
  );
  const uniqueId = generateUniqueId();
  return createAnonymousWorkerSetupCode(workerFunctionCode, uniqueId);
}

function createAnonymousWorkerSetupCode(workerFunctionCode, uniqueId) {
  const blobVarName = `__easythread_anonymousWorkerBlob_${uniqueId}`;
  const escapedWorkerFunction = workerFunctionCode
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

function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

function generateOutput(transformedCode, originalCode) {
  const transformedAst = parseCode(transformedCode);
  return generate(transformedAst, {}, originalCode);
}

function cleanFunctionCode(code) {
  return code
    .trim()
    .replace(/^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*/, "")
    .replace(/^(export\s+)?(async\s+)?function\s+\w+/, "function")
    .replace(/^\(|\)\s*\(\s*\)\s*;?\s*$/g, "")
    .replace(/;+$/, "");
}
