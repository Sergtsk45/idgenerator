# Issue: Слабая валидация силы пароля

**ID:** ISS-005  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

Текущая валидация пароля проверяет только минимальную длину (8 символов).

Нет требований к:
- Наличию заглавных букв
- Наличию цифр
- Наличию спецсимволов

**Примеры слабых паролей, которые проходят валидацию:**
- `12345678`
- `password`
- `qwertyui`

## Why Not Fixed Now

- Для MVP достаточно минимальной длины
- Не блокирует текущую функциональность
- Требует обновления UI и error messages
- Может создать трение при регистрации (UX trade-off)

## Proposed Solution

### Вариант 1: Умеренная валидация (рекомендуется)

Требовать минимум 2 из 4 категорий:
- Строчные буквы
- Заглавные буквы
- Цифры
- Спецсимволы

```typescript
function validatePasswordStrength(password: string): { 
  valid: boolean; 
  error?: string;
  score: number; // 0-4
} {
  if (password.length < 8) {
    return { valid: false, error: 'Password too short', score: 0 };
  }
  
  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score < 2) {
    return { 
      valid: false, 
      error: 'Password must contain at least 2 of: lowercase, uppercase, numbers, special characters',
      score 
    };
  }
  
  return { valid: true, score };
}
```

### Вариант 2: Строгая валидация

Требовать все категории (может снизить conversion rate регистрации):

```typescript
if (!/[a-z]/.test(password)) return 'Must contain lowercase letter';
if (!/[A-Z]/.test(password)) return 'Must contain uppercase letter';
if (!/[0-9]/.test(password)) return 'Must contain digit';
if (!/[^a-zA-Z0-9]/.test(password)) return 'Must contain special character';
```

### Вариант 3: Использовать zxcvbn для оценки силы

```typescript
import zxcvbn from 'zxcvbn';

const result = zxcvbn(password);
if (result.score < 3) {
  return { 
    valid: false, 
    error: 'Password is too weak',
    suggestions: result.feedback.suggestions 
  };
}
```

## Priority

P4 (nice-to-have для production)

## Estimated Effort

1 час (валидация + UI + тестирование)

## Related Files

- server/routes/auth.ts
- client/src/pages/Register.tsx
- client/src/pages/Settings.tsx (для link-email)
- shared/validation.ts (новый файл)

## References

- [OWASP Password Strength](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#password-strength-controls)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html#sec5)
