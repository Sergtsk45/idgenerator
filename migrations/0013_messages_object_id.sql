-- Migration: 0013_messages_object_id
-- Add object_id to messages table to isolate messages per construction object
-- ON DELETE SET NULL: messages are preserved if object is deleted, just unlinked

ALTER TABLE messages ADD COLUMN IF NOT EXISTS object_id integer REFERENCES objects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_object_id_idx ON messages(object_id);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
