import '../backend/storage';
import { importDeck } from '../backend/anki';
const deck = process.argv[2] ?? 'Lang::German';
importDeck(deck, (m) => console.log(m))
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(`Import failed: ${e.message}\nIs Anki open with the AnkiConnect add-on?`);
    process.exit(1);
  });
