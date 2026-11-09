import admin from 'firebase-admin';
import Razorpay from 'razorpay';

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('Firebase Admin init error:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({
      status: false,
      message: 'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured on server'
    });
  }

  try {
    // Optional Firebase Auth Bearer token verification
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
      amount,
      currency = 'INR',
      receipt,
      userId,
      email,
      username,
      creditsRequested,
      wantsVip,
      vipDaysRequested,
      totalPayable
    } = req.body || {};

    // Calculate amount in paise (1 INR = 100 paise)
    let amountInPaise = 0;
    if (amount !== undefined && amount !== null) {
      amountInPaise = Math.round(Number(amount));
    } else if (totalPayable !== undefined && totalPayable !== null) {
      amountInPaise = Math.round(Number(totalPayable) * 100);
    } else if (creditsRequested !== undefined && creditsRequested !== null) {
      amountInPaise = Math.round(Number(creditsRequested) * 100);
    }

    // Minimum amount validation (>= 100 paise)
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({
        status: false,
        message: 'Invalid amount. Minimum amount is 100 paise (₹1).'
      });
    }

    const receiptId = String(
      receipt || `OJAS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
    ).slice(0, 40);

    const cleanUserId = String(userId || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanUsername = String(username || 'Ojas User').trim();
    const creditsNum = Math.floor(amountInPaise / 100);
    const rupeeValue = Math.round(amountInPaise / 100);

    // Initialize Razorpay SDK (100% Razorpay Checkout - No Static/External UPI)
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: currency.toUpperCase(),
        receipt: receiptId,
        notes: {
          userId: cleanUserId,
          email: cleanEmail,
          username: cleanUsername,
          creditsRequested: String(creditsRequested || creditsNum),
          wantsVip: String(Boolean(wantsVip)),
          vipDaysRequested: String(vipDaysRequested || 0),
          domain: 'ojasprints.in'
        }
      });
    } catch (rzpErr) {
      console.error('Razorpay API error in orders.create:', rzpErr);
      const statusCode = rzpErr.statusCode === 401 ? 401 : 500;
      return res.status(statusCode).json({
        status: false,
        message: rzpErr.error?.description || rzpErr.message || 'Razorpay order creation failed'
      });
    }

    if (!rzpOrder || !rzpOrder.id) {
      return res.status(500).json({
        status: false,
        message: 'Failed to receive order_id from Razorpay'
      });
    }

    // Save Pending Razorpay Order in Firestore
    if (admin.apps.length && cleanUserId) {
      try {
        const db = admin.firestore();
        await db.collection('payments').doc(rzpOrder.id).set({
          orderId: rzpOrder.id,
          receiptId: receiptId,
          userId: cleanUserId,
          email: cleanEmail,
          amountPaid: rupeeValue,
          amountPaise: rzpOrder.amount,
          currency: rzpOrder.currency,
          creditsRequested: Number(creditsRequested || creditsNum),
          wantsVip: Boolean(wantsVip),
          vipDaysRequested: Number(vipDaysRequested || 0),
          utrNumber: 'RAZORPAY_PENDING',
          paymentGateway: 'Razorpay',
          status: 'Pending',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (dbErr) {
        console.warn('Firestore payment record save warning:', dbErr);
      }
    }

    return res.status(200).json({
      status: true,
      order_id: rzpOrder.id,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: receiptId,
      key_id: keyId
    });

  } catch (error) {
    console.error('Create Order Handler Error:', error);
    return res.status(500).json({
      status: false,
      message: error.message || 'Internal Server Error'
    });
  }
}
