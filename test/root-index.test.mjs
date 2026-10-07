import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rootIndex } from '../src/root-index.mjs';

test('names each family and the address of its index', () => {
    assert.deepEqual(rootIndex('https://example.test/metadata'), {
        families: [
            { name: 'forge', index: 'https://example.test/metadata/forge/index.json' },
            { name: 'neoforge', index: 'https://example.test/metadata/neoforge/index.json' },
        ],
    });
});
