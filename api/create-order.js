import admin from 'firebase-admin';
import Razorpay from 'razorpay';

function initFirebaseAdmin() {
  if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim());
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (e) {
      console.error('Firebase Admin init error:', e.message);
    }
  }
}
initFirebaseAdmin();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) {
    return res.status(500).json({
      status: false,
      message: 'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured on server'
    });
  }

  try {
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

    let amountInPaise = 0;
    if (amount !== undefined && amount !== null) {
      amountInPaise = Math.round(Number(amount));
    } else if (totalPayable !== undefined && totalPayable !== null) {
      amountInPaise = Math.round(Number(totalPayable) * 100);
    } else if (creditsRequested !== undefined && creditsRequested !== null) {
      amountInPaise = Math.round(Number(creditsRequested) * 100);
    }

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
    const creditsNum = Math.floor(Number(creditsRequested) || Math.floor(amountInPaise / 100));
    const rupeeValue = Math.round(Number(totalPayable) || Math.round(amountInPaise / 100));

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receiptId,
      notes: {
        userId: cleanUserId,
        email: cleanEmail,
        username: cleanUsername,
        creditsRequested: String(creditsNum),
        totalPayable: String(rupeeValue),
        wantsVip: String(Boolean(wantsVip)),
        vipDaysRequested: String(vipDaysRequested || 0),
        domain: 'ojasprints.in'
      }
    });

    if (!rzpOrder || !rzpOrder.id) {
      return res.status(500).json({
        status: false,
        message: 'Failed to receive order_id from Razorpay'
      });
    }

    if (admin.apps.length && cleanUserId) {
      try {
        const db = admin.firestore();
        await db.collection('payments').doc(rzpOrder.id).set({
          orderId: rzpOrder.id,
          razorpayOrderId: rzpOrder.id,
          receiptId: receiptId,
          userId: cleanUserId,
          email: cleanEmail,
          amountPaid: rupeeValue,
          amountPaise: rzpOrder.amount,
          currency: rzpOrder.currency,
          creditsRequested: creditsNum,
          wantsVip: Boolean(wantsVip),
          vipDaysRequested: Number(vipDaysRequested || 0),
          utrNumber: rzpOrder.id,
          paymentGateway: 'Razorpay',
          status: 'Pending',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (dbErr) {
        console.warn('Firestore payment record save warning:', dbErr.message);
      }
    }

    return res.status(200).json({
      status: true,
      order_id: rzpOrder.id,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: receiptId,
      key_id: keyId,
      creditsRequested: creditsNum,
      totalPayable: rupeeValue
    });
  } catch (error) {
    console.error('Create Order Handler Error:', error);
    return res.status(500).json({
      status: false,
      message: error.error?.description || error.message || 'Internal Server Error'
    });
  }
}
