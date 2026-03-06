# Plan: Голосовой ввод в чате (Voice-to-Text)

**Created:** 2026-03-06
**Orchestration:** orch-2026-03-06-voice-input
**Status:** ✅ Completed
**Goal:** Реализовать голосовой ввод через кнопку микрофона на главной странице чата — запись голоса → транскрипция Whisper → вставка текста в поле ввода
**Total Tasks:** 6
**Estimated Time:** 4–5 часов

---

## Архитектура решения

```
┌────────────────────┐     FormData (audio/webm)     ┌────────────────────┐
│   Browser          │ ──────────────────────────────►│   Express Server   │
│   MediaRecorder    │     POST /api/voice/transcribe │                    │
│   (use-voice-      │                                │   multer (memory)  │
│    recorder.ts)    │◄──────────────────────────────  │   → OpenAI Whisper │
│                    │     { text: "..." }             │     API            │
└────────────────────┘                                └────────────────────┘
```

### Поток данных

1. Пользователь нажимает и удерживает кнопку 🎤
2. `useVoiceRecorder` запрашивает `navigator.mediaDevices.getUserMedia({ audio: true })`
3. `MediaRecorder` пишет аудио в `audio/webm` (или `audio/ogg;codecs=opus` как fallback)
4. По отпусканию кнопки → MediaRecorder.stop() → `Blob`
5. Клиент отправляет `FormData` с полем `audio` на `POST /api/voice/transcribe`
6. Сервер принимает файл через `multer` (memoryStorage, лимит 10 MB)
7. Сервер вызывает `openai.audio.transcriptions.create({ file, model: 'whisper-1' })`
8. Ответ `{ text: "транскрибированный текст" }` → клиент вставляет в `inputValue`

### Ключевые решения

- **audio/webm** — нативно поддерживается Chrome, Edge, Telegram WebView; Whisper API принимает webm
- **memoryStorage** — аудио до 60 сек ≈ 0.5–2 MB, нет необходимости в файловой системе
- **Отдельный multer instance** для voice (по аналогии с `invoiceUpload`)
- **Текст НЕ отправляется автоматически** — вставляется в поле, пользователь редактирует и отправляет сам
- **60 секунд лимит** — авто-стоп на клиенте + проверка размера файла на сервере

---

## Tasks

- [x] VOI-001: API контракт в shared/routes.ts (✅ Completed)
- [x] VOI-002: Серверный маршрут POST /api/voice/transcribe (✅ Completed)
- [x] VOI-003: Хук useVoiceRecorder (✅ Completed)
- [x] VOI-004: Интеграция в Home.tsx (✅ Completed)
- [x] VOI-005: i18n переводы (✅ Completed)
- [x] VOI-006: Тестирование и edge cases (✅ Completed)

---

## VOI-001: API контракт в shared/routes.ts

**Приоритет:** High
**Сложность:** Simple
**Время:** 15 мин
**Файлы:** `shared/routes.ts`

### Что делать

Добавить в объект `api` новую секцию `voice` с контрактом для `POST /api/voice/transcribe`.

### Детали реализации

```typescript
voice: {
  transcribe: {
    method: 'POST' as const,
    path: '/api/voice/transcribe',
    // input — FormData (binary), не описывается Zod-схемой
    responses: {
      200: z.object({ text: z.string() }),
      400: z.object({ message: z.string() }),
      413: z.object({ message: z.string() }),
      500: z.object({ message: z.string() }),
    },
  },
},
```

### Acceptance criteria
- [ ] В `shared/routes.ts` существует `api.voice.transcribe`
- [ ] Описаны response-схемы для 200, 400, 413, 500
- [ ] Типы корректно экспортируются
- [ ] Нет ошибок TypeScript

---

## VOI-002: Серверный маршрут POST /api/voice/transcribe

**Приоритет:** High
**Сложность:** Moderate
**Время:** 45 мин
**Файлы:** `server/routes.ts`
**Зависимости:** VOI-001

