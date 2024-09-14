import { createRequire } from "module";
const require = createRequire(import.meta.url);

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const babel = require("@babel/core");
const t = require("@babel/types");

let tempNameCounter = 0;

function generateTempName() {
  return `temp_${tempNameCounter++}`;
}

export default function transformEasyThreadFunctions(code) {
  tempNameCounter = 0; // Reset the counter
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
      result += createWorkerCode(functionName, functionCode);
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
  return createWorkerCode(functionName, functionCode);
}

function createWorkerCode(functionName, functionCode) {
  const jsCode = removeTypeAnnotations(functionCode);
  const workerFunctionCode = createWorkerFunctionCode(jsCode);
  return createWorkerSetupCode(functionName, workerFunctionCode);
}

function removeTypeAnnotations(functionCode) {
  return babel.transformSync(functionCode, {
    presets: ["@babel/preset-typescript"],
    plugins: ["@babel/plugin-transform-typescript"],
    filename: "file.ts",
  }).code;
}

function createWorkerFunctionCode(jsCode) {
  const tempFunctionName = generateTempName();
  let cleanedCode = cleanFunctionCode(jsCode);

  return `
const ${tempFunctionName} = ${cleanedCode};
self.onmessage = function(e) {
  const { args, messageId } = e.data;
  Promise.resolve(${tempFunctionName}.apply(null, args))
    .then(result => {
      self.postMessage({ result, messageId });
    })
    .catch(error => {
      self.postMessage({ error: error.message, messageId });
    });
};
`;
}

function createWorkerSetupCode(functionName, workerFunctionCode) {
  return `
const ${functionName} = (...args) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([\`${workerFunctionCode}\`], { type: 'text/javascript' })));
    const messageId = "${generateTempName()}";

    function handleMessage(e) {
      if (e.data.messageId === messageId) {
        worker.removeEventListener('message', handleMessage);
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.result);
        }
        worker.terminate();
      }
    }

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ args, messageId });
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
  const workerFunctionCode = createWorkerFunctionCode(jsCode);
  return createAnonymousWorkerSetupCode(workerFunctionCode);
}

function createAnonymousWorkerSetupCode(workerFunctionCode) {
  return `
(function(...args) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([\`${workerFunctionCode}\`], { type: 'text/javascript' })));
    const messageId = "${generateTempName()}";

    function handleMessage(e) {
      if (e.data.messageId === messageId) {
        worker.removeEventListener('message', handleMessage);
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.result);
        }
        worker.terminate();
      }
    }

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ args, messageId });
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
    .replace(/^(export\s+)?(async\s+)?function\s+\w+/, "function")
    .replace(/^\(|\)\s*\(\s*\)\s*;?\s*$/g, "")
    .replace(/^\s*(?:async\s*)?\(\)\s*=>\s*{/, "() => {")
    .replace(/}\s*$/, "}");
}
