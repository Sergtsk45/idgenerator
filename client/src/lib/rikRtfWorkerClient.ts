/**
 * @file: rikRtfWorkerClient.ts
 * @description: Клиентская обёртка запуска worker-парсера RTF ПК РИК.
 * @dependencies: rik-rtf.worker, rikRtfEstimateParser
 * @created: 2026-07-25
 */

import type { RikRtfEstimateParseResult } from "./rikRtfEstimateParser";

export function parseRikRtfEstimateInWorker(buffer: ArrayBuffer, fileName?: string): Promise<RikRtfEstimateParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/rik-rtf.worker.ts", import.meta.url), { type: "module" });

    worker.onmessage = (event: MessageEvent<any>) => {
      worker.terminate();
      if (event.data?.type === "success") {
        resolve(event.data.result as RikRtfEstimateParseResult);
        return;
      }
      reject(new Error(event.data?.error?.message || "RTF_IMPORT_WORKER_FAILED"));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "RTF_IMPORT_WORKER_FAILED"));
    };

    worker.postMessage({ type: "parse", buffer, fileName }, [buffer]);
  });
}
