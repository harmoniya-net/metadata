/**
 * Cleanroom's side of the world: a 1.12.2 Forge successor published on GitHub
 * Releases, one installer per release.
 *
 * It is the one family here that needs neither its installer nor horno. No
 * release has ever carried a processor, so the installer does nothing but
 * unpack one jar — and that jar is also a release asset in its own right,
 * `cleanroom-<tag>-universal.jar`, byte for byte. Give the library that
 * address and the document is an ordinary version JSON: fetch what it lists,
 * start what it names.
 *
 * So what is published is a complete version JSON rather than an
 * `inheritsFrom` patch, which is also what Cleanroom itself ships from
 * 0.5.16-alpha on. The 59 releases before that were patches over 1.12.2, and
 * they are folded onto it here — see `flatten` for why that cannot be left to
 * the reader.
 */
import fs from 'node:fs';
import path from 'node:path';
import CONFIG from './config.mjs';
import { resolveArtifact } from './artifacts.mjs';
import { loggingOf } from './document.mjs';
import { withPaths } from './libraries.mjs';
import { releases } from './github.mjs';
import { readEntries } from './remote-zip.mjs';
import { readJson, writeJson } from './utils.mjs';

const isInstaller = name => /-installer\.jar$/.test(name);
const isUniversal = name => /-universal\.jar$/.test(name);

/**
 * A release as far as this generator cares, or `null` for one it cannot
 * publish: a draft, or one missing either jar.
 */
export function releaseOf(release) {
    if (release.draft) return null;
    const installer = release.assets.find(a => isInstaller(a.name));
    const universal = release.assets.find(a => isUniversal(a.name));
    if (!installer || !universal) return null;
    return {
        tag: release.tag_name,
        prerelease: release.prerelease,
        installerUrl: installer.browser_download_url,
        universalUrl: universal.browser_download_url,
    };
}

/** Every publishable release, oldest first. */
export async function fetchReleases() {
    return (await releases(CONFIG.CLEANROOM_REPO)).map(releaseOf).filter(Boolean);
}

const DOCUMENTS = ['install_profile.json', 'version.json'];

/** The installer's two documents, by range request — see `remote-zip.mjs`. */
export async function fetchDocuments(release) {
    const file = path.join(CONFIG.CLEANROOM_DOCUMENT_CACHE, `${release.tag}.json`);
    if (fs.existsSync(file)) return readJson(file);

    const entries = await readEntries(release.installerUrl, DOCUMENTS);
    const parse = name => (entries.has(name) ? JSON.parse(entries.get(name).toString('utf8')) : null);
    const documents = {
        installProfile: parse('install_profile.json'),
        versionJson: parse('version.json'),
    };
    writeJson(file, documents);
    return documents;
}

/** The Minecraft version a release targets, as the release itself states it. */
export function minecraftVersionOf(documents) {
    return documents.versionJson?.inheritsFrom ?? documents.installProfile?.minecraft ?? null;
}

/** `{ url, sha1, size }` of the universal jar, hashed once and cached. */
export function fetchUniversal(release) {
    return resolveArtifact([release.universalUrl]);
}

const moduleOf = name => name.split(':').slice(0, 2).join(':');

/**
 * Whether a vanilla library has no place under a Cleanroom patch.
 *
 * Two rules. The first is the format's own: a patch library supersedes the
 * base library of the same `group:artifact`. The second is Cleanroom's, and is
 * the reason these documents are flattened here instead of published as the
 * patches they shipped as. Cleanroom runs on LWJGL 3 under `org.lwjgl`, with a
 * compatibility layer for the LWJGL 2 API; vanilla 1.12.2 ships LWJGL 2 itself
 * under `org.lwjgl.lwjgl`. Different group, so no reader's merge drops it, and
 * left on the classpath the real `org.lwjgl.Sys` answers for the layer's.
 * Cleanroom's own standalone documents carry nothing from that group, which is
 * the same rule read off their side.
 */
export function shadowed(vanillaLibrary, patchModules) {
    const module = moduleOf(vanillaLibrary.name);
    return patchModules.has(module) || module.startsWith('org.lwjgl.lwjgl:');
}

/**
 * Folds a pre-0.5.16 patch onto the vanilla version it inherits from.
 *
 * Two vanilla fields are deliberately not inherited. `javaVersion`: vanilla
 * 1.12.2 says Java 8, Cleanroom has never run on it, and these releases did
 * not say what they wanted instead — so the honest document says nothing.
 * `logging`: it names Mojang's log4j configuration for a log4j Cleanroom has
 * replaced, and Cleanroom's own standalone documents carry none.
 */
export function flatten(patch, vanilla) {
    const patchModules = new Set(patch.libraries.map(l => moduleOf(l.name)));
    const { inheritsFrom, ...own } = patch;
    const { javaVersion, logging, libraries, ...base } = vanilla;
    return {
        ...base,
        ...own,
        libraries: [...patch.libraries, ...libraries.filter(l => !shadowed(l, patchModules))],
    };
}

/**
 * One release's document: the installer's version JSON, complete, with the
 * Cleanroom jar given an address.
 *
 * The installer names that jar in `install_profile.json`'s `path` and lists it
 * with an empty `url`, because it expects to unpack it. A few releases list a
 * maven URL instead — for a different, larger jar than the hash beside it
 * describes. Either way the entry's own `sha1` is the authority, and the
 * universal asset is only used if it matches.
 */
export function cleanroomDocument({ documents, vanilla, universal }) {
    // The patches carry `logging: {}`, as Forge's documents do: an empty
    // object where a reader expects a configuration or nothing. It goes the
    // way `loggingOf` sends every other one.
    const { _comment_, logging, ...shipped } = documents.versionJson;
    const source = { ...shipped, ...loggingOf(logging) };
    const own = documents.installProfile.path;

    const entry = source.libraries.find(l => l.name === own);
    if (!entry) throw new Error(`version.json does not list ${own}`);
    const stated = entry.downloads.artifact.sha1;
    if (stated !== universal.sha1) {
        throw new Error(`universal jar is ${universal.sha1}, version.json expects ${stated}`);
    }

    const complete = source.inheritsFrom ? flatten(source, vanilla) : source;
    return {
        ...complete,
        libraries: complete.libraries.map(l =>
            l.name === own
                ? { ...l, downloads: { ...l.downloads, artifact: { ...l.downloads.artifact, url: universal.url } } }
                : withPaths(l),
        ),
    };
}
