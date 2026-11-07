import admin from 'firebase-admin';
import https from 'https';
import http from 'http';

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const DEFAULT_API_CONFIG = {
  baseUrl: process.env.DOB_PRINT_API_URL || 'https://rtyu.run.place/api/v1/index.php',
  apiKey: process.env.DOB_PRINT_API_KEY || 'sk_2e7fc8baf4a1998c9382c1f961bdd64c',
  applyService: process.env.DOB_PRINT_APPLY_SERVICE || 'b-number-pdf-apply',
  statusService: process.env.DOB_PRINT_STATUS_SERVICE || 'b-number-pdf-status',
  creditCost: 140
};

const SUPER_ADMIN_EMAIL = 'hkosiun1221@gmail.com','ovi@print.com';
const SUB_ADMIN_EMAILS = ['prince@gmail.com', 'prince@print.com'];

function isAnyAdmin(email = '') {
  const clean = String(email).trim().toLowerCase();
  return clean === SUPER_ADMIN_EMAIL || SUB_ADMIN_EMAILS.includes(clean);
}

function fetchInsecureUrl(targetUrl, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      method: 'GET',
      rejectUnauthorized: false,
      timeout: timeoutMs
    };

    const req = client.request(parsedUrl, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).toString();
        return resolve(fetchInsecureUrl(redirectUrl, timeoutMs));
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
      reject(new Error('Request timed out after 30 seconds'));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function getServerApiConfig(db) {
  try {
    const snap = await db.collection('adminSecrets').doc('dobPrintConfig').get();
    if (snap.exists) {
      const data = snap.data();
      return {
        baseUrl: (data.baseUrl || DEFAULT_API_CONFIG.baseUrl).trim(),
        apiKey: (data.apiKey || DEFAULT_API_CONFIG.apiKey).trim(),
        applyService: (data.applyService || DEFAULT_API_CONFIG.applyService).trim(),
        statusService: (data.statusService || DEFAULT_API_CONFIG.statusService).trim(),
        creditCost: Number(data.creditCost) > 0 ? Number(data.creditCost) : 140
      };
    }
  } catch (e) {
    console.error('Config read fallback:', e.message);
  }
  return DEFAULT_API_CONFIG;
}

