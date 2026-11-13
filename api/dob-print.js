import crypto from 'crypto';
import https from 'https';
import http from 'http';

// ============================================================================
// FILE: api/dob-print.js
// Server-Side Locked BRN Original PDF Gateway (₹140 / 140 Credits)
// ============================================================================

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'upeprint';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCjvAVdtOWmyDx4MPYW-0UPsAj7UKEKCuo';

const DEFAULT_API_CONFIG = {
  baseUrl: process.env.DOB_PRINT_API_URL || 'https://rtyu.run.place/api/v1/index.php',
  apiKey: (process.env.DOB_PRINT_API_KEY || '').trim(),
  applyService: process.env.DOB_PRINT_APPLY_SERVICE || 'b-number-pdf-apply',
  statusService: process.env.DOB_PRINT_STATUS_SERVICE || 'b-number-pdf-status',
  creditCost: Number(process.env.DOB_PRINT_CREDIT_COST) || 140
};

const SUPER_ADMIN_EMAILS = ['hkosiun1221@gmail.com', 'ovi@print.com'];
const SUB_ADMIN_EMAILS = ['prince@gmail.com', 'prince@print.com'];

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

function normalizeOrderStatus(rawStatusVal, hasPdf = false) {
  if (hasPdf) return 'successful';
  if (rawStatusVal === null || rawStatusVal === undefined || typeof rawStatusVal === 'boolean') {
    return 'pending';
  }
  const s = String(rawStatusVal).trim().toLowerCase();
  if (
    !s || s === 'true' || s === '1' || s === 'ok' || s === 'pending' ||
    s === 'processing' || s === 'submitted' || s === 'in_progress' || s === 'queued' || s === 'waiting'
  ) {
    return 'pending';
  }
  if (
    s === 'approved' || s === 'completed' || s === 'complete' || s === 'success' ||
    s === 'successful' || s === 'generated' || s === 'done' || s === 'ready'
  ) {
    return 'successful';
  }
  if (s === 'rejected' || s === 'failed' || s === 'error' || s === 'cancelled' || s === 'canceled') {
    return 'failed';
  }
  return 'pending';
}

function resolvePdfUrlOrData(rawCandidate = '', baseUrl = DEFAULT_API_CONFIG.baseUrl) {
  const val = String(rawCandidate || '').trim();
  if (!val || val === 'null' || val === 'undefined' || val === 'false' || val === 'true') return '';
  if (val.startsWith('data:application/pdf')) return val;
  if (val.startsWith('JVBERi0')) return `data:application/pdf;base64,${val}`;
  if (val.startsWith('http://') || val.startsWith('https://')) return val;
  try {
    return new URL(val, baseUrl).toString();
  } catch (e) {
    return val;
  }
}

