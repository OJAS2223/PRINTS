import admin from 'firebase-admin';
import Razorpay from 'razorpay';

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

  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TwxsYylNMNurst';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'XBPoakp3drWN1LdGEEb6SQ2n';

  try {
    // Optional Firebase Auth Token check
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ') && admin.apps.length) {
      const idToken = authHeader.slice(7).trim();
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (authErr) {
        return res.status(401).json({ status: false, message: 'Unauthorized session token' });
      }
    }

    const {
      userId,
      email,
      username,
      totalPayable,
      creditsRequested,
      wantsVip,
      vipDaysRequested,
      currency = 'INR'
    } = req.body || {};

    const cleanUserId = String(userId || '').trim();
    const cleanCredits = Math.floor(Math.max(0, Number(creditsRequested) || 0));
    const cleanVipDays = wantsVip ? (Number(vipDaysRequested) || 0) : 0;

    if (!cleanUserId || VALID_VIP_PLANS[cleanVipDays] === undefined) {
      return res.status(400).json({ status: false, message: 'Invalid user or VIP plan selection' });
    }

    // Enforce minimum recharge rules on server side (₹100 = 10,000 paise)
    if (!wantsVip && cleanCredits < 100) {
      return res.status(400).json({ status: false, message: 'Minimum credit recharge is ₹100' });
    }
    if (wantsVip && cleanCredits > 0 && cleanCredits < 100) {
      return res.status(400).json({ status: false, message: 'Minimum credit add-on with VIP is ₹100' });
    }

    const serverVipFee = VALID_VIP_PLANS[cleanVipDays];
    const serverTotalPayable = cleanCredits + serverVipFee;
    const amountInPaise = Math.round(serverTotalPayable * 100);

    // Reject if client-sent totalPayable does not match server-calculated total
    if (amountInPaise < 100 || Number(totalPayable) !== serverTotalPayable) {
      return res.status(400).json({ status: false, message: 'Security validation failed: Amount mismatch' });
    }

    const receiptId = `OJAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const productInfo = cleanVipDays > 0 ? `Ojas VIP ${cleanVipDays}d + ${cleanCredits} Cr` : `Ojas ${cleanCredits} Credits`;

    let rzpOrderId = receiptId;
    let rzpAmount = amountInPaise;
    let rzpCurrency = currency;

    // 1. Create Order in Razorpay
    if (keyId && keySecret) {
      try {
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });
        const rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: currency,
          receipt: receiptId,
          notes: {
            userId: cleanUserId,
            email: String(email || '').trim().toLowerCase(),
            username: String(username || 'Ojas User'),
            creditsRequested: String(cleanCredits),
            vipDaysRequested: String(cleanVipDays),
            domain: 'ogasprints.in'
          }
        });
        if (rzpOrder && rzpOrder.id) {
          rzpOrderId = rzpOrder.id;
          rzpAmount = rzpOrder.amount;
          rzpCurrency = rzpOrder.currency;
        }
      } catch (rzpErr) {
        console.error('Razorpay Order Error:', rzpErr);
      }
    }

    // 2. Build UPI Intent & QR String for 1-Click Mobile Apps (GPay, PhonePe, Paytm) & QR Scan
    const upiQuery = `pa=8279650137@amazonpay&pn=${encodeURIComponent('Ojas Print Service')}&am=${serverTotalPayable}&cu=INR&tn=${encodeURIComponent(productInfo)}&tr=${encodeURIComponent(rzpOrderId)}`;
    const upiString = `upi://pay?${upiQuery}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiString)}`;

    // 3. Save Pending Order in Firestore
    if (admin.apps.length) {
      const db = admin.firestore();
      await db.collection('payments').doc(rzpOrderId).set({
        orderId: rzpOrderId,
        receiptId: receiptId,
        userId: cleanUserId,
        email: String(email || '').trim().toLowerCase(),
        amountPaid: serverTotalPayable,
        amountPaise: rzpAmount,
        currency: rzpCurrency,
        creditsRequested: cleanCredits,
        wantsVip: cleanVipDays > 0,
        vipDaysRequested: cleanVipDays,
        vipPlanFee: serverVipFee,
        utrNumber: 'AUTO_WAITING',
        status: 'Pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.status(200).json({
      status: true,
      order_id: rzpOrderId,
      orderId: rzpOrderId,
      receipt: receiptId,
      amount: rzpAmount,
      currency: rzpCurrency,
      key_id: keyId,
      upi_string: upiString,
      qr_code: qrCodeUrl
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
}
