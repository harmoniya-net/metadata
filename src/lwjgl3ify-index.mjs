/**
 * Publishes a document for every lwjgl3ify release, under `public/lwjgl3ify`.
 *
 * The same index and the same aliases as the other families, over the kind of
 * document Cleanroom has: a complete version JSON that never mentions horno.
 * `lwjgl3ify.mjs` says what is changed in it and what is left out.
 */
import fs from 'node:fs';
import path from 'node:path';
import CONFIG from './config.mjs';
import { loadArtifactCache, saveArtifactCache } from './artifacts.mjs';
import { fetchDocument, fetchReleases, lwjgl3ifyDocument, minecraftVersionOf } from './lwjgl3ify.mjs';
import { buildIndexEntry } from './index-entry.mjs';
import { ensureDir, mapLimit, writeJson } from './utils.mjs';

function parseArgs(argv) {
    const options = { only: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--only') options.only = argv[++i];
        else throw new Error(`Unknown argument: ${argv[i]}`);
    }
    return options;
}

const options = parseArgs(process.argv.slice(2));
const site = `${CONFIG.SITE}/lwjgl3ify`;

loadArtifactCache();

const releases = (await fetchReleases()).filter(r => !options.only || r.tag === options.only);
const skipped = [];
const byMinecraft = new Map();

await mapLimit(releases, CONFIG.CONCURRENCY, async release => {
    try {
        const source = await fetchDocument(release);
        const mc = minecraftVersionOf(source);
        if (!mc) throw new Error('document names no Minecraft version');

        const document = await lwjgl3ifyDocument(source, { assets: release.assets });
        writeJson(path.join(CONFIG.LWJGL3IFY_DIR, 'versions', mc, `${release.tag}.json`), document);

        if (!byMinecraft.has(mc)) byMinecraft.set(mc, []);
        byMinecraft.get(mc).push(release);
    } catch (error) {
        skipped.push({ version: release.tag, reason: error.message });
    }
});

const index = {};

for (const [mc, built] of byMinecraft) {
    // Written concurrently, so put back in the order the releases shipped.
    const ordered = releases.filter(r => built.includes(r));
    const ids = ordered.map(r => r.tag);

    // GitHub's own prerelease flag, as for Cleanroom.
    const entry = buildIndexEntry({
        site,
        mc,
        ids,
        recommended: ordered.filter(r => !r.prerelease).at(-1)?.tag ?? null,
    });
    index[mc] = entry;

    for (const kind of ['latest', 'recommended', 'best']) {
        if (options.only) break;
        const id = entry[kind];
        if (!id) continue;
        const from = path.join(CONFIG.LWJGL3IFY_DIR, 'versions', mc, `${id}.json`);
        fs.copyFileSync(from, path.join(CONFIG.LWJGL3IFY_DIR, 'versions', mc, `${kind}.json`));
    }

    console.error(`[${mc}] ${ids.length} builds`);
}

ensureDir(CONFIG.LWJGL3IFY_DIR);
if (options.only) {
    console.error('[Slice] Wrote documents only; index.json left as it was');
} else {
    writeJson(path.join(CONFIG.LWJGL3IFY_DIR, 'index.json'), {
        generated: new Date().toISOString(),
        versions: index,
    });
    writeJson(path.join(CONFIG.LWJGL3IFY_DIR, 'skipped.json'), skipped);
}

saveArtifactCache();

const total = Object.values(index).reduce((sum, v) => sum + v.builds.length, 0);
console.error(`[Done] ${total} builds across ${Object.keys(index).length} Minecraft versions, ${skipped.length} skipped`);
