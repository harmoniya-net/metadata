import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.mjs';
import { ensureDir, writeJson } from './utils.mjs';

/**
 * What the site root answers with: the families published under it and where
 * each one's index is. It carries no builds — it exists so the root is not a 404.
 */
export function rootIndex(site) {
    return {
        families: ['forge', 'neoforge'].map((name) => ({ name, index: `${site}/${name}/index.json` })),
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    ensureDir(CONFIG.PUBLIC_DIR);
    writeJson(path.join(CONFIG.PUBLIC_DIR, 'index.json'), rootIndex(CONFIG.SITE));
}
