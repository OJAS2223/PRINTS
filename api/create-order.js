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
      message: 'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured'
    });
  }

  try {
    // Optional session verification if Authorization Bearer token is provided
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

    // Determine amount in paise:
    // If 'amount' is provided directly in paise (e.g. 10000 = ₹100), validate and use it.
    // If 'totalPayable' or 'creditsRequested' in Rupees is provided, convert to paise.
    let amountInPaise = 0;
    if (amount !== undefined && amount !== null) {
      amountInPaise = Math.round(Number(amount));
    } else if (totalPayable !== undefined && totalPayable !== null) {
      amountInPaise = Math.round(Number(totalPayable) * 100);
    } else if (creditsRequested !== undefined && creditsRequested !== null) {
      amountInPaise = Math.round(Number(creditsRequested) * 100);
    }

    // Razorpay standard requirement: Minimum amount is 100 paise (₹1)
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

    // Call Razorpay API to create standard order
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

    // Build UPI intent string & QR code for fallback mobile UPI apps
    const productInfo = wantsVip ? `Ojas VIP + Credits` : `Ojas ${creditsNum} Credits`;
    const rupeeValue = (amountInPaise / 100).toFixed(2);
    const upiQuery = `pa=8279650137@amazonpay&pn=${encodeURIComponent('Ojas Print Service')}&am=${rupeeValue}&cu=INR&tn=${encodeURIComponent(productInfo)}&tr=${encodeURIComponent(rzpOrder.id)}`;
    const upiString = `upi://pay?${upiQuery}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiString)}`;

    // Save pending payment record in Firestore if configured
    if (admin.apps.length && cleanUserId) {
      try {
        const db = admin.firestore();
        await db.collection('payments').doc(rzpOrder.id).set({
          orderId: rzpOrder.id,
          receiptId: receiptId,
          userId: cleanUserId,
          email: cleanEmail,
          amountPaid: Number(rupeeValue),
          amountPaise: rzpOrder.amount,
          currency: rzpOrder.currency,
          creditsRequested: Number(creditsRequested || creditsNum),
          wantsVip: Boolean(wantsVip),
          vipDaysRequested: Number(vipDaysRequested || 0),
          utrNumber: 'AUTO_WAITING',
          status: 'Pending',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (dbErr) {
        console.warn('Firestore payment record save warning:', dbErr);
      }
    }

    // Return format satisfying Razorpay Standard Checkout spec + frontend compatibility
    return res.status(200).json({
      status: true,
      order_id: rzpOrder.id,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: receiptId,
      key_id: keyId,
      upi_string: upiString,
      qr_code: qrCodeUrl
    });

  } catch (error) {
    console.error('Create Order Handler Error:', error);
    return res.status(500).json({
      status: false,
      message: error.message || 'Internal Server Error'
    });
  }
}
