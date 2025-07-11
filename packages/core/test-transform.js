import { EasythreadTransformer, BrowserWorkerStrategy } from './dist/index.js';

const browserTransformer = new EasythreadTransformer(new BrowserWorkerStrategy());

const code = `
const BASE = 10;

function helper(x) {
  return x + BASE;
}

/** @easythread */
function process(data) {
  return data.map(x => helper(x * 2));
}
`;

const result = browserTransformer.transform(code);
console.log(result);
