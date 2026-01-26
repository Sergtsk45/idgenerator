# 🚀 Быстрый старт

## После перезагрузки системы

PostgreSQL запустится автоматически ✅

Для запуска приложения выполните одну из команд:

### Вариант 1: Используя алиас (самый простой)
```bash
tjr-dev
```

### Вариант 2: Используя скрипт
```bash
cd /home/serg45/projects/TelegramJurnalRabot
./start-dev.sh
```

### Вариант 3: Вручную
```bash
cd /home/serg45/projects/TelegramJurnalRabot
npm run dev
```

## Открыть приложение

После запуска откройте в браузере:
```
http://localhost:5000
```

## Остановка

Нажмите `Ctrl+C` в терминале, где запущено приложение.

Или:
```bash
pkill -f "tsx server/index.ts"
```

## Проблемы?

Смотрите подробную документацию:
```bash
cat docs/setup-after-reboot.md
```

---

**Совет:** Добавьте закладку в браузере на `http://localhost:5000` для быстрого доступа!
