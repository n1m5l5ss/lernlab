// Writes tokens.css from docs/design/tokens.json. Run after changing the tokens; a test fails if you forget.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokensToCss } from './tokens';

writeFileSync(join(import.meta.dirname, '..', 'tokens.css'), tokensToCss());
