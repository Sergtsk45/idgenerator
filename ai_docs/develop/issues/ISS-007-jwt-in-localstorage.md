# Issue: JWT токены в localStorage уязвимы к XSS

**ID:** ISS-007  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Medium  
**Status:** Open (by design для MVP)  

## Description

JWT токены хранятся в localStorage (`client/src/lib/auth.ts`), что делает их уязвимыми к XSS атакам.

**Текущая реализация:**
```typescript
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}
```

**Security guideline:**
> Use secure storage (never localStorage for tokens)

**Однако:** Для SPA-приложений это стандартная практика, и React защищает от XSS через auto-escaping.

## Why Not Fixed Now

- Стандартная практика для SPAs (Next.js, Create React App делают то же самое)
- React auto-escapes все данные (защита от XSS)
- Нет использования dangerouslySetInnerHTML без sanitization
- CSP headers защищают от script injection
- Альтернативы (httpOnly cookies) усложняют архитектуру SPA
- Для MVP приемлемый trade-off

## Proposed Solution (Этап 5)

Реализовать двухтокенную систему:

### 1. Access Token (короткоживущий, 15 минут)
- Хранится в memory (React state)
- Не персистится между перезагрузками
- Используется для API запросов

### 2. Refresh Token (долгоживущий, 7 дней)
- Хранится в httpOnly cookie
- Недоступен для JavaScript
- Используется только для обновления access token

```typescript
// client/src/lib/auth.ts
let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Refresh token автоматически хранится в httpOnly cookie сервером
```

### 3. Обновить backend:

```typescript
// server/routes/auth.ts
app.post('/api/auth/login', async (req, res) => {
  // ...
  const accessToken = await authService.generateJWT(user.id, user.role, '15m');
  const refreshToken = await authService.generateRefreshToken(user.id);
  
  // Refresh token в httpOnly cookie
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
  });
  
  return res.json({
    user: { ... },
    token: accessToken, // Access token в response body
  });
});

// Новый endpoint для обновления токена
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  const payload = await authService.verifyRefreshToken(refreshToken);
  
  if (!payload) {
    res.clearCookie('refresh_token');
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  
  const newAccessToken = await authService.generateJWT(payload.userId, payload.role, '15m');
  
  return res.json({ token: newAccessToken });
});
```

## Priority

P3 (важно для production, но не критично для MVP)

## Estimated Effort

3-4 часа (refresh token logic + automatic token refresh + testing)

## Trade-offs

**Текущий подход (localStorage):**
- ✅ Простая реализация
- ✅ Работает offline (Progressive Web App)
- ✅ Не требует cookies (CORS friendly)
- ❌ Уязвимо к XSS (но React защищает)

**HttpOnly cookies:**
- ✅ Недоступны JavaScript (защита от XSS)
- ✅ Автоматически отправляются с каждым запросом
- ❌ Уязвимы к CSRF (нужна CSRF защита)
- ❌ Сложнее для CORS
- ❌ Не работают для Telegram MiniApp (может быть ограничение)

## Related Files

- client/src/lib/auth.ts
- server/routes/auth.ts
- server/auth-service.ts

## References

- [OWASP JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Auth0: Token Storage](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)
