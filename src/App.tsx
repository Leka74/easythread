import { useState } from "react";
import styles from "./App.module.css";

/** @easythread */
function heavyTask(count: number = 1): Promise<string> {
  // emulate a heavy computation
  for (let i = 0; i < count; i++) {
    // no-op
  }
  return Promise.resolve(new Date().toISOString());
}

function App() {
  const [state, setState] = useState<string>("");
  return (
    <div className={styles.container}>
      <h1>EasyThread</h1>
      <div>{state ? state : "No state"}</div>
      <button onClick={() => heavyTask(5000000000).then(setState)}>
        Generate heavy task
      </button>
    </div>
  );
}

export default App;
