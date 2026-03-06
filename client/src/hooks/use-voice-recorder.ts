/**
 * @file: use-voice-recorder.ts
 * @description: Хук для записи голоса через MediaRecorder API и транскрипции через OpenAI Whisper
 * @dependencies: @/lib/telegram, @/lib/auth
 * @created: 2026-03-06
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { getTelegramInitData } from "@/lib/telegram";
import { getAuthToken } from "@/lib/auth";

const MIN_DURATION_MS = 500;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "",
] as const;

export interface UseVoiceRecorderOptions {
  maxDurationMs?: number;
  onTranscription?: (text: string) => void;
  onError?: (errorKey: string) => void;
}

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  error: string | null;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
}

function getSupportedMimeType(): string {
  for (const mime of MIME_CANDIDATES) {
    if (mime === "" || MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function getExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

function createAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};

  const jwtToken = getAuthToken();
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
    return headers;
  }

  const initData = getTelegramInitData();
  if (initData) {
    headers["X-Telegram-Init-Data"] = initData;
  }

  return headers;
}

function mapErrorToKey(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "errorPermission";
    if (err.name === "NotFoundError") return "errorNoMic";
  }
  return "errorNetwork";
}

function mapHttpErrorToKey(status: number): string {
  if (status === 413) return "errorTooLong";
  return "errorServer";
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  const { maxDurationMs = 60_000, onTranscription, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const mimeTypeRef = useRef("");
  const cancelledRef = useRef(false);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [isSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
  );

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setRecordingDuration(0);
  }, []);

  const sendAudio = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const ext = getExtension(mimeTypeRef.current);
        const formData = new FormData();
        formData.append("audio", blob, `voice-${Date.now()}.${ext}`);

        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          headers: createAuthHeaders(),
          body: formData,
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errKey = mapHttpErrorToKey(response.status);
          setError(errKey);
          onError?.(errKey);
          return;
        }

        const data = (await response.json()) as { text?: string };
        if (data.text) {
          onTranscription?.(data.text);
        }
      } catch {
        setError("errorNetwork");
        onError?.("errorNetwork");
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscription, onError],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    cancelledRef.current = false;
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) return;

    setError(null);
    cancelledRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener("stop", () => {
        setIsRecording(false);

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (maxDurationTimerRef.current) {
          clearTimeout(maxDurationTimerRef.current);
          maxDurationTimerRef.current = null;
        }

        const wasCancelled = cancelledRef.current;
        const elapsed = Date.now() - startTimeRef.current;

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;

        if (wasCancelled || elapsed < MIN_DURATION_MS) {
          chunksRef.current = [];
          setRecordingDuration(0);
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });
        chunksRef.current = [];
        setRecordingDuration(0);
        if (blob.size === 0) return;
        sendAudio(blob);
      });

      startTimeRef.current = Date.now();
      recorder.start();
      setIsRecording(true);

      intervalRef.current = setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - startTimeRef.current) / 1000,
        );
        setRecordingDuration(seconds);
      }, 1000);

      maxDurationTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxDurationMs);
    } catch (err) {
      cleanup();
      setIsRecording(false);
      const errKey = mapErrorToKey(err);
      setError(errKey);
      onError?.(errKey);
    }
  }, [isSupported, maxDurationMs, onError, sendAudio, stopRecording, cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    cancelledRef.current = true;
    recorder.stop();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
