# Итоговая настройка для работы после перезагрузки

## ✅ Что уже настроено

### 1. PostgreSQL (автозапуск)
- ✅ Служба `postgresql.service` включена в автозапуск
- ✅ База данных `telegram_jurnal_rabot` создана
- ✅ Пользователь `app` с паролем `app` создан
- ✅ Схема базы данных применена

**После перезагрузки PostgreSQL запустится автоматически!**

### 2. Скрипты быстрого запуска
- ✅ `start-dev.sh` - скрипт запуска с проверками
- ✅ Алиас `tjr-dev` - запуск из любой директории
- ✅ Функция `tjr-help` - показать справку

### 3. Документация
- ✅ `QUICKSTART.md` - краткая инструкция
- ✅ `docs/setup-after-reboot.md` - подробная документация
- ✅ `.startup-instructions.txt` - памятка
- ✅ `README.md` обновлён

## 🚀 Как запускать после перезагрузки

### Самый простой способ:
```bash
tjr-dev
```

### Альтернативные способы:
```bash
# Через скрипт
cd /home/serg45/projects/TelegramJurnalRabot
./start-dev.sh

# Вручную
cd /home/serg45/projects/TelegramJurnalRabot
npm run dev
```

## 📋 Полезные команды

### Показать справку:
```bash
tjr-help
```

### Проверить статус PostgreSQL:
```bash
systemctl status postgresql
```

### Проверить подключение к БД:
```bash
PGPASSWORD=app psql -h localhost -U app -d telegram_jurnal_rabot -c "SELECT 1;"
```

### Остановить приложение:
```bash
pkill -f "tsx server/index.ts"
```

### Посмотреть, что запущено на порту 5000:
```bash
lsof -i :5000
```

## 🔄 Что происходит при перезагрузке

1. **Система загружается**
2. **PostgreSQL запускается автоматически** ✅
3. **Приложение НЕ запускается** (нужно запустить вручную)

## 💡 Для автозапуска приложения (опционально)

Если хотите, чтобы приложение запускалось автоматически при загрузке системы, смотрите раздел "Вариант 2: Автозапуск через systemd" в `docs/setup-after-reboot.md`.

**Важно:** Для production нужно сначала собрать приложение командой `npm run build`.

## 🎯 Следующие шаги

После перезагрузки:

1. Откройте терминал
2. Выполните: `tjr-dev`
3. Откройте браузер: http://localhost:5000
4. Готово! ✨

## 📞 Если что-то не работает

1. Проверьте PostgreSQL: `systemctl status postgresql`
2. Если не запущен: `sudo systemctl start postgresql`
3. Проверьте `.env` файл на правильность настроек
4. Смотрите логи: `tail -f ~/.cursor/projects/home-serg45-projects-TelegramJurnalRabot/terminals/*.txt`

---

**Дата настройки:** 2026-01-26  
**Версия:** 1.0
