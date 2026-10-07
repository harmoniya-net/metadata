/**
 * Library entries as third parties write them, brought to the shape Mojang
 * writes: every download with a `path`, a `url`, a `sha1` and a `size`.
 */
import path from 'node:path';
import { MOJANG_LIBRARIES } from './artifacts.mjs';
import { coordPath, coordUrl, parseCoord, withClassifier } from './maven.mjs';

/**
 * A library entry with every download given the `path` it lands at.
 *
 * Documents written by hand, or by a launcher that derives the path itself,
 * list a download with a `url` and no `path` — a dozen of Mojang's libraries
 * in Cleanroom's, most of the list in lwjgl3ify's. Mojang's own entries always
 * carry one, and it is not optional to a reader that installs by path — so it
 * is derived here, once, the only way it can be: from the coordinate.
 */
export function withPaths(library) {
    const downloads = library.downloads;
    if (!downloads) return library;
    const coord = parseCoord(library.name);
    const located = (download, at) => (download.path ? download : { path: coordPath(at), ...download });

    return {
        ...library,
        downloads: {
            ...downloads,
            ...(downloads.artifact ? { artifact: located(downloads.artifact, coord) } : {}),
            ...(downloads.classifiers
                ? {
                      classifiers: Object.fromEntries(
                          Object.entries(downloads.classifiers).map(([classifier, download]) => [
                              classifier,
                              located(download, withClassifier(coord, classifier)),
                          ]),
                      ),
                  }
                : {}),
        },
    };
}

/**
 * A library named the maven way — a coordinate and, usually, the repository
 * it lives in, with no `downloads` at all — as an entry with one.
 *
 * `resolve` is `resolveArtifact`: it answers with the first candidate that
 * exists, or `null`. A `null` is an error rather than a gap, because an entry
 * with no address installs nothing and fails only at launch.
 *
 * `elsewhere` maps a file name to another address for it. Repositories prune:
 * lwjgl3ify's own maven no longer has anything before 2.1.4, while the same
 * jars are still attached to the releases that named them.
 */
export async function withDownloads(library, resolve, elsewhere = new Map()) {
    if (library.downloads) return library;
    // A bare coordinate is the oldest spelling there is: before `downloads`
    // existed, a library with no `url` was one of Mojang's own.
    const repository = library.url || MOJANG_LIBRARIES;
    const coord = parseCoord(library.name);
    const file = coordPath(coord);
    const candidates = [coordUrl(repository, coord), elsewhere.get(path.posix.basename(file))].filter(Boolean);
    const resolved = await resolve(candidates);
    if (!resolved) throw new Error(`${library.name} is not at ${repository}`);

    const { url, ...rest } = library;
    return {
        ...rest,
        downloads: { artifact: { path: file, url: resolved.url, sha1: resolved.sha1, size: resolved.size } },
    };
}

/**
 * An artifact listed with an empty hash, given the real one. lwjgl3ify 3.0.19
 * to 3.0.27 list `lzma` as `"sha1": "", "size": 0`.
 */
export async function withHash(library, resolve) {
    const artifact = library.downloads?.artifact;
    if (!artifact || artifact.sha1) return library;
    const resolved = await resolve([artifact.url]);
    if (!resolved) throw new Error(`${library.name} is not at ${artifact.url}`);
    return {
        ...library,
        downloads: { ...library.downloads, artifact: { ...artifact, sha1: resolved.sha1, size: resolved.size } },
    };
}
