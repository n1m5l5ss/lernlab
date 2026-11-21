// Writes tokens.css, and the colour and contrast tables in docs/design/style.md, from docs/design/tokens.json.
// Run after changing the tokens; a test fails if you forget.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokensToCss } from './tokens';
import { fillStyleDoc } from './style-doc';

writeFileSync(join(import.meta.dirname, '..', 'tokens.css'), tokensToCss());

const styleDoc = join(import.meta.dirname, '..', '..', '..', 'docs', 'design', 'style.md');
writeFileSync(styleDoc, fillStyleDoc(readFileSync(styleDoc, 'utf8')));
