import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lwjgl3ifyDocument, minecraftVersionOf, releaseOf } from '../src/lwjgl3ify.mjs';

const resolve = async ([url]) => ({ url, sha1: 'c'.repeat(40), size: 42 });

test('a release needs a version.json and must not be a draft', () => {
    const asset = name => ({ name, browser_download_url: `https://example.test/${name}` });
    const release = (assets, draft = false) => ({ tag_name: '3.0.37', prerelease: false, draft, assets });

    const found = releaseOf(release([asset('version.json'), asset('lwjgl3ify-3.0.37-forgePatches.jar')]));
    assert.equal(found.tag, '3.0.37');
    assert.equal(found.documentUrl, 'https://example.test/version.json');
    assert.equal(found.assets.get('lwjgl3ify-3.0.37-forgePatches.jar'), 'https://example.test/lwjgl3ify-3.0.37-forgePatches.jar');

    assert.equal(releaseOf(release([asset('lwjgl3ify-3.0.37.jar')])), null);
    assert.equal(releaseOf(release([asset('version.json')], true)), null);
});

test('the Minecraft version comes from assets when nothing is inherited', () => {
    assert.equal(minecraftVersionOf({ assets: '1.7.10' }), '1.7.10');
    assert.equal(minecraftVersionOf({ inheritsFrom: '1.7.10', assets: 'legacy' }), '1.7.10');
    assert.equal(minecraftVersionOf({}), null);
});

test('every library comes out with a path, a url, a hash and a size', async () => {
    const source = {
        id: '1.7.10-lwjgl3ify',
        mainClass: 'com.gtnewhorizons.retrofuturabootstrap.Main',
        assets: '1.7.10',
        logging: {},
        libraries: [
            // As most of the list is written: no path.
            { name: 'org.lwjgl:lwjgl:3.3.3', downloads: { artifact: { url: 'https://example.test/lwjgl.jar', sha1: 'a'.repeat(40), size: 1 } } },
            // As Forge was written until 3.0.19: no download at all.
            { name: 'net.minecraftforge:forge:1.7.10-10.13.4.1614-1.7.10:universal', url: 'https://maven.example.test/' },
            // As lzma was written from 3.0.19 to 3.0.27: no hash.
            { name: 'lzma:lzma:0.0.1', downloads: { artifact: { url: 'https://example.test/lzma.jar', sha1: '', size: 0 } } },
        ],
    };

    const document = await lwjgl3ifyDocument(source, { resolve });

    assert.deepEqual(document.libraries.map(l => l.name), source.libraries.map(l => l.name));
    for (const { downloads, name } of document.libraries) {
        const { path, url, sha1, size } = downloads.artifact;
        assert.ok(path && url && /^[0-9a-f]{40}$/.test(sha1) && size > 0, name);
    }
    assert.equal(document.libraries[0].downloads.artifact.path, 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar');
    assert.equal('url' in document.libraries[1], false);
    assert.equal('logging' in document, false);
    assert.equal(document.mainClass, source.mainClass);
});
