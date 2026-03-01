# Issue: DRY violation - Email validation duplicated

**ID:** ISS-001  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

Email validation regex повторяется в трёх компонентах:
- `client/src/pages/Login.tsx:61`
- `client/src/pages/Register.tsx:38`
- `client/src/pages/Settings.tsx:68`

```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

## Why Not Fixed Now

- Не блокирующая проблема
- Не влияет на функциональность
- Текущая задача (multi-auth) более приоритетна

## Proposed Solution

Создать `client/src/lib/validation.ts`:

```typescript
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { 
  valid: boolean; 
  error?: string;
} {
  if (password.length < 8) {
    return { 
      valid: false, 
      error: 'Password must be at least 8 characters' 
    };
  }
  return { valid: true };
}
```

Обновить все три файла для использования общей функции.

## Priority

P4 (tech debt cleanup)

## Estimated Effort

15 минут

## Related Files

- client/src/pages/Login.tsx
- client/src/pages/Register.tsx
- client/src/pages/Settings.tsx