### Что делать

Добавить серверный endpoint, который:
1. Принимает аудиофайл через multer (memoryStorage)
2. Валидирует: наличие файла, размер (≤ 10 MB), MIME-тип
3. Вызывает OpenAI Whisper API для транскрипции
4. Возвращает `{ text: "..." }`

### Детали реализации

**Multer конфигурация** (по аналогии с `invoiceUpload`):

```typescript
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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
```

**Маршрут:**

```typescript
app.post(
  '/api/voice/transcribe',
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
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({ message: 'OpenAI not configured' });
    }

    // Создаём File-like объект из буфера для OpenAI SDK
    const audioFile = new File([file.buffer], file.originalname || 'audio.webm', {
      type: file.mimetype,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ru', // приоритет русского, Whisper автоопределит при необходимости
    });

    res.json({ text: transcription.text });
  }
);
```

### Ключевые решения
- `language: 'ru'` — подсказка для Whisper, т.к. основная аудитория русскоязычная; Whisper корректно распознает и другие языки
- Rate limit не добавляем отдельный — уже есть общий authMiddleware
- Используем `File` constructor (доступен в Node 20+) вместо `fs.createReadStream` — т.к. работаем с memoryStorage
- Оборачиваем вызов OpenAI в try-catch с подробным сообщением об ошибке

### Acceptance criteria
- [ ] `POST /api/voice/transcribe` доступен с авторизацией
- [ ] Принимает аудиофайл в поле `audio` через FormData
- [ ] Отклоняет файлы > 10 MB (413)
- [ ] Отклоняет неподдерживаемые форматы (400)
- [ ] Возвращает `{ text: "..." }` при успешной транскрипции
- [ ] Возвращает 500 с понятным сообщением при ошибке OpenAI
- [ ] Корректно обрабатывает отсутствие OpenAI API key

---

## VOI-003: Хук useVoiceRecorder

**Приоритет:** High
**Сложность:** Complex
**Время:** 1.5 часа
**Файлы:** `client/src/hooks/use-voice-recorder.ts` (новый файл)
**Зависимости:** Нет (может разрабатываться параллельно с VOI-002)

### Что делать

Создать React-хук, инкапсулирующий всю логику записи голоса через MediaRecorder API.

### Интерфейс хука

```typescript
interface UseVoiceRecorderOptions {
  maxDurationMs?: number;       // по умолчанию 60_000
  onTranscription?: (text: string) => void;
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;         // идёт запись
  isTranscribing: boolean;      // отправка на сервер / ожидание ответа
  recordingDuration: number;    // длительность записи в секундах (обновляется каждую секунду)
  error: string | null;         // текст ошибки (i18n-ключ или человекочитаемое)
  isSupported: boolean;         // поддерживается ли MediaRecorder в текущем браузере
  startRecording: () => void;   // начать запись
  stopRecording: () => void;    // остановить запись (→ транскрипция)
  cancelRecording: () => void;  // отменить запись без отправки
}
```

### Детали реализации

**Жизненный цикл:**

```
IDLE → [startRecording] → RECORDING → [stopRecording] → TRANSCRIBING → IDLE
                             ↓                              ↑
                        [cancelRecording] ─────────────────→ ↑
                             ↓                              ↑
                        [maxDuration] ── auto-stop ────────→ ↑
```

**Ключевые моменты:**

1. **Проверка поддержки**: `navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'`
2. **Запрос разрешения**: `navigator.mediaDevices.getUserMedia({ audio: true })` — ловим `NotAllowedError`, `NotFoundError`
3. **Выбор MIME-типа**: проверяем `MediaRecorder.isTypeSupported()` в порядке: `audio/webm;codecs=opus` → `audio/webm` → `audio/ogg;codecs=opus` → `audio/mp4` → пустая строка (дефолт браузера)
4. **Таймер длительности**: `setInterval` каждые 1000 мс для обновления `recordingDuration`
5. **Авто-стоп**: по достижению `maxDurationMs` вызываем `stopRecording()`
6. **Отправка**: `fetch` с `FormData`, заголовки авторизации через `createHeaders(false)` из `queryClient.ts`
7. **Cleanup**: остановка MediaRecorder и освобождение MediaStream (`track.stop()`) при unmount