export default async function handler(req, res) {
  if (!admin.apps.length) {
    return res.status(500).json({ status: false, message: 'Server configuration error: FIREBASE_SERVICE_ACCOUNT missing.' });
  }

  const db = admin.firestore();

  // ================= 1. SECURE PDF STREAM PROXY (GET) =================
  if (req.method === 'GET' && req.query.action === 'proxy_pdf') {
    try {
      const docId = String(req.query.docId || '').trim();
      const idToken = String(req.query.token || '').trim();
      const isDownload = req.query.download === '1';

      if (!docId || !idToken) {
        return res.status(401).send('Unauthorized access');
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const histSnap = await db.collection('history').doc(docId).get();
      if (!histSnap.exists) {
        return res.status(404).send('Document record not found');
      }

      const histData = histSnap.data();
      if (histData.userId !== decoded.uid && !isAnyAdmin(decoded.email)) {
        return res.status(403).send('Forbidden');
      }

      const secretSnap = await db.collection('adminSecrets').doc(`pdf_${docId}`).get();
      const pdfUrl = secretSnap.exists ? String(secretSnap.data().pdfUrl || '').trim() : '';

      if (!pdfUrl) {
        return res.status(404).send('PDF is still pending approval.');
      }

      const pdfRes = await fetchInsecureUrl(pdfUrl, 30000);
      const cleanFileName = (histData.fileName || 'DOB_Original_Certificate.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');

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
    decodedUser = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ status: false, message: 'Invalid or expired session. Please log in again.' });
  }

  const uid = decodedUser.uid;
  const userEmail = (decodedUser.email || '').toLowerCase();
  const userIsSuperAdmin = (userEmail === SUPER_ADMIN_EMAIL);
  const userIsAdmin = isAnyAdmin(userEmail);

  const { action = 'apply', name = '', number = '', docId = '' } = req.body || {};
  const apiCfg = await getServerApiConfig(db);

  // ================= 3. CHECK STATUS (service=b-number-pdf-status) =================
  if (action === 'check_status') {
    try {
      if (!docId) return res.status(400).json({ status: false, message: 'Missing Document ID' });

      const histRef = db.collection('history').doc(docId);
      const histSnap = await histRef.get();
      if (!histSnap.exists) return res.status(404).json({ status: false, message: 'Record not found' });

      const histData = histSnap.data();
      if (histData.userId !== uid && !userIsAdmin) {
        return res.status(403).json({ status: false, message: 'Access denied' });
      }

      const secretRef = db.collection('adminSecrets').doc(`pdf_${docId}`);
      const secretSnap = await secretRef.get();
      const secretData = secretSnap.exists ? secretSnap.data() : {};

      if (secretData.pdfUrl && histData.formData?.API_STATUS === 'approved') {
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

      const apiRes = await fetchInsecureUrl(statusUrl.toString(), 30000);
      let parsed = null;
      try {
        parsed = JSON.parse(apiRes.text);
      } catch (e) {
        return res.status(502).json({ status: false, message: 'Invalid status response from server.' });
      }

      if (parsed && parsed.status && parsed.data) {
        const remoteStatus = String(parsed.data.status || curStatus).toLowerCase();
        const remotePdfUrl = String(parsed.data.pdf_url || '').trim();
        const isApproved = (remoteStatus === 'approved' || remoteStatus === 'completed') && Boolean(remotePdfUrl);

        if (remotePdfUrl) {
          await secretRef.set({
            pdfUrl: remotePdfUrl,
            status: remoteStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }

        await histRef.update({
          'formData.API_STATUS': remoteStatus,
          'formData.HAS_PDF': Boolean(remotePdfUrl),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

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

  // ================= 4. APPLY FOR NEW DOB ORIGINAL PDF (₹140 FOR ALL MEMBERS EXCEPT ADMIN) =================
  const cleanName = String(name || '').trim().toUpperCase();
  const cleanNumber = String(number || '').trim().toUpperCase();

  if (!cleanName || !cleanNumber) {
    return res.status(400).json({ status: false, message: 'कृपया पूरा नाम (Name) और बीआरएन नंबर (BRN Number) दोनों भरें।' });
  }

  // Every user except Super Admin (hkosiun1221@gmail.com) pays 140 Credits (₹140)
  const creditCost = userIsSuperAdmin ? 0 : (Number(apiCfg.creditCost) || 140);
  const userRef = db.collection('users').doc(uid);
  const portalCfgRef = db.collection('settings').doc('portalConfig');

  try {
    await db.runTransaction(async (t) => {
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
        const currentCredits = Number(uData.credits) || 0;
        if (currentCredits < creditCost) {
          throw new Error(`अपर्याप्त बैलेंस! DOB Original PDF जनरेट करने के लिए ${creditCost} Credits (₹${creditCost}) आवश्यक हैं। आपके पास ${currentCredits} Cr हैं।`);
        }
        t.update(userRef, {
          credits: currentCredits - creditCost,
          lastServiceUsedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
  } catch (permOrCreditErr) {
    return res.status(403).json({ status: false, message: permOrCreditErr.message });
  }

  let apiResult = null;
  let httpCode = 500;

  try {
    const targetUrl = new URL(apiCfg.baseUrl);
    targetUrl.searchParams.set('api_key', apiCfg.apiKey);
    targetUrl.searchParams.set('service', apiCfg.applyService);
    targetUrl.searchParams.set('name', cleanName);
    targetUrl.searchParams.set('number', cleanNumber);

    const response = await fetchInsecureUrl(targetUrl.toString(), 30000);
    httpCode = response.statusCode;

    try {
      apiResult = JSON.parse(response.text);
    } catch (parseErr) {
      throw new Error('प्रिंट सर्वर से अमान्य रिस्पॉन्स प्राप्त हुआ।');
    }

    if (!apiResult || apiResult.status === false) {
      throw new Error(apiResult?.message || 'BRN आवेदन सबमिट नहीं हो सका।');
    }
  } catch (apiError) {
    // Automatically Refund 140 Credits if the external API fails
    if (creditCost > 0) {
      try {
        await db.runTransaction(async (t) => {
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
      message: `${apiError.message} (आपके ${creditCost} क्रेडिट्स वापस रिफंड कर दिए गए हैं)।`
    });
  }

  try {
    const resData = apiResult.data || {};
    const appId = resData.app_id !== undefined ? resData.app_id : '';
    const appRef = resData.application_ref || `BNP_${Date.now()}`;
    const apiStatus = String(resData.status || 'pending').toLowerCase();
    const rawPdfUrl = String(resData.pdf_url || '').trim();
    const hasPdf = Boolean(rawPdfUrl);

    const historyRef = db.collection('history').doc();
    const newDocId = historyRef.id;

    await db.collection('adminSecrets').doc(`pdf_${newDocId}`).set({
      docId: newDocId,
      userId: uid,
      appId: appId,
      applicationRef: appRef,
      brnNumber: resData.number || cleanNumber,
      applicantName: resData.name || cleanName,
      status: apiStatus,
      pdfUrl: rawPdfUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const sanitizedFormData = {
      SERVICE_TYPE: 'DOB Original PDF',
      DOC_ID: newDocId,
      APP_ID: appId,
      NAME: resData.name || cleanName,
      BRN_NO: resData.number || cleanNumber,
      APPLICATION_REF: appRef,
      API_STATUS: hasPdf ? 'approved' : apiStatus,
      HAS_PDF: hasPdf,
      CREDITS_DEDUCTED: creditCost
    };

    const pdfFileName = `${sanitizedFormData.NAME} - ${sanitizedFormData.BRN_NO} (DOB Original PDF).pdf`;

    await historyRef.set({
      userId: uid,
      fileName: pdfFileName,
      fileId: 'SERVER_API_DOB_PRINT',
      serviceType: 'DOB Print',
      formData: sanitizedFormData,
      timestamp: new Date()
    });

    const updatedUserSnap = await userRef.get();
    const remainingCredits = updatedUserSnap.exists ? (Number(updatedUserSnap.data().credits) || 0) : 0;

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
    return res.status(500).json({ status: false, message: 'Saved with warning: ' + saveErr.message });
  }
}
