DROP TABLE IF EXISTS Entries;

CREATE TABLE IF NOT EXISTS Entries (
	player_id TEXT PRIMARY KEY,
	expires INTEGER,

	data TEXT
);

CREATE INDEX IF NOT EXISTS idx_entry_expires ON Entries(expires);
