import path from 'node:path';

const CACHE_DIR = path.join(process.cwd(), '.cache');

/**
 * The horno jar these documents name. It is a release asset of another
 * repository now, so a run has to be told which release to name — by tag, or by
 * a local jar for a run made before that release exists.
 */
export const HORNO = {
    tag: process.env.HORNO_TAG ?? '0.1.0',
    group: 'net.harmoniya',
    artifact: 'horno',
    mainClass: 'net.harmoniya.horno.Main',
    repo: 'harmoniya-net/horno',
    /** A locally built jar to hash instead of fetching the release asset. */
    jar: process.env.HORNO_JAR ?? null,
};

export const CONFIG = {
    /** Where the documents are served from. URLs in the index are absolute against it. */
    SITE: (process.env.SITE_BASE ?? 'https://harmoniya-net.github.io/metadata').replace(/\/$/, ''),
    FORGE_API: 'https://files.minecraftforge.net/net/minecraftforge/forge',
    FORGE_MAVEN: 'https://maven.minecraftforge.net',
    /** NeoForge publishes no promotions endpoint; the version list is the whole API. */
    NEOFORGE_VERSIONS: 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge',
    NEOFORGE_MAVEN: 'https://maven.neoforged.net/releases',
    /** Cleanroom and lwjgl3ify publish on GitHub Releases. */
    CLEANROOM_REPO: 'CleanroomMC/Cleanroom',
    LWJGL3IFY_REPO: 'GTNewHorizons/lwjgl3ify',
    GITHUB_API: 'https://api.github.com',
    /** Optional. One listing request per run fits the anonymous limit; a token is for CI's shared address. */
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null,
    MOJANG_MANIFEST: 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
    DOCUMENT_CACHE: path.join(CACHE_DIR, 'documents'),
    NEOFORGE_DOCUMENT_CACHE: path.join(CACHE_DIR, 'neoforge-documents'),
    CLEANROOM_DOCUMENT_CACHE: path.join(CACHE_DIR, 'cleanroom-documents'),
    LWJGL3IFY_DOCUMENT_CACHE: path.join(CACHE_DIR, 'lwjgl3ify-documents'),
    VANILLA_CACHE: path.join(CACHE_DIR, 'vanilla'),
    META_CACHE: path.join(CACHE_DIR, 'forge-meta.json'),
    ARTIFACT_CACHE: path.join(CACHE_DIR, 'artifacts.json'),
    MOJANG_CACHE: path.join(CACHE_DIR, 'mojang.json'),
    PUBLIC_DIR: path.join(process.cwd(), 'public'),
    /** One directory per loader family, so neither is the special one. */
    FORGE_DIR: path.join(process.cwd(), 'public', 'forge'),
    NEOFORGE_DIR: path.join(process.cwd(), 'public', 'neoforge'),
    CLEANROOM_DIR: path.join(process.cwd(), 'public', 'cleanroom'),
    LWJGL3IFY_DIR: path.join(process.cwd(), 'public', 'lwjgl3ify'),
    CONCURRENCY: Number(process.env.CONCURRENCY ?? 12),
};

export default CONFIG;
