import admin from 'firebase-admin';

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Strict Server-Side Pricing Table (Cannot be manipulated from browser)
const VALID_VIP_PLANS = {
  0: 0,
  30: 149,
  60: 249,
  90: 299
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    const {
      userId,
      email,
      username,
      totalPayable,
      creditsRequested,
      wantsVip,
      vipDaysRequested
    } = req.body || {};

    const cleanUserId = String(userId || '').trim();
    const cleanCredits = Math.floor(Math.max(0, Number(creditsRequested) || 0));
    const cleanVipDays = wantsVip ? (Number(vipDaysRequested) || 0) : 0;

    if (!cleanUserId || VALID_VIP_PLANS[cleanVipDays] === undefined) {
      return res.status(400).json({ status: false, message: 'Invalid user or VIP plan selection' });
    }

    // Enforce minimum recharge rules on server side
    if (!wantsVip && cleanCredits < 100) {
      return res.status(400).json({ status: false, message: 'Minimum credit recharge is ₹100' });
    }
    if (wantsVip && cleanCredits > 0 && cleanCredits < 100) {
      return res.status(400).json({ status: false, message: 'Minimum credit add-on with VIP is ₹100' });
    }

    const serverVipFee = VALID_VIP_PLANS[cleanVipDays];
    const serverTotalPayable = cleanCredits + serverVipFee;

    // Reject if client-sent totalPayable does not match server-calculated total
    if (serverTotalPayable < 100 || Number(totalPayable) !== serverTotalPayable) {
      return res.status(400).json({ status: false, message: 'Security validation failed: Amount mismatch' });
    }

    const orderId = `OJAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const productInfo = cleanVipDays > 0 ? `Ojas VIP ${cleanVipDays}d + ${cleanCredits} Cr` : `Ojas ${cleanCredits} Credits`;

    if (admin.apps.length) {
      const db = admin.firestore();
      await db.collection('payments').doc(orderId).set({
        orderId: orderId,
        userId: cleanUserId,
        email: String(email || '').trim().toLowerCase(),
        amountPaid: serverTotalPayable,
        creditsRequested: cleanCredits,
        wantsVip: cleanVipDays > 0,
        vipDaysRequested: cleanVipDays,
        vipPlanFee: serverVipFee,
        utrNumber: 'AUTO_WAITING',
        status: 'Pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    let gatewayData = {};
    if (process.env.VYAPARGATEWAY_API_KEY) {
      try {
        const vgRes = await fetch('https://vyapargateway.com/api/v1/create_order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.VYAPARGATEWAY_API_KEY
          },
          body: JSON.stringify({
            key: process.env.VYAPARGATEWAY_API_KEY,
            client_txn_id: orderId,
            amount: serverTotalPayable,
            p_info: productInfo,
            customer_name: username || 'Ojas User',
            customer_email: email || 'user@print.com',
            customer_mobile: '9999999999',
            callback_url: `${req.headers.origin || 'https://upeprint.vercel.app'}/api/webhook`,
            redirect_url: `${req.headers.origin || 'https://upeprint.vercel.app'}/portal`
          })
        });
        gatewayData = await vgRes.json();
      } catch (e) {
        console.error('Gateway API Error:', e);
      }
    }

    const resObj = gatewayData.data || gatewayData.result || gatewayData || {};
    return res.status(200).json({
      status: true,
      orderId: orderId,
      payment_url: resObj.payment_url || '',
      upi_string: resObj.upi_string || resObj.upi_intent || '',
      qr_code: resObj.qr_code || ''
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
}
