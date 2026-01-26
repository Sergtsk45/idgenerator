# Настройка после перезагрузки системы

## Текущее состояние

### ✅ PostgreSQL
PostgreSQL уже настроен на автозапуск при загрузке системы.
- Служба: `postgresql.service`
- Статус: `enabled` (автозапуск включен)
- База данных: `telegram_jurnal_rabot`
- Пользователь: `app` / пароль: `app`

После перезагрузки PostgreSQL запустится автоматически.

### ⚠️ Приложение (npm run dev)
Приложение нужно запускать вручную после каждой перезагрузки.

## Варианты запуска приложения

### Вариант 1: Ручной запуск (рекомендуется для разработки)

После перезагрузки просто выполните:

```bash
cd /home/serg45/projects/TelegramJurnalRabot
npm run dev
```

Или используйте скрипт быстрого запуска (см. ниже).

### Вариант 2: Автозапуск через systemd (для production)

Если хотите, чтобы приложение запускалось автоматически, создайте systemd service:

```bash
sudo nano /etc/systemd/system/telegram-jurnal.service
```

Содержимое файла:

```ini
[Unit]
Description=Telegram Jurnal Rabot Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=serg45
WorkingDirectory=/home/serg45/projects/TelegramJurnalRabot
Environment="NODE_ENV=production"
Environment="PORT=5000"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Затем активируйте:

```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-jurnal.service
sudo systemctl start telegram-jurnal.service
```

**Важно:** Для production нужно сначала собрать приложение:
```bash
npm run build
```

### Вариант 3: Скрипт быстрого запуска (рекомендуется)

Используйте скрипт `start-dev.sh` для быстрого запуска в режиме разработки:

```bash
cd /home/serg45/projects/TelegramJurnalRabot
./start-dev.sh
```

Или используйте алиас (работает из любой директории):

```bash
tjr-dev
```

Скрипт автоматически:
- ✅ Проверяет, что PostgreSQL запущен
- ✅ Проверяет подключение к базе данных
- ✅ Останавливает старые процессы
- ✅ Запускает сервер разработки

## Проверка после перезагрузки

После перезагрузки системы проверьте:

1. **PostgreSQL работает:**
   ```bash
   systemctl status postgresql
   pg_isready -h localhost -p 5432
   ```

2. **База данных доступна:**
   ```bash
   PGPASSWORD=app psql -h localhost -U app -d telegram_jurnal_rabot -c "SELECT 1;"
   ```

3. **Запустите приложение:**
   ```bash
   cd /home/serg45/projects/TelegramJurnalRabot
   npm run dev
   ```

4. **Откройте браузер:**
   ```
   http://localhost:5000
   ```

## Устранение проблем

### PostgreSQL не запустился

```bash
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Приложение не подключается к БД

Проверьте `.env` файл:
```bash
cat /home/serg45/projects/TelegramJurnalRabot/.env
```

Должно быть:
```
DATABASE_URL=postgresql://app:app@localhost:5432/telegram_jurnal_rabot
PORT=5000
```

### Порт 5000 занят

Проверьте, что запущено на порту:
```bash
lsof -i :5000
```

Остановите старый процесс:
```bash
pkill -f "tsx server/index.ts"
```
