import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDownloads, withHash, withPaths } from '../src/libraries.mjs';

const lib = (name, url = `https://example.test/${name}.jar`, sha1 = 'a'.repeat(40)) => ({
    name,
    downloads: { artifact: { path: `${name}.jar`, url, sha1, size: 1 } },
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

test('a repository-style entry is resolved into a download', async () => {
    const asked = [];
    const resolve = async candidates => {
        asked.push(...candidates);
        return { url: candidates[0], sha1: 'c'.repeat(40), size: 42 };
    };
    const entry = { name: 'org.scala-lang:scala-library:2.11.1', url: 'https://maven.example.test/' };

    assert.deepEqual(await withDownloads(entry, resolve), {
        name: entry.name,
        downloads: {
            artifact: {
                path: 'org/scala-lang/scala-library/2.11.1/scala-library-2.11.1.jar',
                url: 'https://maven.example.test/org/scala-lang/scala-library/2.11.1/scala-library-2.11.1.jar',
                sha1: 'c'.repeat(40),
                size: 42,
            },
        },
    });
    assert.deepEqual(asked, ['https://maven.example.test/org/scala-lang/scala-library/2.11.1/scala-library-2.11.1.jar']);
});

test('a classifier in the coordinate reaches the resolved path', async () => {
    const resolve = async ([url]) => ({ url, sha1: 'c'.repeat(40), size: 1 });
    const entry = { name: 'net.minecraftforge:forge:1.7.10-10.13.4.1614-1.7.10:universal', url: 'https://maven.example.test' };
    const { downloads } = await withDownloads(entry, resolve);
    assert.equal(
        downloads.artifact.path,
        'net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-universal.jar',
    );
});

test('an entry that already has downloads is not resolved again', async () => {
    const never = async () => assert.fail('resolved an entry that has downloads');
    const entry = lib('a:b:1');
    assert.equal(await withDownloads(entry, never), entry);
    assert.equal(await withHash(entry, never), entry);
});

test('a repository-style entry that is not there is an error, not a gap', async () => {
    const entry = { name: 'a:b:1', url: 'https://maven.example.test/' };
    await assert.rejects(() => withDownloads(entry, async () => null), /a:b:1 is not at/);
});

test('an empty hash is replaced by the real one', async () => {
    const entry = { name: 'lzma:lzma:0.0.1', downloads: { artifact: { url: 'https://example.test/lzma.jar', sha1: '', size: 0 } } };
    const fixed = await withHash(entry, async ([url]) => ({ url, sha1: 'e'.repeat(40), size: 5762 }));
    assert.deepEqual(fixed.downloads.artifact, { url: 'https://example.test/lzma.jar', sha1: 'e'.repeat(40), size: 5762 });
    await assert.rejects(() => withHash(entry, async () => null), /lzma:lzma:0.0.1 is not at/);
});

test('a pruned repository falls back to the same file elsewhere', async () => {
    const asked = [];
    const resolve = async candidates => {
        asked.push(...candidates);
        return { url: candidates[1], sha1: 'c'.repeat(40), size: 7 };
    };
    const entry = { name: 'com.github.GTNewHorizons:lwjgl3ify:2.0.5:forgePatches', url: 'https://nexus.example.test/public/' };
    const elsewhere = new Map([['lwjgl3ify-2.0.5-forgePatches.jar', 'https://github.example.test/lwjgl3ify-2.0.5-forgePatches.jar']]);

    const { downloads } = await withDownloads(entry, resolve, elsewhere);
    assert.equal(asked.length, 2);
    assert.equal(downloads.artifact.url, 'https://github.example.test/lwjgl3ify-2.0.5-forgePatches.jar');
    // Where it lands is still the coordinate's path, whatever served it.
    assert.equal(downloads.artifact.path, 'com/github/GTNewHorizons/lwjgl3ify/2.0.5/lwjgl3ify-2.0.5-forgePatches.jar');
});

test('a bare coordinate is looked for on Mojang\'s own repository', async () => {
    const { downloads } = await withDownloads({ name: 'lzma:lzma:0.0.1' }, async ([url]) => ({ url, sha1: 'c'.repeat(40), size: 1 }));
    assert.equal(downloads.artifact.url, 'https://libraries.minecraft.net/lzma/lzma/0.0.1/lzma-0.0.1.jar');
});