**Отправка на сервер:**

```typescript
const formData = new FormData();
formData.append('audio', blob, `voice-${Date.now()}.webm`);

const response = await fetch('/api/voice/transcribe', {
  method: 'POST',
  headers: createAuthHeaders(), // только auth-заголовки, без Content-Type (FormData сам поставит)
  body: formData,
});
```

**Обработка ошибок:**

| Ошибка | Поведение |
|--------|-----------|
| `NotAllowedError` | Ошибка: «Доступ к микрофону запрещён» |
| `NotFoundError` | Ошибка: «Микрофон не найден» |
| Сервер 413 | Ошибка: «Запись слишком длинная» |
| Сервер 500 | Ошибка: «Ошибка распознавания речи» |
| Сеть недоступна | Ошибка: «Нет соединения с сервером» |

### Acceptance criteria
- [ ] Хук корректно управляет жизненным циклом записи
- [ ] `isRecording` / `isTranscribing` корректно отражают состояние
- [ ] `recordingDuration` обновляется каждую секунду
- [ ] Авто-стоп через 60 секунд
- [ ] `cancelRecording` останавливает запись без отправки
- [ ] Все MediaStream tracks останавливаются при unmount/cancel
- [ ] Ошибки микрофона пойманы и показаны пользователю
- [ ] Авторизационные заголовки передаются при запросе

---

## VOI-004: Интеграция в Home.tsx

**Приоритет:** High
**Сложность:** Moderate
**Время:** 1 час
**Файлы:** `client/src/pages/Home.tsx`
**Зависимости:** VOI-003, VOI-005

### Что делать

Подключить `useVoiceRecorder` к существующей кнопке микрофона и добавить визуальную обратную связь.

### Детали реализации

**1. Подключение хука:**

```typescript
const {
  isRecording,
  isTranscribing,
  recordingDuration,
  error: voiceError,
  isSupported: isVoiceSupported,
  startRecording,
  stopRecording,
  cancelRecording,
} = useVoiceRecorder({
  maxDurationMs: 60_000,
  onTranscription: (text) => {
    setInputValue((prev) => (prev ? `${prev} ${text}` : text));
  },
});
```

**2. Модификация кнопки микрофона:**

Текущая кнопка (строки 344-351 в Home.tsx):
```tsx
<Button type="button" variant="ghost" size="icon"
  className="absolute right-1 bottom-1 h-8 w-8 text-muted-foreground/60">
  <Mic className="h-4 w-4" />
</Button>
```

Новая реализация:
```tsx
<Button
  type="button"
  variant="ghost"
  size="icon"
  className={cn(
    "absolute right-1 bottom-1 h-8 w-8 transition-all",
    isRecording
      ? "text-red-500 animate-pulse bg-red-50 dark:bg-red-950/30"
      : "text-muted-foreground/60",
    !isVoiceSupported && "hidden"
  )}
  disabled={isTranscribing}
  onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
  onPointerUp={() => { if (isRecording) stopRecording(); }}
  onPointerLeave={() => { if (isRecording) cancelRecording(); }}
>
  {isTranscribing ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Mic className="h-4 w-4" />
  )}
</Button>
```

**3. Индикатор записи (над полем ввода):**

Когда `isRecording === true`, показываем полоску над textarea:

```tsx
{isRecording && (
  <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-2 text-xs text-red-500">
    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
    <span>{formatDuration(recordingDuration)}</span>
    <button onClick={cancelRecording} className="ml-2 text-muted-foreground hover:text-foreground">
      <X className="h-3 w-3" />
    </button>
  </div>
)}
```

**4. Показ ошибок:**

