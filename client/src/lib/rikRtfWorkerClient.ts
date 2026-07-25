/**
 * @file: rikRtfWorkerClient.ts
 * @description: Клиентская обёртка запуска worker-парсера RTF ПК РИК.
 * @dependencies: rik-rtf.worker, rikRtfEstimateParser
 * @created: 2026-07-25
 */

import type { RikRtfEstimateParseResult } from "./rikRtfEstimateParser";

export type RikRtfWorkerParseHandle = {
  promise: Promise<RikRtfEstimateParseResult>;
  abort: () => void;
};

export function parseRikRtfEstimateInWorker(
  buffer: ArrayBuffer,
  fileName?: string,
  opts?: { timeoutMs?: number }
): RikRtfWorkerParseHandle {
  const worker = new Worker(new URL("../workers/rik-rtf.worker.ts", import.meta.url), { type: "module" });
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    worker.terminate();
  };

  const promise = new Promise<RikRtfEstimateParseResult>((resolve, reject) => {
    rejectPromise = reject;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    timeoutId = setTimeout(() => {
      finish(() => reject(new Error("RTF_IMPORT_WORKER_TIMEOUT")));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<any>) => {
      if (event.data?.type === "success") {
        finish(() => resolve(event.data.result as RikRtfEstimateParseResult));
        return;
      }
      finish(() => reject(new Error(event.data?.error?.message || "RTF_IMPORT_WORKER_FAILED")));
    };

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "RTF_IMPORT_WORKER_FAILED")));
    };

    worker.postMessage({ type: "parse", buffer, fileName }, [buffer]);
  });

  return {
    promise,
    abort: () => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise?.(new Error("RTF_IMPORT_WORKER_ABORTED"));
    },
  };
}
