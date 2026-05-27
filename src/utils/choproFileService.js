/**
 * Client-side service for fetching ChordPro files from the local API server.
 */

const API_BASE = '/api/chopro';

/**
 * Fetch the list of available .chopro files.
 * @param {string} [searchTerm]  Optional search filter
 * @returns {Promise<Array<{ filename: string, title: string, artist: string }>>}
 */
export async function listChoProFiles(searchTerm) {
    const url = searchTerm
        ? `${API_BASE}?q=${encodeURIComponent(searchTerm)}`
        : API_BASE;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file list: ${res.status}`);
    return res.json();
}

/**
 * Fetch the raw content of a .chopro file.
 * @param {string} filename  The filename to load
 * @returns {Promise<string>}
 */
export async function loadChoProFile(filename) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
    return res.text();
}
