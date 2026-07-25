/**
 * @file: rik-rtf.worker.ts
 * @description: Web Worker для неблокирующего парсинга RTF-смет ПК РИК.
 * @dependencies: rikRtfEstimateParser
 * @created: 2026-07-25
 */

import { parseRikRtfEstimate } from "@/lib/rikRtfEstimateParser";

type WorkerRequest = {
  type: "parse";
  buffer: ArrayBuffer;
  fileName?: string;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data?.type !== "parse") return;

  try {
    const result = parseRikRtfEstimate(event.data.buffer, { fileName: event.data.fileName });
    self.postMessage({ type: "success", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
