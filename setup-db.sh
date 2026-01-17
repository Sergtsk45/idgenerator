#!/bin/bash
# Скрипт для настройки базы данных PostgreSQL

echo "Настройка базы данных PostgreSQL для TelegramJurnalRabot..."
echo ""

# Проверка наличия PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "Ошибка: PostgreSQL не установлен"
    exit 1
fi

# Запрос пароля для пользователя postgres
echo "Введите пароль для пользователя postgres (или нажмите Enter для использования текущего пользователя):"
read -s POSTGRES_PASSWORD

DB_NAME="telegram_jurnal_rabot"
DB_USER="${USER:-serg45}"

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "Попытка создать базу данных от имени текущего пользователя..."
    createdb "$DB_NAME" 2>/dev/null && echo "База данных $DB_NAME создана успешно!" || echo "Не удалось создать базу данных. Попробуйте выполнить вручную:"
    echo "  sudo -u postgres psql"
    echo "  CREATE DATABASE $DB_NAME;"
    echo "  CREATE USER $DB_USER WITH PASSWORD 'ваш_пароль';"
    echo "  GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    echo ""
    echo "Затем обновите DATABASE_URL в файле .env:"
    echo "  DATABASE_URL=postgresql://$DB_USER:ваш_пароль@localhost:5432/$DB_NAME"
else
    echo "Создание базы данных через пользователя postgres..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -h localhost -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
    PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -h localhost -c "CREATE USER $DB_USER WITH PASSWORD 'changeme123';" 2>/dev/null || true
    PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null
    
    echo ""
    echo "База данных настроена! Обновите DATABASE_URL в файле .env:"
    echo "  DATABASE_URL=postgresql://$DB_USER:changeme123@localhost:5432/$DB_NAME"
fi

echo ""
echo "После настройки DATABASE_URL выполните:"
echo "  npm run db:push  # для применения схемы базы данных"
echo "  npm run dev      # для запуска приложения"
