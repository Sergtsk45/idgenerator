/**
 * @file: voice.ts
 * @description: Voice transcription (Whisper API) route
 * @dependencies: _common.ts, _openai.ts, @shared/routes, multer, express-rate-limit
 * @created: 2026-03-21
 */

import type { Express } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { api } from '@shared/routes';
import { getOpenAIClient } from './_openai';
import { appAuth } from './_common';

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
      'audio/wav', 'audio/x-wav', 'audio/mp3',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

const voiceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many voice transcription requests, please try again later" },
});

export function registerVoiceRoutes(app: Express): void {
  app.post(
    api.voice.transcribe.path,
    voiceRateLimiter,
    ...appAuth,
    (req, res, next) => {
      voiceUpload.single('audio')(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Audio file too large (max 10 MB)' });
          }
          return res.status(400).json({ message: err.message });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({ message: 'No audio file provided' });
        }

        const openai = getOpenAIClient();
        if (!openai) {
          return res.status(500).json({ message: 'OpenAI not configured (AI_INTEGRATIONS_OPENAI_API_KEY)' });
        }

        const audioFile = new File([file.buffer], file.originalname || 'audio.webm', {
          type: file.mimetype,
        });

        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'ru',
        });

        return res.status(200).json({ text: transcription.text });
      } catch (err) {
        console.error('Voice transcription failed:', err);
        return res.status(500).json({ message: 'Transcription failed' });
      } finally {
        if ((req as any).file) {
          (req as any).file.buffer = null;
        }
      }
    }
  );
}