function extractOrderDetailsFromApi(parsed, targetBrn = '', targetRef = '', targetAppId = '', baseUrl = DEFAULT_API_CONFIG.baseUrl) {
  if (!parsed || typeof parsed !== 'object') {
    return { appId: '', appRef: '', status: 'pending', pdfUrl: '', hasPdf: false };
  }

  const cleanTargetBrn = String(targetBrn || '').trim().toUpperCase();
  const cleanTargetRef = String(targetRef || '').trim().toUpperCase();
  const cleanTargetAppId = String(targetAppId || '').trim();

  const candidates = [];
  const pushCandidate = (item) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      item.forEach(pushCandidate);
    } else {
      candidates.push(item);
      if (item.data && typeof item.data === 'object') pushCandidate(item.data);
      if (item.application && typeof item.application === 'object') pushCandidate(item.application);
      if (item.order && typeof item.order === 'object') pushCandidate(item.order);
      if (item.result && typeof item.result === 'object') pushCandidate(item.result);
      if (item.records && typeof item.records === 'object') pushCandidate(item.records);
      if (item.orders && typeof item.orders === 'object') pushCandidate(item.orders);
    }
  };
  pushCandidate(parsed);

  let primaryRec = candidates.find((c) => {
    if (c === parsed && candidates.length > 1) return false;
    const cBrn = String(c.number || c.b_number || c.brn || c.brn_no || '').trim().toUpperCase();
    const cRef = String(c.application_ref || c.app_ref || c.ref_id || c.reference || c.order_ref || '').trim().toUpperCase();
    const cId = String(c.app_id ?? c.id ?? c.order_id ?? c.application_id ?? '').trim();
    if (cleanTargetBrn && cBrn && cBrn === cleanTargetBrn) return true;
    if (cleanTargetRef && !cleanTargetRef.startsWith('LOCAL_') && cRef && cRef === cleanTargetRef) return true;
    if (cleanTargetAppId && cId && cId === cleanTargetAppId) return true;
    return false;
  });

  if (!primaryRec) {
    primaryRec = candidates.find((c) => c !== parsed) || parsed;
  }

  const searchObjs = [primaryRec, parsed];

  let appId = '';
  for (const obj of searchObjs) {
    if (!obj || typeof obj !== 'object') continue;
    const idVal = obj.app_id ?? obj.application_id ?? obj.id ?? obj.order_id ?? obj.request_id;
    if (idVal !== undefined && idVal !== null && String(idVal).trim() !== '') {
      appId = String(idVal).trim();
      break;
    }
  }

  let appRef = '';
  for (const obj of searchObjs) {
    if (!obj || typeof obj !== 'object') continue;
    const refVal =
      obj.application_ref || obj.app_ref || obj.ref_id || obj.reference_id ||
      obj.reference || obj.ref_no || obj.order_ref || obj.txn_id || obj.token;
    if (refVal && String(refVal).trim() !== '') {
      appRef = String(refVal).trim();
      break;
    }
  }

  const pdfKeys = [
    'pdf_url', 'pdfUrl', 'pdf_link', 'pdfLink', 'pdf_file', 'pdfFile', 'pdf_path', 'pdfPath',
    'pdf', 'file_url', 'fileUrl', 'file_link', 'file_path', 'file', 'download_url', 'downloadUrl',
    'download_link', 'downloadLink', 'download_pdf', 'download', 'certificate_url', 'certificateUrl',
    'certificate_pdf', 'cert_url', 'document_url', 'doc_url', 'url', 'link', 'output_pdf',
    'result_pdf', 'pdf_base64', 'base64_pdf', 'base64', 'pdf_data'
  ];

  let rawPdfCandidate = '';
  for (const obj of searchObjs) {
    if (!obj || typeof obj !== 'object') continue;
    for (const k of pdfKeys) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim().length > 4 && v.trim() !== 'null' && v.trim() !== 'false') {
        rawPdfCandidate = v.trim();
        break;
      }
    }
    if (rawPdfCandidate) break;
  }

  if (!rawPdfCandidate) {
    for (const obj of searchObjs) {
      if (!obj || typeof obj !== 'object') continue;
      for (const [, v] of Object.entries(obj)) {
        if (typeof v !== 'string') continue;
        const s = v.trim();
        if (
          s.startsWith('data:application/pdf') ||
          s.startsWith('JVBERi0') ||
          /\.pdf(\?.*)?$/i.test(s) ||
          ((s.startsWith('http://') || s.startsWith('https://')) &&
            (s.toLowerCase().includes('pdf') || s.toLowerCase().includes('download') || s.toLowerCase().includes('cert') || s.toLowerCase().includes('file')))
        ) {
          rawPdfCandidate = s;
          break;
        }
      }
      if (rawPdfCandidate) break;
    }
  }

  const pdfUrl = resolvePdfUrlOrData(rawPdfCandidate, baseUrl);
  const hasPdf = Boolean(pdfUrl);

  let rawStatusVal = undefined;
  for (const obj of searchObjs) {
    if (!obj || typeof obj !== 'object') continue;
    const candidateStat =
      obj.application_status ?? obj.order_status ?? obj.pdf_status ??
      obj.app_status ?? obj.current_status ?? obj.state ??
      (typeof obj.status === 'string' && obj.status.trim().toLowerCase() !== 'true' ? obj.status : undefined);
    if (candidateStat !== undefined && candidateStat !== null && String(candidateStat).trim() !== '') {
      rawStatusVal = candidateStat;
      break;
    }
  }

  const status = normalizeOrderStatus(rawStatusVal, hasPdf);
  return {
    appId,
    appRef,
    status,
    pdfUrl,
    hasPdf,
    name: String(primaryRec?.name || primaryRec?.applicant_name || primaryRec?.full_name || '').trim().toUpperCase(),
    number: String(primaryRec?.number || primaryRec?.b_number || primaryRec?.brn || '').trim().toUpperCase()
  };
}

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

