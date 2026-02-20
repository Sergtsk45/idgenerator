-- Migration: Add telegram_user_id to objects table
-- Description: Добавление поля telegram_user_id для привязки объектов к пользователям Telegram
-- Date: 2026-02-20

-- Добавляем поле telegram_user_id в таблицу objects
ALTER TABLE objects 
ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;

-- Создаём индекс для быстрого поиска объектов по telegram_user_id
CREATE INDEX IF NOT EXISTS objects_telegram_user_id_idx 
ON objects(telegram_user_id);

-- Комментарий к полю
COMMENT ON COLUMN objects.telegram_user_id IS 'Telegram user ID (owner of the construction object)';
