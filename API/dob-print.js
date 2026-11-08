import crypto from 'crypto';
import https from 'https';
import http from 'http';

// ============================================================================
// FILE: api/dob-print.js
// Server-Side Locked BRN Original PDF Gateway (₹140 / 140 Credits)
// Works with OR without FIREBASE_SERVICE_ACCOUNT (Auto REST API Fallback)
// ============================================================================

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'upeprint';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCjvAVdtOWmyDx4MPYW-0UPsAj7UKEKCuo';

const DEFAULT_API_CONFIG = {
  baseUrl: process.env.DOB_PRINT_API_URL || 'https://rtyu.run.place/api/v1/index.php',
  apiKey: process.env.DOB_PRINT_API_KEY || 'sk_2e7fc8baf4a1998c9382c1f961bdd64c',
  applyService: process.env.DOB_PRINT_APPLY_SERVICE || 'b-number-pdf-apply',
  statusService: process.env.DOB_PRINT_STATUS_SERVICE || 'b-number-pdf-status',
  creditCost: Number(process.env.DOB_PRINT_CREDIT_COST) || 140
};

const SUPER_ADMIN_EMAILS = ['hkosiun1221@gmail.com', 'ovi@print.com'];
const SUB_ADMIN_EMAILS = ['prince@gmail.com', 'prince@print.com'];

// Server-only AES-256 key to keep external PDF URLs 100% hidden from client inspection
const SERVER_SECRET_SEED = process.env.DOB_PRINT_API_KEY || process.env.RAZORPAY_KEY_SECRET || 'ojas_dob_secret_2026_lock';
const AES_KEY = crypto.createHash('sha256').update(SERVER_SECRET_SEED).digest();

function encryptSecretText(plainText = '') {
  if (!plainText) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  } catch (e) {
    return '';
  }
}