```typescript
useEffect(() => {
  if (voiceError) {
    toast({
      title: t.voice?.errorTitle ?? (language === 'ru' ? 'Ошибка' : 'Error'),
      description: voiceError,
      variant: 'destructive',
    });
  }
}, [voiceError]);
```

**5. Форматирование таймера:**

```typescript
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

### UX-решения
- **Pointer events** вместо mouse/touch — единый API для мыши и тач-экранов
- **onPointerLeave → cancel** — если палец ушёл с кнопки, запись отменяется (предотвращает случайную отправку)
- **Кнопка скрывается** (`hidden`) если `isVoiceSupported === false`
- **Текст вставляется через append** — если в поле уже есть текст, новый добавляется через пробел
- **Textarea не блокируется** — пользователь может параллельно печатать
- **Loader2** показывается в кнопке во время транскрипции

### Acceptance criteria
- [ ] Нажатие и удержание кнопки микрофона запускает запись
- [ ] Отпускание — останавливает и отправляет на транскрипцию
- [ ] Кнопка пульсирует красным во время записи
- [ ] Таймер показывает длительность записи
- [ ] Кнопка X позволяет отменить запись
- [ ] Транскрибированный текст вставляется в поле ввода
- [ ] Ошибки показываются через toast
- [ ] Кнопка скрыта если MediaRecorder не поддерживается

---

## VOI-005: i18n переводы

**Приоритет:** Medium
**Сложность:** Simple
**Время:** 15 мин
**Файлы:** `client/src/lib/i18n.ts`
**Зависимости:** Нет (может разрабатываться параллельно)

### Что делать

Добавить секцию `voice` в оба языковых пакета (`en`, `ru`).

### Переводы

```typescript
// В секции en:
voice: {
  recording: 'Recording...',
  transcribing: 'Recognizing...',
  errorTitle: 'Voice input error',
  errorNoMic: 'Microphone not found',
  errorPermission: 'Microphone access denied. Allow access in browser settings.',
  errorTooLong: 'Recording is too long',
  errorServer: 'Speech recognition error. Try again.',
  errorNetwork: 'No connection to server',
  errorUnsupported: 'Voice input is not supported in this browser',
  holdToRecord: 'Hold to record',
  releaseToSend: 'Release to send',
},

// В секции ru:
voice: {
  recording: 'Запись...',
  transcribing: 'Распознавание...',
  errorTitle: 'Ошибка голосового ввода',
  errorNoMic: 'Микрофон не найден',
  errorPermission: 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.',
  errorTooLong: 'Запись слишком длинная',
  errorServer: 'Ошибка распознавания речи. Попробуйте ещё раз.',
  errorNetwork: 'Нет соединения с сервером',
  errorUnsupported: 'Голосовой ввод не поддерживается в этом браузере',
  holdToRecord: 'Удерживайте для записи',
  releaseToSend: 'Отпустите для отправки',
},
```

### Acceptance criteria
- [ ] Секция `voice` добавлена в `translations.en` и `translations.ru`
- [ ] Все ключи одинаковы в обоих языках
- [ ] Нет ошибок TypeScript
- [ ] Переводы стилистически соответствуют остальным

---

## VOI-006: Тестирование и edge cases

**Приоритет:** High
**Сложность:** Moderate
**Время:** 1 час
**Файлы:** Все изменённые файлы
**Зависимости:** VOI-001 — VOI-005

### Что делать

Проверить все сценарии и edge cases, исправить обнаруженные проблемы.

### Чек-лист тестирования

**Базовый сценарий:**
- [ ] Нажал → подержал → отпустил → текст появился в поле
- [ ] Текст не отправляется автоматически
- [ ] Можно отредактировать текст перед отправкой
- [ ] Повторная запись — текст добавляется к существующему

**Визуальная обратная связь:**
- [ ] Кнопка пульсирует красным во время записи
- [ ] Таймер отсчитывает секунды
- [ ] Loader показывается во время транскрипции
- [ ] Кнопка X отменяет запись

**Лимиты и ограничения:**
- [ ] Запись автоматически останавливается через 60 секунд
- [ ] Авто-стоп → транскрипция (не отмена)
- [ ] Файл > 10 MB отклоняется сервером (413)

**Обработка ошибок (клиент):**
- [ ] Нет микрофона → toast с ошибкой
- [ ] Отказ в разрешении → toast с ошибкой
- [ ] MediaRecorder не поддерживается → кнопка скрыта

**Обработка ошибок (сервер):**
- [ ] OpenAI key не настроен → 500 с сообщением
- [ ] Неподдерживаемый формат → 400
- [ ] OpenAI API timeout → 500 с сообщением

**Совместимость:**
- [ ] Chrome desktop
- [ ] Telegram WebView (Android)
- [ ] Telegram WebView (iOS) — возможно, проблемы с MediaRecorder; зафиксировать поведение
- [ ] Мобильный Safari — может потребовать `audio/mp4` fallback

**Безопасность:**
- [ ] Запрос требует авторизации (401 без токена)
- [ ] Аудио не сохраняется на сервере (только в памяти multer → сразу в OpenAI)
- [ ] Нет возможности передать вредоносный файл (fileFilter проверяет MIME-тип)

### Acceptance criteria
- [ ] Все пункты чек-листа проверены
- [ ] Критические баги исправлены
- [ ] Известные ограничения задокументированы (особенно iOS Telegram WebView)

---

## Dependencies Graph

```
VOI-001 (API контракт) ──→ VOI-002 (Серверный маршрут) ──┐
                                                          │
