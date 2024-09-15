import { createRequire } from "module";
const require = createRequire(import.meta.url);

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const babel = require("@babel/core");
const t = require("@babel/types");

export default function transformEasyThreadFunctions(code) {
  try {
    const ast = parseCode(code);
    const transformedCode = transformCode(ast, code);
    const output = generateOutput(transformedCode, code);
    return output.code;
  } catch (error) {
    throw error;
  }
}

function parseCode(code) {
  return parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "decorators-legacy", "jsx"],
    attachComment: true,
  });
}

function transformCode(ast, code) {
  let transformedCode = "";
  let lastIndex = 0;

  traverse(ast, {
    enter(path) {
      if (shouldTransformNode(path)) {
        transformedCode += code.slice(lastIndex, path.node.start);
        transformedCode += transformNode(path.node, code);
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
        // Support for both // @easythread and /* @easythread */
        trimmedComment === "@easythread" || trimmedComment === "* @easythread"
      );
    });
  }
  return false;
}

function transformNode(node, code) {
  if (t.isVariableDeclaration(node)) {
    return transformVariableDeclaration(node, code);
  } else if (t.isFunctionDeclaration(node)) {
    return transformFunctionDeclaration(node, code);
  } else if (t.isExportNamedDeclaration(node)) {
    return transformExportNamedDeclaration(node, code);
  } else if (t.isExpressionStatement(node)) {
    return transformExpressionStatement(node, code);
  }
  return "";
}

function transformExportNamedDeclaration(node, code) {
  if (t.isVariableDeclaration(node.declaration)) {
    const transformedDeclaration = transformVariableDeclaration(
      node.declaration,
      code
    );
    return `export ${transformedDeclaration}`;
  } else if (t.isFunctionDeclaration(node.declaration)) {
    const transformedFunction = transformFunctionDeclaration(
      node.declaration,
      code
    );
    return `export ${transformedFunction}`;
  }
  return code.slice(node.start, node.end);
}

function transformVariableDeclaration(node, code) {
  let result = "";
  node.declarations.forEach((declarator) => {
    if (isTransformableFunction(declarator)) {
      const functionName = declarator.id.name;
      const functionCode = extractFunctionCode(declarator, code);
      result += createWorkerCode(functionName, functionCode, true);
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

function transformFunctionDeclaration(node, code) {
  const functionName = node.id.name;
  const functionCode = code.slice(node.start, node.end);
  return createWorkerCode(functionName, functionCode, false);
}

function createWorkerCode(functionName, functionCode, isVariableDeclaration) {
  const jsCode = removeTypeAnnotations(functionCode);
  const workerFunctionCode = createWorkerFunctionCode(
    jsCode,
    functionName,
    isVariableDeclaration
  );
  return createWorkerSetupCode(functionName, workerFunctionCode);
}

function removeTypeAnnotations(functionCode) {
  return babel.transformSync(functionCode, {
    presets: ["@babel/preset-typescript"],
    plugins: ["@babel/plugin-transform-typescript"],
    filename: "file.ts",
  }).code;
}

function createWorkerFunctionCode(jsCode, functionName, isVariableDeclaration) {
  let cleanedCode = cleanFunctionCode(jsCode);

  let functionDeclaration = `const ${functionName} = ${cleanedCode}`;
  if (isVariableDeclaration) {
    functionDeclaration = `const ${cleanedCode}`;
  }

  return `
${functionDeclaration}
self.onmessage = function(e) {
  const args = e.data;
  Promise.resolve(${functionName}.apply(null, args))
    .then(result => {
      self.postMessage({ result });
    })
    .catch(error => {
      self.postMessage({ error: error.message });
    });
};
`;
}

function createWorkerSetupCode(functionName, workerFunctionCode) {
  return `
const ${functionName} = (...args) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([\`${workerFunctionCode}\`], { type: 'text/javascript' })));

    function handleMessage(e) {
      worker.removeEventListener('message', handleMessage);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.result);
      }
      worker.terminate();
    }

    worker.addEventListener('message', handleMessage);
    worker.postMessage(args);
  });
};
`;
}

function transformExpressionStatement(node, code) {
  if (
    t.isCallExpression(node.expression) &&
    t.isFunction(node.expression.callee)
  ) {
    const functionCode = code.slice(node.start, node.end);
    return createAnonymousWorkerCode(functionCode);
  }
  return code.slice(node.start, node.end);
}

function createAnonymousWorkerCode(functionCode) {
  const jsCode = removeTypeAnnotations(functionCode);
  const workerFunctionCode = createWorkerFunctionCode(
    jsCode,
    "anonymousWorker"
  );
  return createAnonymousWorkerSetupCode(workerFunctionCode);
}

function createAnonymousWorkerSetupCode(workerFunctionCode) {
  return `
(function(...args) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([\`${workerFunctionCode}\`], { type: 'text/javascript' })));

    function handleMessage(e) {
      worker.removeEventListener('message', handleMessage);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.result);
      }
      worker.terminate();
    }

    worker.addEventListener('message', handleMessage);
    worker.postMessage(args);
  });
})();
`;
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
