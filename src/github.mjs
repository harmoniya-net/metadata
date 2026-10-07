import CONFIG from './config.mjs';
import { fetchWithRetry } from './utils.mjs';

/**
 * Every release of `repo` (`owner/name`), oldest first — an index lists builds
 * in the order they shipped, and GitHub lists them the other way round.
 */
export async function releases(repo) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (CONFIG.GITHUB_TOKEN) headers.Authorization = `Bearer ${CONFIG.GITHUB_TOKEN}`;

    const found = [];
    for (let page = 1; ; page++) {
        const url = `${CONFIG.GITHUB_API}/repos/${repo}/releases?per_page=100&page=${page}`;
        const response = await fetchWithRetry(url, { headers });
        if (!response.ok) throw new Error(`GET ${url} -> ${response.status} ${response.statusText}`);
        const batch = await response.json();
        found.push(...batch);
        if (batch.length < 100) break;
    }
    return found.reverse();
}
