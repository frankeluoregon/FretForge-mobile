/**
 * Lightweight Express server that serves ChordPro files from a local directory.
 *
 * Usage:  node server/choproApi.js [/path/to/chopro/dir]
 * Default dir: D:\tabs\chopro
 *
 * Endpoints:
 *   GET /api/chopro         — list all .chopro files (optional ?q=search)
 *   GET /api/chopro/:name   — return raw file content
 */

import express from 'express';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const CHOPRO_DIR = process.argv[2] || 'D:\\tabs\\chopro';
const PORT = process.env.CHOPRO_PORT || 3001;

const app = express();

// CORS for Vite dev server
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// Cache the file list with basic metadata (refreshed on each request for simplicity)
async function getFileList() {
    const entries = await readdir(CHOPRO_DIR);
    const choproFiles = entries.filter(f => f.toLowerCase().endsWith('.chopro'));

    // Parse minimal metadata (title/artist) from first 10 lines of each file
    const results = await Promise.all(choproFiles.map(async (filename) => {
        try {
            const content = await readFile(join(CHOPRO_DIR, filename), 'utf-8');
            const head = content.slice(0, 500); // first ~500 chars is enough for metadata
            let title = null, artist = null;

            for (const line of head.split('\n').slice(0, 15)) {
                const m = line.match(/^\{(\w+):?\s*(.+?)\}\s*$/);
                if (!m) continue;
                const dir = m[1].toLowerCase();
                const val = m[2].trim();
                if ((dir === 'title' || dir === 't') && !title) title = val;
                if ((dir === 'subtitle' || dir === 'st' || dir === 'artist') && !artist) artist = val;
                if (title && artist) break;
            }

            return {
                filename,
                title: title || basename(filename, '.chopro'),
                artist: artist || '',
            };
        } catch {
            return { filename, title: basename(filename, '.chopro'), artist: '' };
        }
    }));

    return results;
}

// GET /api/chopro?q=search
app.get('/api/chopro', async (req, res) => {
    try {
        let files = await getFileList();
        const q = (req.query.q || '').toLowerCase();
        if (q) {
            files = files.filter(f =>
                f.title.toLowerCase().includes(q) ||
                f.artist.toLowerCase().includes(q) ||
                f.filename.toLowerCase().includes(q)
            );
        }
        // Sort by title
        files.sort((a, b) => a.title.localeCompare(b.title));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/chopro/:name
app.get('/api/chopro/:name', async (req, res) => {
    try {
        const filename = basename(req.params.name); // prevent path traversal
        const content = await readFile(join(CHOPRO_DIR, filename), 'utf-8');
        res.type('text/plain').send(content);
    } catch (err) {
        res.status(404).json({ error: 'File not found' });
    }
});

app.listen(PORT, () => {
    console.log(`ChordPro API running on http://localhost:${PORT}`);
    console.log(`Serving files from: ${CHOPRO_DIR}`);
});
