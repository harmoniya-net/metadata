import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanroomDocument, flatten, minecraftVersionOf, releaseOf, shadowed, withPaths } from '../src/cleanroom.mjs';

const lib = (name, url = `https://example.test/${name}.jar`, sha1 = 'a'.repeat(40)) => ({
    name,
    downloads: { artifact: { path: `${name}.jar`, url, sha1, size: 1 } },
});

const OWN = 'com.cleanroommc:cleanroom:0.5.9-alpha';
const UNIVERSAL = { url: 'https://example.test/cleanroom-universal.jar', sha1: 'c'.repeat(40), size: 9 };

const VANILLA = {
    id: '1.12.2',
    mainClass: 'net.minecraft.client.main.Main',
    assetIndex: { id: '1.12' },
    assets: '1.12',
    downloads: { client: { url: 'https://example.test/client.jar' } },
    javaVersion: { component: 'jre-legacy', majorVersion: 8 },
    logging: { client: { argument: '-Dlog4j.configurationFile=${path}' } },
    minecraftArguments: '--vanilla',
    libraries: [
        lib('com.google.guava:guava:21.0'),
        lib('org.lwjgl.lwjgl:lwjgl:2.9.4-nightly-20150209'),
        lib('org.lwjgl.lwjgl:lwjgl-platform:2.9.4-nightly-20150209'),
        lib('com.mojang:authlib:1.5.25'),
    ],
};

const patch = (extra = {}) => ({
    _comment_: ['installer noise'],
    id: 'cleanroom-0.5.9-alpha',
    inheritsFrom: '1.12.2',
    mainClass: 'top.outlands.foundation.boot.Foundation',
    minecraftArguments: '--cleanroom',
    libraries: [lib(OWN, '', UNIVERSAL.sha1), lib('com.google.guava:guava:33.4.8-jre'), lib('org.lwjgl:lwjgl:3.3.6')],
    ...extra,
});

const documents = versionJson => ({ versionJson, installProfile: { path: OWN, minecraft: '1.12.2', processors: [] } });

test('a release needs both jars and must not be a draft', () => {
    const asset = name => ({ name, browser_download_url: `https://example.test/${name}` });
    const release = (assets, draft = false) => ({ tag_name: '0.5.9-alpha', prerelease: false, draft, assets });
    const both = [asset('cleanroom-0.5.9-alpha-installer.jar'), asset('cleanroom-0.5.9-alpha-universal.jar')];

    assert.deepEqual(releaseOf(release([...both, asset('cleanroom-0.5.9-alpha-sources.jar')])), {
        tag: '0.5.9-alpha',
        prerelease: false,
        installerUrl: 'https://example.test/cleanroom-0.5.9-alpha-installer.jar',
        universalUrl: 'https://example.test/cleanroom-0.5.9-alpha-universal.jar',
    });
    assert.equal(releaseOf(release(both.slice(0, 1))), null);
    assert.equal(releaseOf(release(both.slice(1))), null);
    assert.equal(releaseOf(release(both, true)), null);
});

test('reads the Minecraft version from whichever document states it', () => {
    assert.equal(minecraftVersionOf(documents(patch())), '1.12.2');
    const { inheritsFrom, ...standalone } = patch();
    assert.equal(minecraftVersionOf(documents(standalone)), '1.12.2');
    assert.equal(minecraftVersionOf({ versionJson: standalone, installProfile: {} }), null);
});

test('a vanilla library is shadowed by its own module or by being LWJGL 2', () => {
    const modules = new Set(['com.google.guava:guava']);
    assert.equal(shadowed(lib('com.google.guava:guava:21.0'), modules), true);
    assert.equal(shadowed(lib('org.lwjgl.lwjgl:lwjgl_util:2.9.4'), modules), true);
    assert.equal(shadowed(lib('com.mojang:authlib:1.5.25'), modules), false);
    // LWJGL 3's group is a prefix of LWJGL 2's; only the latter goes.
    assert.equal(shadowed(lib('org.lwjgl:lwjgl:3.3.6'), modules), false);
});

