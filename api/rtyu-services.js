import https from 'https';

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCjvAVdtOWmyDx4MPYW-0UPsAj7UKEKCuo';
const API_BASE_URL = process.env.DOB_PRINT_API_URL || 'https://rtyu.run.place/api/v1/index.php';
const API_KEY = (process.env.RTYU_API_KEY || process.env.DOB_PRINT_API_KEY || 'sk_2e7fc8baf4a1998c9382c1f961bdd64c').trim();

const ALLOWED_SERVICES = new Set([
    'pan-find-bg',
    'pan-details-prime',
    'mobile-to-uan-num-instant',
    'instant-voter-mobile-link',
    'll-exam',
    'll-exam-status',
    'dl-pdf',
    'eshram-mobile-update',
    'learning-license-pdf'
]);

function httpsGetJson(urlStr) {
    return new Promise((resolve, reject) => {
        const req = https.get(urlStr, { timeout: 30000, rejectUnauthorized: false }, (resp) => {
            const chunks = [];
            resp.on('data', (c) => chunks.push(c));
            resp.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                try {
                    resolve({ httpCode: resp.statusCode || 200, json: JSON.parse(raw), raw });
                } catch (e) {
                    resolve({ httpCode: resp.statusCode || 500, json: null, raw });
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('API request timeout')); });
    });
}

function verifyFirebaseIdToken(idToken) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ idToken });
        const req = https.request(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
                timeout: 10000
            },
            (resp) => {
                const chunks = [];
                resp.on('data', (c) => chunks.push(c));
                resp.on('end', () => {
                    try {
                        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        const user = data?.users?.[0];
                        if (user && user.localId) resolve(user);
                        else reject(new Error('Unauthorized'));
                    } catch (e) {
                        reject(new Error('Unauthorized'));
                    }
                });
            }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'Method Not Allowed' });

    const authHeader = String(req.headers.authorization || '');
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) return res.status(401).json({ status: false, message: 'Missing Authorization token' });

    try {
        await verifyFirebaseIdToken(idToken);
    } catch (e) {
        return res.status(401).json({ status: false, message: 'Invalid or expired session' });
    }

    const serviceKey = String(req.body?.serviceKey || '').trim();
    const params = req.body?.params || {};
    if (!ALLOWED_SERVICES.has(serviceKey)) {
        return res.status(400).json({ status: false, message: 'Unsupported serviceKey' });
    }

    try {
        const qs = new URLSearchParams({ api_key: API_KEY, service: serviceKey });
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                qs.set(k, String(v).trim());
            }
        });

        const targetUrl = `${API_BASE_URL}?${qs.toString()}`;
        const { httpCode, json, raw } = await httpsGetJson(targetUrl);
        if (!json) {
            return res.status(502).json({ status: false, message: 'Provider returned invalid response', raw });
        }

        const isOk = (
            json.status === true ||
            json.Status === true ||
            String(json.status || '').toLowerCase() === 'success' ||
            json.success === true ||
            Boolean(json.pdf || json.pdf_url || json.data?.pdf || json.data?.pdf_url)
        );

        if (!isOk) {
            return res.status(400).json({
                status: false,
                message: json.message || json.data?.message || 'Service request failed',
                response_code: json.response_code || httpCode,
                raw: json
            });
        }

        return res.status(200).json({
            status: true,
            serviceKey,
            result: json
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: err.message || 'Server error' });
    }
}