async function verifyFirebaseUserToken(idToken) {
  if (!idToken) throw new Error('Authentication token missing');

  if (cachedAdminApp) {
    try {
      const decoded = await cachedAdminApp.auth().verifyIdToken(idToken);
      return { uid: decoded.uid, email: (decoded.email || '').toLowerCase() };
    } catch (e) {}
  }

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

async function recordRefundAndCreditUser(adminDb, idToken, uid, userEmail, refundCredits, brnNumber, applicantName, docId, reasonText) {
  if (!refundCredits || refundCredits <= 0) return { refunded: false, updatedCredits: 0 };
  let updatedCredits = 0;
  const refundDocId = `refund_${docId || Date.now()}`;

  if (adminDb) {
    const refundPaymentData = {
      userId: uid,
      email: userEmail || '',
      amountPaid: 0,
      creditsRequested: refundCredits,
      wantsVip: false,
      vipDaysRequested: 0,
      vipPlanFee: 0,
      utrNumber: brnNumber || 'AUTO_REFUND',
      status: 'Refunded',
      type: 'SERVICE_REFUND',
      serviceType: 'DOB Original PDF',
      relatedDocId: docId || '',
      note: reasonText || `Auto-Refund: DOB Original PDF Cancelled (${applicantName} - ${brnNumber})`,
      timestamp: new Date()
    };

    const userRef = adminDb.collection('users').doc(uid);
    await adminDb.runTransaction(async (t) => {
      const uSnap = await t.get(userRef);
      if (uSnap.exists) {
        const cur = Number(uSnap.data().credits) || 0;
        updatedCredits = cur + refundCredits;
        t.update(userRef, { credits: updatedCredits });
      }
      const payRef = adminDb.collection('payments').doc(refundDocId);
      t.set(payRef, refundPaymentData, { merge: true });
    });
    return { refunded: true, updatedCredits };
  }

  // REST fallback: Firestore rules block client-token credit increases, so log a Pending Refund Ticket
  try {
    await restPatchDoc('payments', refundDocId, {
      userId: uid,
      email: userEmail || '',
      amountPaid: 0,
      creditsRequested: refundCredits,
      wantsVip: false,
      vipDaysRequested: 0,
      vipPlanFee: 0,
      utrNumber: brnNumber || 'AUTO_REFUND',
      status: 'Pending (Ticket Raised - 24-48h)',
      type: 'SERVICE_REFUND',
      serviceType: 'DOB Original PDF',
      relatedDocId: docId || '',
      note: reasonText || `Auto-Refund Ticket: DOB Original PDF Failed (${applicantName} - ${brnNumber})`,
      timestamp: new Date()
    }, idToken);
  } catch (e) {}
  return { refunded: false, ticketLogged: true, updatedCredits: 0 };
}

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

async function queryUpstreamStatusAndPdf(apiCfg, appId = '', appRef = '', brnNumber = '', applicantName = '') {
  const attempts = [];

  const url1 = new URL(apiCfg.baseUrl);
  url1.searchParams.set('api_key', apiCfg.apiKey);
  url1.searchParams.set('service', apiCfg.statusService);
  if (appId) url1.searchParams.set('app_id', String(appId));
  if (appRef && !String(appRef).startsWith('LOCAL_')) url1.searchParams.set('application_ref', String(appRef));
  if (brnNumber) url1.searchParams.set('number', String(brnNumber));
  if (applicantName) url1.searchParams.set('name', String(applicantName));
  attempts.push(url1.toString());

  if (brnNumber) {
    const url2 = new URL(apiCfg.baseUrl);
    url2.searchParams.set('api_key', apiCfg.apiKey);
    url2.searchParams.set('service', apiCfg.statusService);
    url2.searchParams.set('number', String(brnNumber));
    if (url2.toString() !== url1.toString()) attempts.push(url2.toString());
  }

  if (appRef) {
    const url3 = new URL(apiCfg.baseUrl);
    url3.searchParams.set('api_key', apiCfg.apiKey);
    url3.searchParams.set('service', apiCfg.statusService);
    url3.searchParams.set('application_ref', String(appRef));
    if (!attempts.includes(url3.toString())) attempts.push(url3.toString());
  }

  const url4 = new URL(apiCfg.baseUrl);
  url4.searchParams.set('api_key', apiCfg.apiKey);
  url4.searchParams.set('service', apiCfg.statusService);
  if (!attempts.includes(url4.toString())) attempts.push(url4.toString());

  let lastParsed = null;
  let lastExtracted = { appId, appRef, status: 'pending', pdfUrl: '', hasPdf: false };
  let lastHttpCode = 200;

  for (const targetUrl of attempts) {
    try {
      const apiRes = await fetchExternalUrl(targetUrl, 25000);
      lastHttpCode = apiRes.statusCode;

      if (
        apiRes.buffer &&
        apiRes.buffer.length > 100 &&
        apiRes.buffer.slice(0, 5).toString('ascii') === '%PDF-'
      ) {
        return {
          parsed: { status: true, message: 'Direct PDF stream received' },
          extracted: {
            appId,
            appRef,
            status: 'successful',
            pdfUrl: targetUrl,
            hasPdf: true
          },
          httpCode: lastHttpCode
        };
      }

      const parsed = parseExternalApiJson(apiRes.text, apiRes.statusCode);
      lastParsed = parsed;
      const extracted = extractOrderDetailsFromApi(parsed, brnNumber, appRef, appId, apiCfg.baseUrl);
      lastExtracted = extracted;

      if (extracted.hasPdf || extracted.status === 'successful') {
        return { parsed, extracted, httpCode: lastHttpCode };
      }
    } catch (e) {}
  }

  return { parsed: lastParsed, extracted: lastExtracted, httpCode: lastHttpCode };
}

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
      let secretData = {};
      let pdfUrl = '';

      if (adminDb) {
        const histSnap = await adminDb.collection('history').doc(docId).get();
        if (!histSnap.exists) return res.status(404).send('Document record not found');
        histData = histSnap.data();

        const secretSnap = await adminDb.collection('adminSecrets').doc(`pdf_${docId}`).get();
        if (secretSnap.exists) {
          secretData = secretSnap.data();
          if (secretData.pdfUrl) pdfUrl = String(secretData.pdfUrl).trim();
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
        const apiCfg = await getServerApiConfig(adminDb, idToken);
        const appId = secretData.appId !== undefined ? secretData.appId : (histData.formData?.APP_ID || '');
        const appRef = secretData.applicationRef || histData.formData?.APPLICATION_REF || '';
        const brnNumber = secretData.brnNumber || histData.formData?.BRN_NO || '';
        const applicantName = secretData.applicantName || histData.formData?.NAME || '';

        const liveCheck = await queryUpstreamStatusAndPdf(apiCfg, appId, appRef, brnNumber, applicantName);
        if (liveCheck.extracted.hasPdf && liveCheck.extracted.pdfUrl) {
          pdfUrl = liveCheck.extracted.pdfUrl;
          const encryptedToken = encryptSecretText(pdfUrl);
          const updatedFormData = {
            ...(histData.formData || {}),
            API_STATUS: 'successful',
            HAS_PDF: true,
            ENCRYPTED_PDF_TOKEN: encryptedToken
          };
          try {
            if (adminDb) {
              await adminDb.collection('adminSecrets').doc(`pdf_${docId}`).set({
                pdfUrl,
                status: 'successful',
                updatedAt: new Date()
              }, { merge: true });
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
          } catch (e) {}
        }
      }

      if (!pdfUrl) {
        return res.status(404).send('PDF is still PENDING on the print server. Please try again in a few moments.');
      }

      const cleanFileName = String(histData.fileName || 'DOB_Original_Certificate.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');

      if (pdfUrl.startsWith('data:application/pdf;base64,')) {
        const b64Data = pdfUrl.split(',')[1] || '';
        const pdfBuffer = Buffer.from(b64Data, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${cleanFileName}"`);
        return res.status(200).send(pdfBuffer);
      }

      let pdfRes = await fetchExternalUrl(pdfUrl, 30000);
      if (
        pdfRes.buffer.length < 200 ||
        (pdfRes.buffer.slice(0, 5).toString('ascii') !== '%PDF-' && !pdfUrl.includes('api_key='))
      ) {
        try {
          const apiCfg = await getServerApiConfig(adminDb, idToken);
          const retryUrl = new URL(pdfUrl, apiCfg.baseUrl);
          retryUrl.searchParams.set('api_key', apiCfg.apiKey);
          const retryRes = await fetchExternalUrl(retryUrl.toString(), 30000);
          if (retryRes.buffer.slice(0, 5).toString('ascii') === '%PDF-' || retryRes.buffer.length > pdfRes.buffer.length) {
            pdfRes = retryRes;
          }
        } catch (e) {}
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${cleanFileName}"`);
      return res.status(200).send(pdfRes.buffer);
    } catch (err) {
      return res.status(500).send('Error streaming PDF: ' + err.message);
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

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

  if (!apiCfg.apiKey) {
    return res.status(500).json({ status: false, message: 'DOB Original PDF API Key is not configured on the server.' });
  }

  // ================= 3. CHECK STATUS =================
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
      const existingStatusNorm = normalizeOrderStatus(histData.formData?.API_STATUS, Boolean(existingPdfUrl));

      if (existingPdfUrl && existingStatusNorm === 'successful') {
        return res.status(200).json({
          status: true,
          apiStatus: 'successful',
          hasPdf: true,
          message: '✅ SUCCESSFUL! आपकी ओरिजिनल जन्म प्रमाण-पत्र PDF डाउनलोड के लिए तैयार है।'
        });
      }

      const appId = secretData.appId !== undefined ? secretData.appId : (histData.formData?.APP_ID || '');
      const appRef = secretData.applicationRef || histData.formData?.APPLICATION_REF || '';
      const brnNumber = secretData.brnNumber || histData.formData?.BRN_NO || '';
      const applicantName = secretData.applicantName || histData.formData?.NAME || '';

      const { parsed, extracted, httpCode } = await queryUpstreamStatusAndPdf(
        apiCfg,
        appId,
        appRef,
        brnNumber,
        applicantName
      );

      const remotePdfUrl = extracted.pdfUrl || existingPdfUrl || '';
      const hasPdf = Boolean(remotePdfUrl);
      const finalStatus = normalizeOrderStatus(extracted.status, hasPdf);
      const encryptedToken = remotePdfUrl ? encryptSecretText(remotePdfUrl) : (histData.formData?.ENCRYPTED_PDF_TOKEN || '');

      let isRefundedNow = Boolean(histData.formData?.REFUNDED);
      const deductedCr = Number(histData.formData?.CREDITS_DEDUCTED) || 140;
      let refundTicketLogged = false;
      if (finalStatus === 'failed' && !isRefundedNow && deductedCr > 0) {
        try {
          const refRes = await recordRefundAndCreditUser(
            adminDb,
            idToken,
            histData.userId || uid,
            userEmail,
            deductedCr,
            brnNumber,
            applicantName,
            docId,
            `Auto-Refund: DOB Original PDF Cancelled/Rejected (${applicantName} - ${brnNumber})`
          );
          isRefundedNow = refRes.refunded;
          refundTicketLogged = Boolean(refRes.ticketLogged);
        } catch (refErr) {
          console.warn('Auto-refund on failed status warning:', refErr.message);
        }
      }

      const updatedFormData = {
        ...(histData.formData || {}),
        APP_ID: extracted.appId || appId,
        APPLICATION_REF: extracted.appRef || appRef,
        API_STATUS: finalStatus,
        HAS_PDF: hasPdf,
        REFUNDED: isRefundedNow,
        REFUND_CREDITS: isRefundedNow ? deductedCr : 0,
        ENCRYPTED_PDF_TOKEN: encryptedToken
      };

      try {
        if (adminDb) {
          if (remotePdfUrl || extracted.appId || extracted.appRef) {
            await adminDb.collection('adminSecrets').doc(`pdf_${docId}`).set({
              pdfUrl: remotePdfUrl,
              status: finalStatus,
              appId: extracted.appId || appId,
              applicationRef: extracted.appRef || appRef,
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
      } catch (saveUpdateErr) {
        console.warn('History update warning:', saveUpdateErr.message);
      }

      return res.status(200).json({
        status: true,
        response_code: parsed?.response_code || httpCode,
        apiStatus: finalStatus,
        hasPdf: hasPdf,
        refunded: isRefundedNow,
        message: hasPdf || finalStatus === 'successful'
          ? '✅ SUCCESSFUL! आपकी ओरिजिनल जन्म प्रमाण-पत्र PDF तैयार हो गई है। अब आप Preview या Download PDF पर क्लिक कर सकते हैं।'
          : (finalStatus === 'failed'
              ? (isRefundedNow
                  ? `❌ यह आवेदन कैंसिल/रिजेक्ट हो गया है। आपके +${deductedCr} Credits वॉलेट में वापस रिफंड कर दिए गए हैं!`
                  : (refundTicketLogged
                      ? `❌ यह आवेदन कैंसिल/रिजेक्ट हो गया है। +${deductedCr} Credits रिफंड टिकट एडमिन को भेज दिया गया है।`
                      : `❌ यह आवेदन कैंसिल/रिजेक्ट हो गया है। कृपया रिफंड के लिए एडमिन से संपर्क करें।`))
              : `⏳ वर्तमान स्टेटस: PENDING (प्रिंट सर्वर पर प्रक्रिया में है, कृपया थोड़ी देर बाद दोबारा चेक करें)`)
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
  let directApplyPdfUrl = '';

  try {
    const targetUrl = new URL(apiCfg.baseUrl);
    targetUrl.searchParams.set('api_key', apiCfg.apiKey);
    targetUrl.searchParams.set('service', apiCfg.applyService);
    targetUrl.searchParams.set('name', cleanName);
    targetUrl.searchParams.set('number', cleanNumber);

    const response = await fetchExternalUrl(targetUrl.toString(), 30000);
    httpCode = response.statusCode;

    if (
      response.buffer &&
      response.buffer.length > 100 &&
      response.buffer.slice(0, 5).toString('ascii') === '%PDF-'
    ) {
      directApplyPdfUrl = targetUrl.toString();
      apiResult = { status: true, message: 'PDF generated successfully' };
    } else {
      apiResult = parseExternalApiJson(response.text, httpCode);
    }

    if (!apiResult || apiResult.status === false) {
      throw new Error(apiResult?.message || 'BRN आवेदन सबमिट नहीं हो सका।');
    }
  } catch (apiError) {
    let refundedDirect = false;
    let refundTicket = false;
    if (creditCost > 0) {
      try {
        const refRes = await recordRefundAndCreditUser(
          adminDb,
          idToken,
          uid,
          userEmail,
          creditCost,
          cleanNumber,
          cleanName,
          `apply_${Date.now()}`,
          `Auto-Refund: DOB Original PDF Apply Failed (${cleanName} - ${cleanNumber})`
        );
        refundedDirect = refRes.refunded;
        refundTicket = Boolean(refRes.ticketLogged);
      } catch (refundErr) {
        console.error('Refund error:', refundErr);
      }
    }
    return res.status(502).json({
      status: false,
      message: refundedDirect
        ? `${apiError.message} (आपके ${creditCost} क्रेडिट्स वापस रिफंड कर दिए गए हैं)।`
        : (refundTicket
            ? `${apiError.message} (आपके ${creditCost} क्रेडिट्स रिफंड के लिए ऑटो-टिकट एडमिन को भेज दिया गया है)।`
            : apiError.message)
    });
  }

  // Step 4C: Extract Details, Perform Immediate Quick Status Check if PDF not in Apply Response, and Save
  try {
    let extracted = extractOrderDetailsFromApi(apiResult, cleanNumber, '', '', apiCfg.baseUrl);
    if (directApplyPdfUrl) {
      extracted.pdfUrl = directApplyPdfUrl;
      extracted.hasPdf = true;
      extracted.status = 'successful';
    }

    if (!extracted.hasPdf) {
      try {
        const immediateCheck = await queryUpstreamStatusAndPdf(
          apiCfg,
          extracted.appId,
          extracted.appRef,
          cleanNumber,
          cleanName
        );
        if (immediateCheck.extracted.hasPdf) {
          extracted.pdfUrl = immediateCheck.extracted.pdfUrl;
          extracted.hasPdf = true;
          extracted.status = 'successful';
        }
        if (!extracted.appId && immediateCheck.extracted.appId) extracted.appId = immediateCheck.extracted.appId;
        if (!extracted.appRef && immediateCheck.extracted.appRef) extracted.appRef = immediateCheck.extracted.appRef;
      } catch (e) {}
    }

    const appId = extracted.appId || '';
    const appRef = extracted.appRef || `LOCAL_${Date.now()}`;
    const rawPdfUrl = extracted.pdfUrl || '';
    const hasPdf = Boolean(rawPdfUrl);
    const normalizedStatus = normalizeOrderStatus(extracted.status, hasPdf);
    const newDocId = `dob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const sanitizedFormData = {
      SERVICE_TYPE: 'DOB Original PDF',
      DOC_ID: newDocId,
      APP_ID: appId,
      NAME: extracted.name || cleanName,
      BRN_NO: extracted.number || cleanNumber,
      APPLICATION_REF: appRef,
      API_STATUS: normalizedStatus,
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
        status: normalizedStatus,
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
      message: hasPdf
        ? '✅ SUCCESSFUL! आपकी ओरिजिनल PDF तुरंत जनरेट हो गई है। आप Document History से इसे अभी डाउनलोड कर सकते हैं।'
        : '✅ आवेदन सफलतापूर्वक सबमिट हो गया है! वर्तमान स्टेटस: PENDING',
      docId: newDocId,
      remainingCredits: remainingCredits,
      data: {
        app_id: appId,
        application_ref: appRef,
        name: sanitizedFormData.NAME,
        number: sanitizedFormData.BRN_NO,
        credit_cost: creditCost,
        status: normalizedStatus,
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