function decryptSecretText(cipherPayload = '') {
  if (!cipherPayload || !String(cipherPayload).includes('.')) return '';
  try {
    const [ivB64, tagB64, dataB64] = String(cipherPayload).split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (e) {
    return '';
  }
}

function isSuperAdmin(email = '') {
  return SUPER_ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

function isAnyAdmin(email = '') {
  const clean = String(email).trim().toLowerCase();
  return isSuperAdmin(clean) || SUB_ADMIN_EMAILS.includes(clean);
}

// Lazy & Safe Firebase Admin Initialization (Never crashes if env or package is missing)
let cachedAdminApp = null;
async function getFirebaseAdminDb() {
  if (cachedAdminApp) return cachedAdminApp.firestore();
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const adminModule = await import('firebase-admin');
    const admin = adminModule.default || adminModule;
    if (!admin.apps.length) {
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const serviceAccount = JSON.parse(rawJson);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    cachedAdminApp = admin;
    return admin.firestore();
  } catch (err) {
    console.warn('Firebase Admin init skipped, using REST fallback:', err.message);
    return null;
  }
}

// Verify Firebase ID Token (Works via Admin SDK OR Identity Toolkit REST API)
async function verifyFirebaseUserToken(idToken) {
  if (!idToken) throw new Error('Authentication token missing');

  // 1. Try Firebase Admin SDK first if available
  if (cachedAdminApp) {
    try {
      const decoded = await cachedAdminApp.auth().verifyIdToken(idToken);
      return { uid: decoded.uid, email: (decoded.email || '').toLowerCase() };
    } catch (e) {}
  }

  // 2. Fallback to Google Identity Toolkit REST verification
  const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`;
  const resp = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data = await resp.json();
  if (!resp.ok || !data.users || !data.users[0]) {
    throw new Error(data?.error?.message || 'Invalid or expired login session');
  }
  const userInfo = data.users[0];
  return {
    uid: userInfo.localId,
    email: (userInfo.email || '').toLowerCase()
  };
}

// ============================================================================
// FIRESTORE REST API HELPERS (Used automatically when FIREBASE_SERVICE_ACCOUNT is not set)
// ============================================================================
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(fieldObj) {
  if (!fieldObj || typeof fieldObj !== 'object') return undefined;
  if ('stringValue' in fieldObj) return fieldObj.stringValue;
  if ('integerValue' in fieldObj) return Number(fieldObj.integerValue);
  if ('doubleValue' in fieldObj) return Number(fieldObj.doubleValue);
  if ('booleanValue' in fieldObj) return Boolean(fieldObj.booleanValue);
  if ('nullValue' in fieldObj) return null;
  if ('timestampValue' in fieldObj) return fieldObj.timestampValue;
  if ('arrayValue' in fieldObj) {
    return (fieldObj.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in fieldObj) {
    return fromFirestoreFields(fieldObj.mapValue.fields || {});
  }
  return undefined;
}

function fromFirestoreFields(fields = {}) {
  const result = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function restGetDoc(collectionName, docId, idToken = '') {
  const headers = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const resp = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}`, {
    method: 'GET',
    headers
  });
  if (resp.status === 404) return { exists: false, data: null };
  const json = await resp.json();
  if (!resp.ok || !json.fields) return { exists: false, data: null };
  return { exists: true, id: docId, data: fromFirestoreFields(json.fields) };
}

async function restPatchDoc(collectionName, docId, dataObj, idToken = '') {
  const keys = Object.keys(dataObj);
  const maskQuery = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const fields = {};
  for (const [k, v] of Object.entries(dataObj)) {
    fields[k] = toFirestoreValue(v);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const resp = await fetch(
    `${FIRESTORE_BASE_URL}/${collectionName}/${encodeURIComponent(docId)}?${maskQuery}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields })
    }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Firestore update failed (${resp.status}): ${errText}`);
  }
  const json = await resp.json();
  return fromFirestoreFields(json.fields || {});
}

// ============================================================================
// EXTERNAL API HTTP CLIENT (Handles HTTPS/HTTP, Redirects & Self-Signed Certs)
// ============================================================================
function fetchExternalUrl(targetUrl, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('Invalid external API URL configured'));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      method: 'GET',
      rejectUnauthorized: false,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OjasPortal/3.0',
        'Accept': 'application/json, application/pdf, */*'
      }
    };

    const req = client.request(parsedUrl, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).toString();
        return resolve(fetchExternalUrl(redirectUrl, timeoutMs));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          buffer,
          text: buffer.toString('utf-8')
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('External print server timed out after 30 seconds'));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

function parseExternalApiJson(rawText = '', statusCode = 200) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error(`प्रिंट सर्वर से खाली रिस्पॉन्स प्राप्त हुआ (HTTP ${statusCode})।`);
  }
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Extract JSON if PHP warning/notice text precedes or follows the JSON payload
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch (innerErr) {}
    }
    if (trimmed.startsWith('The page') || trimmed.includes('<html') || trimmed.includes('<!DOCTYPE')) {
      throw new Error(`प्रिंट सर्वर उपलब्‍ध नहीं है या URL गलत है (HTTP ${statusCode})।`);
    }
    throw new Error(`प्रिंट सर्वर से अमान्य रिस्पॉन्स प्राप्त हुआ: ${trimmed.slice(0, 100)}`);
  }
}

async function getServerApiConfig(adminDb, idToken = '') {
  try {
    if (adminDb) {
      const snap = await adminDb.collection('adminSecrets').doc('dobPrintConfig').get();
      if (snap.exists) {
        const d = snap.data();
        return {
          baseUrl: (d.baseUrl || DEFAULT_API_CONFIG.baseUrl).trim(),
          apiKey: (d.apiKey || DEFAULT_API_CONFIG.apiKey).trim(),
          applyService: (d.applyService || DEFAULT_API_CONFIG.applyService).trim(),
          statusService: (d.statusService || DEFAULT_API_CONFIG.statusService).trim(),
          creditCost: Number(d.creditCost) > 0 ? Number(d.creditCost) : 140
        };
      }
    } else if (idToken) {
      const snap = await restGetDoc('adminSecrets', 'dobPrintConfig', idToken);
      if (snap.exists && snap.data) {
        const d = snap.data;
        return {
          baseUrl: (d.baseUrl || DEFAULT_API_CONFIG.baseUrl).trim(),
          apiKey: (d.apiKey || DEFAULT_API_CONFIG.apiKey).trim(),
          applyService: (d.applyService || DEFAULT_API_CONFIG.applyService).trim(),
          statusService: (d.statusService || DEFAULT_API_CONFIG.statusService).trim(),
          creditCost: Number(d.creditCost) > 0 ? Number(d.creditCost) : 140
        };
      }
    }
  } catch (e) {}
  return DEFAULT_API_CONFIG;
}

