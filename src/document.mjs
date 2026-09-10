/**
 * The pieces every published document is built out of, whichever loader it
 * describes.
 *
 * Forge and NeoForge ship the same kind of installer and are read the same
 * way; what differs is where the version list comes from and how a build is
 * named. Everything below that line lives here, so a fix to the wrapper's
 * arguments or to the client-jar declaration lands on both families at once.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { HORNO } from './config.mjs';
import { resolveArtifact } from './artifacts.mjs';
import { coordPath } from './maven.mjs';
import { vanillaVersion } from './mojang.mjs';

export const LIB_DIR = '${library_directory}';

const sha1OfFile = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');

export function library(name, artifact) {
    return { name, downloads: { artifact } };
}

/**
 * Arguments that put jars on the module path. The loader's own version
 * document lists them, and for the processor era the wrapper reads that
 * document out of the installer and applies them itself — so leaving them on
 * the command line applies them twice.
 */
const MODULE_ARGS = ['-p', '--module-path', '--add-modules', '--add-reads', '--add-opens', '--add-exports'];

export function stripModuleArgs(jvm) {
    const kept = [];
    for (let i = 0; i < jvm.length; i++) {
        const arg = jvm[i];
        if (typeof arg !== 'string') {
            kept.push(arg);
            continue;
        }
        if (MODULE_ARGS.includes(arg)) {
            i++;
            continue;
        }
        if (MODULE_ARGS.some(name => arg.startsWith(`${name}=`)) || arg.startsWith('-DignoreList=')) {
            continue;
        }
        kept.push(arg);
    }
    return kept;
}

/**
 * Forge's own documents carry `"logging": {}` — the key with nothing under it.
 * An empty object is not a smaller `logging`, it is a different shape, and a
 * consumer that reads the field as optional-but-whole chokes on it. Under
 * `inheritsFrom` the vanilla document supplies the real one anyway.
 */
export const loggingOf = logging => (logging?.client ? { logging } : {});

const clientCoord = mc => ({ group: 'com.mojang', artifact: 'minecraft', version: mc, classifier: 'client', extension: 'jar' });

export const clientPath = mc => `${LIB_DIR}/${coordPath(clientCoord(mc))}`;

/**
 * The vanilla client jar, declared as a library.
 *
 * The wrapper has to be told where that jar is, and the Mojang format has no
 * placeholder for it — `${version_name}` names the loader's version, not the
 * Minecraft one, and every launcher lays out `versions/` differently. Declaring
 * it as a library puts it at a path `${library_directory}` can address, which
 * is also where horno's own detector looks for it. The cost is that a
 * launcher honouring `inheritsFrom` fetches the jar twice; the alternative is a
 * document that only works in launchers told about it out of band.
 */
export async function clientLibrary(mc) {
    const vanilla = await vanillaVersion(mc);
    if (!vanilla?.client) return null;
    return library(`com.mojang:minecraft:${mc}:client`, {
        path: coordPath(clientCoord(mc)),
        url: vanilla.client.url,
        sha1: vanilla.client.sha1,
        size: vanilla.client.size,
    });
}

let hornoLibraryPromise = null;

export function hornoLibrary() {
    hornoLibraryPromise ??= (async () => {
        const coord = { group: HORNO.group, artifact: HORNO.artifact, version: HORNO.tag, extension: 'jar' };
        const url = `https://github.com/${HORNO.repo}/releases/download/${HORNO.tag}/${HORNO.artifact}-${HORNO.tag}.jar`;
        // Normally the release is already there and gets hashed over the wire.
        // `HORNO_JAR` hashes a local build instead, which is how a document can
        // be generated for a jar that has not been released yet — the case the
        // two repositories used to be one repository to avoid.
        const resolved = HORNO.jar
            ? { url, sha1: sha1OfFile(HORNO.jar), size: fs.statSync(HORNO.jar).size }
            : await resolveArtifact([url]);
        if (!resolved) throw new Error(`horno release asset not found: ${url}`);
        return library(`${HORNO.group}:${HORNO.artifact}:${HORNO.tag}`, {
            path: coordPath(coord),
            url: resolved.url,
            sha1: resolved.sha1,
            size: resolved.size,
        });
    })();
    return hornoLibraryPromise;
}

/**
 * The properties that name a file horno fetches for itself.
 *
 * An installer and an ancient-era overlay zip are the same kind of thing: an
 * input to horno, not a runtime dependency. Neither is declared as a library —
 * on `-cp` the installer becomes an automatic module colliding with the
 * loader's own jar and shadows the game's Gson, and the overlay is loose class
 * files meant to be copied *into* minecraft.jar rather than found beside it.
 *
 * Both eras spell it the same way, which is the point of it being one function.
 */
export function fetchedBy(property, artifact) {
    return [
        `-Dhorno.${property}=${LIB_DIR}/${artifact.path}`,
        `-Dhorno.${property}Url=${artifact.url}`,
        `-Dhorno.${property}Sha1=${artifact.sha1}`,
    ];
}

/**
 * A processor-era document: the loader's own version JSON, with horno put in
 * front of it.
 *
 * The installer is named by properties rather than declared as a library. It is
 * an input to horno, not a runtime dependency, and declaring it put it on `-cp`
 * — where it becomes an automatic module colliding with the loader's own jar,
 * and where its shaded Gson shadows the game's. Horno fetches it from the URL
 * and sha1 given here.
 *
 * Everything horno will apply itself — the module path, `ignoreList` — comes
 * off the command line, because applying it twice is not the same as applying
 * it once.
 */
export async function processorDocument({ source, mc, installer, id }) {
    const [client, horno] = await Promise.all([clientLibrary(mc), hornoLibrary()]);

    // An entry with no URL is not a download: the processors produce it.
    const produced = (source.libraries ?? []).filter(l => l.downloads?.artifact?.url);
    const jar = installer.downloads.artifact;

    return {
        id: source.id ?? id,
        inheritsFrom: mc,
        type: source.type ?? 'release',
        time: source.time,
        releaseTime: source.releaseTime,
        ...loggingOf(source.logging),
        mainClass: HORNO.mainClass,
        arguments: {
            game: source.arguments?.game ?? [],
            jvm: [
                `-Dhorno.librariesDir=${LIB_DIR}`,
                ...fetchedBy('installer', jar),
                `-Dhorno.minecraft=${clientPath(mc)}`,
                ...stripModuleArgs(source.arguments?.jvm ?? []),
            ],
        },
        libraries: [...produced, ...[client, horno].filter(Boolean)],
    };
}