test('flattening puts the patch first and keeps only what it does not replace', () => {
    const flat = flatten(patch(), VANILLA);
    assert.deepEqual(
        flat.libraries.map(l => l.name),
        [OWN, 'com.google.guava:guava:33.4.8-jre', 'org.lwjgl:lwjgl:3.3.6', 'com.mojang:authlib:1.5.25'],
    );
    assert.equal(flat.id, 'cleanroom-0.5.9-alpha');
    assert.equal(flat.mainClass, 'top.outlands.foundation.boot.Foundation');
    assert.equal(flat.minecraftArguments, '--cleanroom');
    assert.deepEqual(flat.assetIndex, VANILLA.assetIndex);
    assert.deepEqual(flat.downloads, VANILLA.downloads);
    for (const gone of ['inheritsFrom', 'javaVersion', 'logging']) assert.equal(gone in flat, false, gone);
});

test('a patch becomes a complete document with the universal jar addressed', () => {
    const document = cleanroomDocument({ documents: documents(patch()), vanilla: VANILLA, universal: UNIVERSAL });
    assert.equal('_comment_' in document, false);
    assert.equal('inheritsFrom' in document, false);
    assert.deepEqual(document.libraries[0].downloads.artifact, {
        path: `${OWN}.jar`,
        url: UNIVERSAL.url,
        sha1: UNIVERSAL.sha1,
        size: 1,
    });
    assert.equal(document.libraries.every(l => l.downloads.artifact.url), true);
});

test('a standalone document is published as shipped, bar the one address', () => {
    const { inheritsFrom, _comment_, ...standalone } = patch({ javaVersion: { majorVersion: 25 } });
    const document = cleanroomDocument({ documents: documents(standalone), vanilla: VANILLA, universal: UNIVERSAL });
    assert.deepEqual(document.javaVersion, { majorVersion: 25 });
    assert.deepEqual(document.libraries.slice(1), standalone.libraries.slice(1));
    assert.equal(document.libraries.length, 3);
    assert.equal(document.libraries[0].downloads.artifact.url, UNIVERSAL.url);
});

test('a wrong maven address on the jar is replaced, not trusted', () => {
    const wrong = patch();
    wrong.libraries[0] = lib(OWN, 'https://repo.example.test/cleanroom-dev.jar', UNIVERSAL.sha1);
    const document = cleanroomDocument({ documents: documents(wrong), vanilla: VANILLA, universal: UNIVERSAL });
    assert.equal(document.libraries[0].downloads.artifact.url, UNIVERSAL.url);
});

test('refuses a universal jar that is not the one the document describes', () => {
    assert.throws(
        () => cleanroomDocument({ documents: documents(patch()), vanilla: VANILLA, universal: { ...UNIVERSAL, sha1: 'd'.repeat(40) } }),
        /universal jar is d{40}, version\.json expects c{40}/,
    );
});

test('refuses a version document that does not list the jar it installs', () => {
    const missing = patch();
    missing.libraries.shift();
    assert.throws(() => cleanroomDocument({ documents: documents(missing), vanilla: VANILLA, universal: UNIVERSAL }), /does not list/);
});

test('an empty logging object is dropped, a real one kept', () => {
    const run = logging =>
        cleanroomDocument({ documents: documents(patch({ logging })), vanilla: VANILLA, universal: UNIVERSAL });
    assert.equal('logging' in run({}), false);
    const real = { client: { argument: '-Dlog4j.configurationFile=${path}' } };
    assert.deepEqual(run(real).logging, real);
});

test('a download with no path is given the one its coordinate implies', () => {
    const entry = {
        name: 'com.mojang:text2speech:1.10.3',
        natives: { linux: 'natives-linux' },
        downloads: {
            artifact: { url: 'https://example.test/t2s.jar', sha1: 'a'.repeat(40), size: 1 },
            classifiers: { 'natives-linux': { url: 'https://example.test/t2s-linux.jar', sha1: 'b'.repeat(40), size: 2 } },
        },
    };
    const located = withPaths(entry);
    assert.equal(located.downloads.artifact.path, 'com/mojang/text2speech/1.10.3/text2speech-1.10.3.jar');
    assert.equal(
        located.downloads.classifiers['natives-linux'].path,
        'com/mojang/text2speech/1.10.3/text2speech-1.10.3-natives-linux.jar',
    );
    assert.deepEqual(located.natives, entry.natives);
});

test('a path the document states is left exactly as stated', () => {
    const entry = lib('org.lwjgl:lwjgl:3.4.1:natives-linux');
    assert.deepEqual(withPaths(entry), entry);
    assert.deepEqual(withPaths({ name: 'a:b:1' }), { name: 'a:b:1' });
});
