import https from 'https';

function fetchUrlBuffer(urlStr, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) return reject(new Error('Too many redirects'));
        const req = https.get(urlStr, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/pdf,*/*'
            },
            timeout: 15000
        }, (resp) => {
            const status = resp.statusCode || 0;
            const loc = resp.headers.location;
            if ([301, 302, 303, 307, 308].includes(status) && loc) {
                resp.resume();
                const nextUrl = loc.startsWith('http') ? loc : new URL(loc, urlStr).toString();
                if (nextUrl.includes('accounts.google.com')) {
                    return reject(new Error('DRIVE_AUTH_REQUIRED'));
                }
                return fetchUrlBuffer(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
            }
            const chunks = [];
            resp.on('data', (c) => chunks.push(c));
            resp.on('end', () => {
                resolve({
                    status,
                    contentType: String(resp.headers['content-type'] || ''),
                    buffer: Buffer.concat(chunks)
                });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const fileId = String(req.query?.fileId || '').trim();
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(fileId)) {
        return res.status(400).json({ error: 'Invalid Google Drive fileId' });
    }

    const candidates = [
        `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
        `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
        `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=pdf`
    ];

    let lastError = 'Unable to fetch PDF from Google Drive';
    for (const url of candidates) {
        try {
            let result = await fetchUrlBuffer(url, 5);
            if (result.contentType.includes('text/html') && !result.buffer.subarray(0, 5).toString('utf8').startsWith('%PDF-')) {
                const html = result.buffer.toString('utf8');
                const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/) || html.match(/name="confirm"\s+value="([^"]+)"/);
                const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
                if (confirmMatch) {
                    let cUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=${encodeURIComponent(confirmMatch[1])}`;
                    if (uuidMatch) cUrl += `&uuid=${encodeURIComponent(uuidMatch[1])}`;
                    result = await fetchUrlBuffer(cUrl, 5);
                }
            }
            if (result.status === 200 && result.buffer.subarray(0, 5).toString('utf8').startsWith('%PDF-')) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                return res.status(200).send(result.buffer);
            }
        } catch (err) {
            if (err.message === 'DRIVE_AUTH_REQUIRED') {
                return res.status(403).json({
                    error: 'Google Drive file is private. In your Google Apps Script, set file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW).'
                });
            }
            lastError = err.message;
        }
    }

    return res.status(502).json({ error: lastError });
}