VOI-005 (i18n) ────────────────────────────────────────┐  │
                                                       ▼  ▼
VOI-003 (useVoiceRecorder) ──────────────────────→ VOI-004 (Home.tsx)
                                                       │
                                                       ▼
                                                  VOI-006 (Тестирование)
```

**Параллельные потоки:**
- Поток A: VOI-001 → VOI-002
- Поток B: VOI-003 (независим от сервера для разработки)
- Поток C: VOI-005 (полностью независим)
- Финал: VOI-004 (ждёт A + B + C) → VOI-006

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| iOS Telegram WebView не поддерживает MediaRecorder | Средняя | Проверить `isSupported`, скрыть кнопку; задокументировать |
| Whisper API долго отвечает (> 10 сек) | Низкая | Показывать loader с текстом «Распознавание...» |
| Пользователь говорит не на русском | Низкая | `language: 'ru'` — подсказка, Whisper автоопределяет |
| Audio chunk слишком маленький (нажал-отпустил менее 0.5 сек) | Средняя | Минимальная длительность записи: если < 500 мс, не отправлять |
| Node.js < 20 — нет `File` constructor | Низкая | Fallback: `toFile()` из openai SDK или `Blob` с метаданными |

---

## Метрики успеха

- Время от отпускания кнопки до появления текста: < 5 секунд (при нормальном интернете)
- Точность транскрипции: > 90% для русских строительных терминов
- Нет крашей/зависаний на мобильных устройствах
- Кнопка не отображается на неподдерживаемых платформах

---

## Implementation Notes

### OpenAI Whisper API
- Модель: `whisper-1`
- Поддерживаемые форматы: mp3, mp4, mpeg, mpga, m4a, wav, webm
- Максимальный размер файла: 25 MB (мы ставим лимит 10 MB)
- Возвращает plain text по умолчанию

### MediaRecorder MIME Types
- Chrome/Edge: `audio/webm;codecs=opus` ✅
- Firefox: `audio/ogg;codecs=opus` ✅
- Safari/iOS: `audio/mp4` (нужен fallback)
- Telegram WebView Android: наследует Chrome ✅
- Telegram WebView iOS: может не поддерживать MediaRecorder ⚠️

### createHeaders без Content-Type
При отправке FormData **нельзя** ставить `Content-Type: application/json` — браузер сам ставит `multipart/form-data` с boundary. Поэтому используем `createHeaders(false)` или создаём заголовки вручную.
