// Plug the node:sqlite storage host into the engine. Import this before using @lernlab/core.
import { installNodeHost } from '@lernlab/storage-sqlite';

installNodeHost();

export { getDb } from '@lernlab/core/db';
