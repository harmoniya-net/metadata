/**
 * lwjgl3ify's side of the world: Forge 1.7.10 on LWJGL 3 and a current JVM,
 * published on GitHub Releases.
 *
 * Like Cleanroom it needs no installer and no horno, and for a simpler reason:
 * there is no installer. Each release carries a `version.json` asset, a
 * complete version document with the 1.7.10 client, its asset index and every
 * library inline. So this family is that file, republished.
 *
 * Republished rather than linked to, because as written it is not something a
 * strict reader can install from. Most of its libraries have a `url` and no
 * `path`; until 3.0.19 fifteen of them — Forge itself among them — were a
 * coordinate and a repository with no download at all, so no hash and no size;
 * and for nine releases one hash is the empty string. `libraries.mjs` puts each
 * of those right, once, here.
 *
 * What a document cannot carry is the mod. lwjgl3ify is also a jar in `mods/`,
 * and needs UniMixins beside it; a version JSON has no way to say either, so
 * that part stays with whoever installs the game.
 */
import fs from 'node:fs';
import path from 'node:path';
import CONFIG from './config.mjs';
import { resolveArtifact } from './artifacts.mjs';
import { loggingOf } from './document.mjs';
import { releases } from './github.mjs';
import { withDownloads, withHash, withPaths } from './libraries.mjs';
import { fetchJson, readJson, writeJson } from './utils.mjs';

/** A release as far as this generator cares, or `null` for one with no document. */
export function releaseOf(release) {
    if (release.draft) return null;
    const document = release.assets.find(a => a.name === 'version.json');
    if (!document) return null;
    return {
        tag: release.tag_name,
        prerelease: release.prerelease,
        documentUrl: document.browser_download_url,
        // By file name: where a library the document names can still be had
        // once the maven it points at has dropped it.
        assets: new Map(release.assets.map(a => [a.name, a.browser_download_url])),
    };
}

/** Every release that ships a version document, oldest first. */
export async function fetchReleases() {
    return (await releases(CONFIG.LWJGL3IFY_REPO)).map(releaseOf).filter(Boolean);
}

/** The release's `version.json`, as shipped. */
export async function fetchDocument(release) {
    const file = path.join(CONFIG.LWJGL3IFY_DOCUMENT_CACHE, `${release.tag}.json`);
    if (fs.existsSync(file)) return readJson(file);

    const document = await fetchJson(release.documentUrl);
    writeJson(file, document);
    return document;
}

/**
 * The Minecraft version a document targets. It inherits from nothing, so the
 * field that would say is absent; `assets` is the one that still names it.
 */
export function minecraftVersionOf(document) {
    return document.inheritsFrom ?? document.assets ?? null;
}

/**
 * One release's document: the shipped `version.json` with every library made
 * installable. Nothing else is touched — the main class, the arguments and the
 * order of the library list are lwjgl3ify's.
 */
export async function lwjgl3ifyDocument(source, { assets = new Map(), resolve = resolveArtifact } = {}) {
    const { logging, ...shipped } = source;
    const libraries = [];
    for (const library of source.libraries) {
        libraries.push(withPaths(await withHash(await withDownloads(library, resolve, assets), resolve)));
    }
    return { ...shipped, ...loggingOf(logging), libraries };
}
