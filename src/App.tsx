import { useEffect, useState } from "react";
import styles from "./App.module.css";

/** @easythread */
function heavyTaskEasyThread(count: number = 1): Promise<string> {
  // emulate a heavy computation
  for (let i = 0; i < count; i++) {
    // no-op
  }
  const uuid = crypto.randomUUID();
  return Promise.resolve(uuid);
}

function heavyTaskNormal(count: number = 1): string {
  // emulate a heavy computation
  for (let i = 0; i < count; i++) {
    // no-op
  }
  const uuid = crypto.randomUUID();
  return uuid;
}

function App() {
  const [state, setState] = useState<string[]>([]);
  const [counter, setCounter] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((prev) => prev + 1);
    }, 16);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <h1>EasyThread</h1>
      <div>{counter}</div>
      <div>
        {state.length > 0
          ? state.map((v) => <div key={v}>{v}</div>)
          : "No state"}
      </div>
      <div style={{ display: "flex", columnGap: "16px" }}>
        <button
          onClick={() =>
            heavyTaskEasyThread(5000000000).then((v) =>
              setState((prev) => [...prev, v]),
            )
          }
        >
          EasyThread task
        </button>
        <button
          onClick={() => {
            const v = heavyTaskNormal(5000000000);
            setState((prev) => [...prev, v]);
          }}
        >
          Normal task
        </button>
      </div>
    </div>
  );
}

export default App;
