/**
 * Publishes a document for every Cleanroom release, under `public/cleanroom`.
 *
 * The same index and the same aliases as the other two families, over a
 * different kind of document: a complete version JSON, not an `inheritsFrom`
 * patch, and one that never mentions horno. `cleanroom.mjs` says why.
 */
import fs from 'node:fs';
import path from 'node:path';
import CONFIG from './config.mjs';
import { loadArtifactCache, saveArtifactCache } from './artifacts.mjs';
import { cleanroomDocument, fetchDocuments, fetchReleases, fetchUniversal, minecraftVersionOf } from './cleanroom.mjs';
import { buildIndexEntry } from './index-entry.mjs';
import { loadMojang, saveMojang, vanillaDocument } from './mojang.mjs';
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
const site = `${CONFIG.SITE}/cleanroom`;

loadArtifactCache();
await loadMojang();

const releases = (await fetchReleases()).filter(r => !options.only || r.tag === options.only);
const skipped = [];
const byMinecraft = new Map();

await mapLimit(releases, CONFIG.CONCURRENCY, async release => {
    try {
        const documents = await fetchDocuments(release);
        if (!documents.installProfile || !documents.versionJson) throw new Error('installer carries no documents');
        // Nothing here runs a processor, and a document that silently skipped
        // one would launch something half-installed.
        if ((documents.installProfile.processors ?? []).length > 0) throw new Error('installer carries processors');

        const mc = minecraftVersionOf(documents);
        if (!mc) throw new Error('installer names no Minecraft version');
        const vanilla = await vanillaDocument(mc);
        if (!vanilla) throw new Error(`Mojang does not publish ${mc}`);

        const universal = await fetchUniversal(release);
        if (!universal) throw new Error('universal jar is not reachable');

        const document = cleanroomDocument({ documents, vanilla, universal });
        writeJson(path.join(CONFIG.CLEANROOM_DIR, 'versions', mc, `${release.tag}.json`), document);

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

    // GitHub's own prerelease flag, not the tag: every Cleanroom tag so far
    // ends in `-alpha`, and none is marked a prerelease.
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
        const from = path.join(CONFIG.CLEANROOM_DIR, 'versions', mc, `${id}.json`);
        fs.copyFileSync(from, path.join(CONFIG.CLEANROOM_DIR, 'versions', mc, `${kind}.json`));
    }

    console.error(`[${mc}] ${ids.length} builds`);
}

ensureDir(CONFIG.CLEANROOM_DIR);
if (options.only) {
    console.error('[Slice] Wrote documents only; index.json left as it was');
} else {
    writeJson(path.join(CONFIG.CLEANROOM_DIR, 'index.json'), {
        generated: new Date().toISOString(),
        versions: index,
    });
    writeJson(path.join(CONFIG.CLEANROOM_DIR, 'skipped.json'), skipped);
}

saveArtifactCache();
saveMojang();

const total = Object.values(index).reduce((sum, v) => sum + v.builds.length, 0);
console.error(`[Done] ${total} builds across ${Object.keys(index).length} Minecraft versions, ${skipped.length} skipped`);