// ============================================================================
// MAIN SERVERLESS HANDLER
// ============================================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const adminDb = await getFirebaseAdminDb();

  // ================= 1. SECURE PDF STREAM PROXY (GET) =================
  if (req.method === 'GET' && req.query?.action === 'proxy_pdf') {
    try {
      const docId = String(req.query.docId || '').trim();
      const idToken = String(req.query.token || '').trim();
      const isDownload = req.query.download === '1';

      if (!docId || !idToken) {
        return res.status(401).send('Unauthorized access');
      }

      const decoded = await verifyFirebaseUserToken(idToken);

      let histData = null;
      let pdfUrl = '';

      if (adminDb) {
        const histSnap = await adminDb.collection('history').doc(docId).get();
        if (!histSnap.exists) return res.status(404).send('Document record not found');
        histData = histSnap.data();

        const secretSnap = await adminDb.collection('adminSecrets').doc(`pdf_${docId}`).get();
        if (secretSnap.exists && secretSnap.data().pdfUrl) {
          pdfUrl = String(secretSnap.data().pdfUrl).trim();
        }
      } else {
        const histSnap = await restGetDoc('history', docId, idToken);
        if (!histSnap.exists) return res.status(404).send('Document record not found');
        histData = histSnap.data;
      }

      if (histData.userId !== decoded.uid && !isAnyAdmin(decoded.email)) {
        return res.status(403).send('Forbidden');
      }

      if (!pdfUrl && histData.formData?.ENCRYPTED_PDF_TOKEN) {
        pdfUrl = decryptSecretText(histData.formData.ENCRYPTED_PDF_TOKEN);
      }

      if (!pdfUrl) {
        return res.status(404).send('PDF is still pending approval. Please click Check Status first.');
      }

      const pdfRes = await fetchExternalUrl(pdfUrl, 30000);
      const cleanFileName = String(histData.fileName || 'DOB_Original_Certificate.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${cleanFileName}"`
      );
      return res.status(200).send(pdfRes.buffer);
    } catch (err) {
      return res.status(500).send('Error streaming PDF: ' + err.message);
    }
  }

  // Ensure all POST responses are strictly JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  // ================= 2. VERIFY FIREBASE AUTH TOKEN =================
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    return res.status(401).json({ status: false, message: 'Authentication required. Please log in again.' });
  }

  let decodedUser;
  try {
    decodedUser = await verifyFirebaseUserToken(idToken);
  } catch (err) {
    return res.status(401).json({ status: false, message: 'Invalid or expired session. Please log in again.' });
  }

  const uid = decodedUser.uid;
  const userEmail = (decodedUser.email || '').toLowerCase();
  const userIsSuperAdmin = isSuperAdmin(userEmail);
  const userIsAdmin = isAnyAdmin(userEmail);

  let bodyObj = req.body || {};
  if (typeof bodyObj === 'string') {
    try {
      bodyObj = JSON.parse(bodyObj);
    } catch (e) {
      bodyObj = {};
    }
  }

  const { action = 'apply', name = '', number = '', docId = '' } = bodyObj;
  const apiCfg = await getServerApiConfig(adminDb, idToken);

  // ================= 3. CHECK STATUS (service=b-number-pdf-status) =================
  if (action === 'check_status') {
    try {
      if (!docId) {
        return res.status(400).json({ status: false, message: 'Missing Document ID' });
      }

      let histData = null;
      let secretData = {};

      if (adminDb) {
        const histSnap = await adminDb.collection('history').doc(docId).get();
        if (!histSnap.exists) return res.status(404).json({ status: false, message: 'Record not found' });
        histData = histSnap.data();

        const secretSnap = await adminDb.collection('adminSecrets').doc(`pdf_${docId}`).get();
        if (secretSnap.exists) secretData = secretSnap.data();
      } else {
        const histSnap = await restGetDoc('history', docId, idToken);
        if (!histSnap.exists) return res.status(404).json({ status: false, message: 'Record not found' });
        histData = histSnap.data;
      }

      if (histData.userId !== uid && !userIsAdmin) {
        return res.status(403).json({ status: false, message: 'Access denied' });
      }

      const existingPdfUrl = secretData.pdfUrl || decryptSecretText(histData.formData?.ENCRYPTED_PDF_TOKEN || '');
      if (existingPdfUrl && histData.formData?.API_STATUS === 'approved') {
        return res.status(200).json({
          status: true,
          apiStatus: 'approved',
          hasPdf: true,
          message: 'Certificate Approved! PDF is ready for download.'
        });
      }

      const appId = secretData.appId !== undefined ? secretData.appId : (histData.formData?.APP_ID || '');
      const appRef = secretData.applicationRef || histData.formData?.APPLICATION_REF || '';
      const brnNumber = secretData.brnNumber || histData.formData?.BRN_NO || '';
      const curStatus = histData.formData?.API_STATUS || 'pending';

      const statusUrl = new URL(apiCfg.baseUrl);
      statusUrl.searchParams.set('api_key', apiCfg.apiKey);
      statusUrl.searchParams.set('service', apiCfg.statusService);
      statusUrl.searchParams.set('app_id', String(appId));
      statusUrl.searchParams.set('application_ref', String(appRef));
      statusUrl.searchParams.set('number', String(brnNumber));
      statusUrl.searchParams.set('status', String(curStatus));

      const apiRes = await fetchExternalUrl(statusUrl.toString(), 30000);
      const parsed = parseExternalApiJson(apiRes.text, apiRes.statusCode);

      if (parsed && parsed.status && parsed.data) {
        const remoteStatus = String(parsed.data.status || curStatus).toLowerCase();
        const remotePdfUrl = String(parsed.data.pdf_url || '').trim();
        const isApproved = (remoteStatus === 'approved' || remoteStatus === 'completed') && Boolean(remotePdfUrl);
        const encryptedToken = remotePdfUrl ? encryptSecretText(remotePdfUrl) : (histData.formData?.ENCRYPTED_PDF_TOKEN || '');

        const updatedFormData = {
          ...(histData.formData || {}),
          API_STATUS: remoteStatus,
          HAS_PDF: Boolean(remotePdfUrl),
          ENCRYPTED_PDF_TOKEN: encryptedToken
        };

        if (adminDb) {
          if (remotePdfUrl) {
            await adminDb.collection('adminSecrets').doc(`pdf_${docId}`).set({
              pdfUrl: remotePdfUrl,
              status: remoteStatus,
              updatedAt: new Date()
            }, { merge: true });
          }
          await adminDb.collection('history').doc(docId).update({
            formData: updatedFormData,
            updatedAt: new Date()
          });
        } else {
          await restPatchDoc('history', docId, {
            formData: updatedFormData,
            updatedAt: new Date()
          }, idToken);
        }

        return res.status(200).json({
          status: true,
          response_code: parsed.response_code || apiRes.statusCode,
          apiStatus: remoteStatus,
          hasPdf: Boolean(remotePdfUrl),
          message: isApproved
            ? '✅ Approved! Your DOB Original PDF is now ready to view & download.'
            : `Status: ${remoteStatus.toUpperCase()} (${parsed.message || 'OK'})`
        });
      }

      return res.status(200).json({
        status: true,
        apiStatus: curStatus,
        hasPdf: false,
        message: parsed?.message || `Current Status: ${curStatus.toUpperCase()}`
      });
    } catch (err) {
      return res.status(500).json({ status: false, message: 'Status check error: ' + err.message });
    }
  }

  // ================= 4. APPLY FOR NEW DOB ORIGINAL PDF (₹140 / 140 CREDITS) =================
  const cleanName = String(name || '').trim().toUpperCase();
  const cleanNumber = String(number || '').trim().toUpperCase();

  if (!cleanName || !cleanNumber) {
    return res.status(400).json({
      status: false,
      message: 'कृपया पूरा नाम (Name) और बीआरएन नंबर (BRN Number) दोनों भरें।'
    });
  }

  const creditCost = userIsSuperAdmin ? 0 : (Number(apiCfg.creditCost) || 140);
  let previousCredits = 0;
  let remainingCredits = 0;

  // Step 4A: Verify permissions & deduct credits before calling external API
  try {
    if (adminDb) {
      const userRef = adminDb.collection('users').doc(uid);
      const portalCfgRef = adminDb.collection('settings').doc('portalConfig');

      await adminDb.runTransaction(async (t) => {
        const [portalSnap, userSnap] = await Promise.all([
          t.get(portalCfgRef),
          t.get(userRef)
        ]);

        if (!userIsSuperAdmin) {
          if (portalSnap.exists && portalSnap.data().showDobPrint === false) {
            throw new Error('DOB Original PDF सर्विस अभी एडमिन द्वारा बंद की गई है।');
          }
          if (!userSnap.exists) {
            throw new Error('User account not found.');
          }
          const uData = userSnap.data();
          if (uData.allowDobPrint === false) {
            throw new Error('आपके अकाउंट पर DOB Original PDF सर्विस की अनुमति नहीं है।');
          }
          previousCredits = Number(uData.credits) || 0;
          if (previousCredits < creditCost) {
            throw new Error(`अपर्याप्त बैलेंस! DOB Original PDF जनरेट करने के लिए ${creditCost} Credits (₹${creditCost}) आवश्यक हैं। आपके पास ${previousCredits} Cr हैं।`);
          }
          remainingCredits = previousCredits - creditCost;
          t.update(userRef, {
            credits: remainingCredits,
            lastServiceUsedAt: new Date()
          });
        }
      });
    } else {
      // REST API Fallback (Works without FIREBASE_SERVICE_ACCOUNT)
      const [portalSnap, userSnap] = await Promise.all([
        restGetDoc('settings', 'portalConfig', idToken),
        restGetDoc('users', uid, idToken)
      ]);

      if (!userIsSuperAdmin) {
        if (portalSnap.exists && portalSnap.data?.showDobPrint === false) {
          throw new Error('DOB Original PDF सर्विस अभी एडमिन द्वारा बंद की गई है।');
        }
        if (!userSnap.exists || !userSnap.data) {
          throw new Error('User account not found.');
        }
        const uData = userSnap.data;
        if (uData.allowDobPrint === false) {
          throw new Error('आपके अकाउंट पर DOB Original PDF सर्विस की अनुमति नहीं है।');
        }
        previousCredits = Number(uData.credits) || 0;
        if (previousCredits < creditCost) {
          throw new Error(`अपर्याप्त बैलेंस! DOB Original PDF जनरेट करने के लिए ${creditCost} Credits (₹${creditCost}) आवश्यक हैं। आपके पास ${previousCredits} Cr हैं।`);
        }
        remainingCredits = previousCredits - creditCost;
        await restPatchDoc('users', uid, { credits: remainingCredits }, idToken);
      }
    }
  } catch (permOrCreditErr) {
    return res.status(403).json({ status: false, message: permOrCreditErr.message });
  }

  // Step 4B: Call External BRN Apply API
  let apiResult = null;
  let httpCode = 500;

  try {
    const targetUrl = new URL(apiCfg.baseUrl);
    targetUrl.searchParams.set('api_key', apiCfg.apiKey);
    targetUrl.searchParams.set('service', apiCfg.applyService);
    targetUrl.searchParams.set('name', cleanName);
    targetUrl.searchParams.set('number', cleanNumber);

    const response = await fetchExternalUrl(targetUrl.toString(), 30000);
    httpCode = response.statusCode;
    apiResult = parseExternalApiJson(response.text, httpCode);

    if (!apiResult || apiResult.status === false) {
      throw new Error(apiResult?.message || 'BRN आवेदन सबमिट नहीं हो सका।');
    }
  } catch (apiError) {
    // Refund credits if external API fails (only possible when Admin SDK is active, as Firestore rules disallow client credit increase)
    if (creditCost > 0 && adminDb) {
      try {
        const userRef = adminDb.collection('users').doc(uid);
        await adminDb.runTransaction(async (t) => {
          const uSnap = await t.get(userRef);
          if (uSnap.exists) {
            const cur = Number(uSnap.data().credits) || 0;
            t.update(userRef, { credits: cur + creditCost });
          }
        });
      } catch (refundErr) {
        console.error('Refund error:', refundErr);
      }
    }
    return res.status(502).json({
      status: false,
      message: adminDb && creditCost > 0
        ? `${apiError.message} (आपके ${creditCost} क्रेडिट्स वापस रिफंड कर दिए गए हैं)।`
        : apiError.message
    });
  }

  // Step 4C: Save History & Encrypted PDF Secret
  try {
    const resData = apiResult.data || {};
    const appId = resData.app_id !== undefined ? resData.app_id : '';
    const appRef = resData.application_ref || `BNP_${Date.now()}`;
    const apiStatus = String(resData.status || 'pending').toLowerCase();
    const rawPdfUrl = String(resData.pdf_url || '').trim();
    const hasPdf = Boolean(rawPdfUrl);
    const newDocId = `dob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const sanitizedFormData = {
      SERVICE_TYPE: 'DOB Original PDF',
      DOC_ID: newDocId,
      APP_ID: appId,
      NAME: resData.name || cleanName,
      BRN_NO: resData.number || cleanNumber,
      APPLICATION_REF: appRef,
      API_STATUS: hasPdf ? 'approved' : apiStatus,
      HAS_PDF: hasPdf,
      CREDITS_DEDUCTED: creditCost,
      ENCRYPTED_PDF_TOKEN: rawPdfUrl ? encryptSecretText(rawPdfUrl) : ''
    };

    const pdfFileName = `${sanitizedFormData.NAME} - ${sanitizedFormData.BRN_NO} (DOB Original PDF).pdf`;

    if (adminDb) {
      await adminDb.collection('adminSecrets').doc(`pdf_${newDocId}`).set({
        docId: newDocId,
        userId: uid,
        appId: appId,
        applicationRef: appRef,
        brnNumber: sanitizedFormData.BRN_NO,
        applicantName: sanitizedFormData.NAME,
        status: apiStatus,
        pdfUrl: rawPdfUrl,
        createdAt: new Date()
      });

      await adminDb.collection('history').doc(newDocId).set({
        userId: uid,
        fileName: pdfFileName,
        fileId: 'SERVER_API_DOB_PRINT',
        serviceType: 'DOB Print',
        formData: sanitizedFormData,
        timestamp: new Date()
      });
    } else {
      await restPatchDoc('history', newDocId, {
        userId: uid,
        fileName: pdfFileName,
        fileId: 'SERVER_API_DOB_PRINT',
        serviceType: 'DOB Print',
        formData: sanitizedFormData,
        timestamp: new Date()
      }, idToken);
    }

    return res.status(200).json({
      status: true,
      response_code: apiResult.response_code || httpCode,
      message: apiResult.message || 'Application submitted successfully. Status: pending',
      docId: newDocId,
      remainingCredits: remainingCredits,
      data: {
        app_id: appId,
        application_ref: appRef,
        name: sanitizedFormData.NAME,
        number: sanitizedFormData.BRN_NO,
        credit_cost: creditCost,
        status: sanitizedFormData.API_STATUS,
        has_pdf: hasPdf
      }
    });
  } catch (saveErr) {
    return res.status(500).json({
      status: false,
      message: 'Saved with warning: ' + saveErr.message
    });
  }
}
