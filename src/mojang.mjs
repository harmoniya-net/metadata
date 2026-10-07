import CONFIG from './config.mjs';
import { createCache } from './cache.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fetchJson, readJson, writeJson } from './utils.mjs';

const cache = createCache(CONFIG.MOJANG_CACHE);
let index = null;

/**
 * The vanilla side of the wall. Only two things are ever needed from it: the
 * main class a pre-1.13 build hands off to, and the client jar's download —
 * both of which the Forge documents of that era simply assume you already know.
 */
export async function loadMojang() {
    cache.load();
    const manifest = await fetchJson(CONFIG.MOJANG_MANIFEST);
    index = new Map(manifest.versions.map(v => [v.id, v.url]));
}

export function saveMojang() {
    cache.save();
}

export function knowsVersion(id) {
    return index.has(id);
}

export async function vanillaVersion(id) {
    const cached = cache.get(id);
    if (cached) return cached;

    const url = index.get(id);
    if (!url) return null;

    const version = await fetchJson(url);
    return cache.set(id, {
        id: version.id,
        mainClass: version.mainClass,
        client: version.downloads?.client ?? null,
        // Names only: all that is ever asked of them is whether a Forge entry
        // restates one or overrides it.
        libraries: (version.libraries ?? []).map(l => ({ name: l.name })),
    });
}

/**
 * A vanilla version document, whole. `vanillaVersion` keeps three fields
 * because that is all Forge's documents ask of it; a family that publishes
 * complete version JSONs has to carry the rest — the asset index, the client
 * download, every library entry as Mojang wrote it.
 */
export async function vanillaDocument(id) {
    const file = path.join(CONFIG.VANILLA_CACHE, `${id}.json`);
    if (fs.existsSync(file)) return readJson(file);

    const url = index.get(id);
    if (!url) return null;

    const version = await fetchJson(url);
    writeJson(file, version);
    return version;
}
