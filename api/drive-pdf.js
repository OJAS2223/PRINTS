export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const fileId = String(req.query?.fileId || '').trim();
    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(fileId)) {
        return res.status(400).json({ error: 'Invalid Google Drive fileId' });
    }

    try {
        let targetUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
        let response = await fetch(targetUrl, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            const html = await response.text();
            const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/) || html.match(/name="confirm"\s+value="([^"]+)"/);
            const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
            if (confirmMatch) {
                let confirmedUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=${encodeURIComponent(confirmMatch[1])}`;
                if (uuidMatch) confirmedUrl += `&uuid=${encodeURIComponent(uuidMatch[1])}`;
                response = await fetch(confirmedUrl, {
                    redirect: 'follow',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
            }
        }

        if (!response.ok) {
            return res.status(502).json({ error: `Drive fetch failed with status ${response.status}` });
        }

        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (!buf.slice(0, 5).toString('utf8').startsWith('%PDF-')) {
            return res.status(502).json({ error: 'Google Drive did not return a valid PDF file' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(buf);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Proxy error' });
    }
}d
