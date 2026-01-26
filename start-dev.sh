#!/bin/bash
# Скрипт быстрого запуска приложения в режиме разработки

set -e

echo "🚀 Запуск TelegramJurnalRabot..."
echo ""

# Переход в директорию проекта
cd "$(dirname "$0")"

# Проверка PostgreSQL
echo "📊 Проверка PostgreSQL..."
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL не запущен!"
    echo "   Попробуйте: sudo systemctl start postgresql"
    exit 1
fi
echo "✅ PostgreSQL работает"
echo ""

# Проверка подключения к БД
echo "🔐 Проверка подключения к базе данных..."
if ! PGPASSWORD=app psql -h localhost -U app -d telegram_jurnal_rabot -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Не удалось подключиться к базе данных!"
    echo "   Проверьте настройки в .env"
    exit 1
fi
echo "✅ База данных доступна"
echo ""

# Остановка старых процессов
echo "🧹 Остановка старых процессов..."
pkill -f "tsx server/index.ts" 2>/dev/null || true
sleep 1
echo "✅ Готово"
echo ""

# Запуск приложения
echo "🎯 Запуск сервера разработки..."
echo "   URL: http://localhost:5000"
echo ""
echo "   Для остановки нажмите Ctrl+C"
echo ""

npm run dev
