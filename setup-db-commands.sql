-- Создание пользователя и базы данных для TelegramJurnalRabot
CREATE USER app WITH PASSWORD 'app';
CREATE DATABASE telegram_jurnal_rabot OWNER app;
GRANT ALL PRIVILEGES ON DATABASE telegram_jurnal_rabot TO app;
