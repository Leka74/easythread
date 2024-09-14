import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/** @easythread */
function heavyTask(count: number = 1) {
  // emulate a heavy computation
  for (let i = 0; i < count; i++) {
    // no-op
  }
  console.log("heavy task done");
}
heavyTask(1000000000);
heavyTask(1000000000);

/** @easythread */
const dataTask = async (): Promise<string> => {
  return Promise.resolve("data task from inside the worker");
};

/** @easythread */
(() => {
  console.log("Anonymous worker");
})();

dataTask().then((result) => {
  console.log(result);
});

console.log("main thread is free");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
