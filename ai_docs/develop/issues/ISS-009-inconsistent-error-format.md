# Issue: Несогласованный формат error responses

**ID:** ISS-009  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

Разные endpoints возвращают ошибки в разных форматах:

**Auth endpoints:**
```json
{ "error": "Invalid credentials" }
{ "error": "...", "details": [...] }
```

**Other endpoints:**
```json
{ "message": "Internal Server Error" }
{ "message": "Invalid id" }
```

**Admin endpoints:**
```json
{ "error": "Failed to fetch users" }
```

Это усложняет обработку ошибок на клиенте.

## Why Not Fixed Now

- Не блокирует функциональность
- Требует обновления всех endpoints
- Требует обновления клиентского error handling
- Может создать breaking changes

## Proposed Solution

### 1. Определить стандартный формат ошибок:

```typescript
// shared/types.ts
export interface ErrorResponse {
  error: string;              // Краткое описание для пользователя
  code?: string;              // Machine-readable код (для i18n)
  details?: unknown;          // Дополнительные детали (validation errors)
  timestamp?: string;         // ISO timestamp
  requestId?: string;         // Для трейсинга
}
```

### 2. Создать error handler middleware:

```typescript
// server/middleware/errorHandler.ts
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = (err as any).statusCode || 500;
  
  const response: ErrorResponse = {
    error: err.message || 'Internal Server Error',
    code: (err as any).code,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] as string,
  };
  
  // Не раскрываем детали в production
  if (process.env.NODE_ENV !== 'production') {
    response.details = (err as any).details;
  }
  
  logger.error('request.error', { ...response, stack: err.stack });
  
  res.status(statusCode).json(response);
}

app.use(errorHandler);
```

### 3. Обновить client error handling:

```typescript
// client/src/lib/api.ts
export async function apiRequest(url: string, options: RequestInit) {
  const res = await fetch(url, options);
  
  if (!res.ok) {
    const error: ErrorResponse = await res.json();
    throw new ApiError(error.error, error.code, error.details);
  }
  
  return res.json();
}

class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## Priority

P4 (nice-to-have для consistency, не критично)

## Estimated Effort

2-3 часа (стандартизация + обновление клиента)

## Related Files

- server/routes/auth.ts
- server/routes.ts
- server/middleware/errorHandler.ts (новый)
- client/src/lib/api.ts
- shared/types.ts (новый)
