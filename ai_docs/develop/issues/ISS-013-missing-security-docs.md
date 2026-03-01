# Issue: Отсутствует документация security model

**ID:** ISS-013  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

В проекте нет документации, описывающей:
- Security model (как работает аутентификация)
- Authentication flows (JWT, Telegram, multi-provider)
- Password policies
- Rate limiting policies
- JWT configuration (TTL, algorithm, secret rotation)
- Security best practices для разработчиков

## Why Not Fixed Now

- Не блокирует разработку
- Код self-documented (комментарии в файлах)
- Для MVP достаточно README
- Документация обычно пишется после стабилизации

## Proposed Solution

Создать `docs/security.md`:

```markdown
# Security Architecture

## Overview

Система использует мультипровайдерную аутентификацию с JWT токенами.

## Authentication Providers

### 1. Email/Password
- Пароли хешируются с bcrypt (cost factor 12)
- Минимальная длина пароля: 8 символов
- Email проходит валидацию на клиенте и сервере

### 2. Telegram WebApp
- initData валидируется с HMAC-SHA256
- auth_date проверяется (max age: 600 секунд)
- Пользователи автоматически создаются при первом входе

## JWT Configuration

- **Algorithm:** HS256
- **TTL:** 7 дней (configurable via JWT_EXPIRES_IN)
- **Secret:** Загружается из JWT_SECRET env var
- **Storage:** localStorage (client-side)

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/auth/login | 5 requests | 1 minute |
| POST /api/auth/register | 3 requests | 1 hour |
| POST /api/auth/login/telegram | 5 requests | 1 minute |

## Password Policy

**Current (MVP):**
- Minimum length: 8 characters
- No complexity requirements

**Recommended (Production):**
- Minimum length: 12 characters
- At least 1 uppercase letter
- At least 1 digit
- At least 1 special character

## Security Headers

**Recommended CSP:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; ...
```

## Future Improvements

1. Refresh token rotation (httpOnly cookies)
2. Account lockout after failed attempts
3. Two-factor authentication (2FA)
4. Security audit logging
5. Password strength meter (UI)

## Threat Model

| Threat | Mitigation | Status |
|--------|-----------|--------|
| SQL Injection | Drizzle ORM (parameterized queries) | ✅ Implemented |
| XSS | React auto-escape | ✅ Implemented |
| CSRF | JWT-based API (stateless) | ✅ Not needed |
| Brute-force | Rate limiting | ✅ Implemented |
| Weak passwords | Min 8 chars validation | ⚠️ Can be improved |
| JWT theft (XSS) | CSP headers | 🔄 Planned |
| Token replay | JWT expiration | ✅ Implemented |

## Contact

Security issues: [email protected]
```

## Priority

P4 (важно для onboarding новых разработчиков)

## Estimated Effort

1-2 часа (написание + ревью)

## Related Files

- docs/security.md (новый файл)
- docs/project.md (добавить ссылку)
- README.md (добавить секцию Security)
