-- A LernLab v0.2 database (no schema_version table), made by the v0.2 code.
-- Used by migrations.test.ts. Regenerate only if the v0.2 shape was captured wrongly.
CREATE TABLE attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      day TEXT NOT NULL,
      session_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      format TEXT NOT NULL,
      correct INTEGER NOT NULL,
      near_miss INTEGER NOT NULL DEFAULT 0,
      article_error INTEGER NOT NULL DEFAULT 0,
      used_hint INTEGER NOT NULL DEFAULT 0,
      response_ms INTEGER NOT NULL,
      given TEXT,
      xp INTEGER NOT NULL DEFAULT 0,
      grade INTEGER
    );
CREATE TABLE days (
      day TEXT PRIMARY KEY,
      xp INTEGER NOT NULL DEFAULT 0,
      sessions INTEGER NOT NULL DEFAULT 0,
      seconds INTEGER NOT NULL DEFAULT 0,
      goal_met INTEGER NOT NULL DEFAULT 0
    );
CREATE TABLE decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      language TEXT,
      description TEXT NOT NULL DEFAULT '',
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
CREATE TABLE item_state (
      item_id INTEGER PRIMARY KEY REFERENCES items(id),
      mastery INTEGER NOT NULL DEFAULT 0,
      seen INTEGER NOT NULL DEFAULT 0,
      right INTEGER NOT NULL DEFAULT 0,
      wrong INTEGER NOT NULL DEFAULT 0,
      gender_seen INTEGER NOT NULL DEFAULT 0,
      gender_right INTEGER NOT NULL DEFAULT 0,
      last_wrong_day TEXT,
      spoken_days TEXT NOT NULL DEFAULT '[]'
    );
CREATE TABLE items (
      id INTEGER PRIMARY KEY,
      deck TEXT NOT NULL,
      kind TEXT NOT NULL,
      target TEXT NOT NULL,
      article TEXT,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      sentence_html TEXT NOT NULL,
      sentence TEXT NOT NULL,
      sentence_meaning TEXT NOT NULL,
      grammar TEXT NOT NULL,
      notes TEXT NOT NULL,
      audio TEXT,
      rank INTEGER NOT NULL,
      tags TEXT NOT NULL,
      grp TEXT,
      ord INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    , deck_id INTEGER, image TEXT, video TEXT, category TEXT, extra TEXT NOT NULL DEFAULT '{}', starred INTEGER NOT NULL DEFAULT 0);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      length TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      seconds INTEGER NOT NULL DEFAULT 0,
      summary TEXT
    );
CREATE TABLE srs (
      item_id INTEGER PRIMARY KEY REFERENCES items(id),
      card TEXT NOT NULL,
      due TEXT NOT NULL,
      introduced_day TEXT NOT NULL,
      last_graded_day TEXT,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0
    , prev_card TEXT, prev_due TEXT);
CREATE INDEX attempts_day ON attempts(day);
CREATE INDEX attempts_item ON attempts(item_id);
CREATE INDEX items_deck ON items(deck_id);
INSERT INTO attempts (id, ts, day, session_id, item_id, format, correct, near_miss, article_error, used_hint, response_ms, given, xp, grade) VALUES (1, '2026-11-20T09:00:00.000Z', '2026-11-20', 's1', 1982479671912683, 'intro', 1, 0, 0, 0, 900, NULL, 1, NULL);
INSERT INTO attempts (id, ts, day, session_id, item_id, format, correct, near_miss, article_error, used_hint, response_ms, given, xp, grade) VALUES (2, '2026-11-20T09:00:00.000Z', '2026-11-20', 's1', 1982479671912683, 'typed', 1, 0, 0, 0, 2100, 'der Hund', 10, 3);
INSERT INTO days (day, xp, sessions, seconds, goal_met) VALUES ('2026-11-20', 56, 1, 240, 1);
INSERT INTO decks (id, name, language, description, settings, created_at) VALUES (1, 'German basics', 'de', '', '{"newPerDay":10}', '2026-11-20T11:18:11.200Z');
INSERT INTO item_state (item_id, mastery, seen, right, wrong, gender_seen, gender_right, last_wrong_day, spoken_days) VALUES (1982479671912683, 3, 1, 1, 0, 1, 1, NULL, '[]');
INSERT INTO items (id, deck, kind, target, article, word, meaning, sentence_html, sentence, sentence_meaning, grammar, notes, audio, rank, tags, grp, ord, suspended, updated_at, deck_id, image, video, category, extra, starred) VALUES (1855580102381643, 'German basics', 'noun', 'die Katze', 'die', 'Katze', 'the cat', '', '', '', '', '', NULL, 0, '["noun"]', NULL, 1, 0, '2026-11-20T11:18:11.200Z', 1, NULL, NULL, 'die', '{}', 0);
INSERT INTO items (id, deck, kind, target, article, word, meaning, sentence_html, sentence, sentence_meaning, grammar, notes, audio, rank, tags, grp, ord, suspended, updated_at, deck_id, image, video, category, extra, starred) VALUES (1982479671912683, 'German basics', 'noun', 'der Hund', 'der', 'Hund', 'the dog', '', '', '', '', '', NULL, 0, '["noun"]', NULL, 0, 0, '2026-11-20T11:18:11.200Z', 1, NULL, NULL, 'der', '{}', 0);
INSERT INTO items (id, deck, kind, target, article, word, meaning, sentence_html, sentence, sentence_meaning, grammar, notes, audio, rank, tags, grp, ord, suspended, updated_at, deck_id, image, video, category, extra, starred) VALUES (4070841801049146, 'German basics', 'verb', 'laufen', NULL, 'laufen', 'to run', '', '', '', '', '', NULL, 0, '["verb"]', NULL, 2, 0, '2026-11-20T11:18:11.200Z', 1, NULL, NULL, NULL, '{}', 0);
INSERT INTO meta (key, value) VALUES ('activeDeck', '1');
INSERT INTO meta (key, value) VALUES ('streak', '{"current":1,"longest":1,"freezes":2,"lastCountedDay":"2026-11-20","lastSettledDay":"2026-11-19","frozenDays":[],"repair":null}');
INSERT INTO meta (key, value) VALUES ('achievements', '{"first":"2026-11-20"}');
INSERT INTO sessions (id, day, started_at, finished_at, length, xp, seconds, summary) VALUES ('s1', '2026-11-20', '2026-11-20T09:00:00.000Z', '2026-11-20T09:00:00.000Z', 'mini', 56, 240, '{"sessionId":"s1","length":"mini","seconds":240,"answers":2,"correct":2,"bossWon":null,"bestGenderCombo":0,"perfectBlocks":1,"startedAt":"2026-11-20T09:00:00.000Z"}');
INSERT INTO srs (item_id, card, due, introduced_day, last_graded_day, reps, lapses, prev_card, prev_due) VALUES (1982479671912683, '{"due":"2026-11-23T09:00:00.000Z","stability":2.3065,"difficulty":2.11810397,"elapsed_days":0,"scheduled_days":3,"reps":1,"lapses":0,"learning_steps":0,"state":2,"last_review":"2026-11-20T09:00:00.000Z"}', '2026-11-23T09:00:00.000Z', '2026-11-20', '2026-11-20', 1, 0, '{"due":"2026-11-20T09:00:00.000Z","stability":0,"difficulty":0,"elapsed_days":0,"scheduled_days":0,"reps":0,"lapses":0,"learning_steps":0,"state":0}', '2026-11-20T09:00:00.000Z');
