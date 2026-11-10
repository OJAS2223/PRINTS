import crypto from 'crypto';
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  const keyId = (process.env.RAZORPAY_KEY_ID || 'rzp_live_TySEw1K6SUaNJW').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keySecret) {
    return res.status(500).json({
      status: false,
      message: 'Server payment secret (RAZORPAY_KEY_SECRET) is not configured'
    });
  }

  try {
    const {
      action = 'verify_signature',
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId: bodyUserId = '',
      email: bodyEmail = '',
      creditsRequested: bodyCredits = 0,
      totalPayable: bodyAmount = 0
    } = req.body || {};

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    let verifiedPaymentId = razorpay_payment_id || '';
    let verifiedSignature = razorpay_signature || '';

    // MODE 1: If QR was scanned and modal closed, verify directly from Razorpay API
    if (action === 'check_order_status') {
      if (!razorpay_order_id) {
        return res.status(400).json({ status: false, message: 'Missing razorpay_order_id' });
      }
      const paymentsList = await razorpay.orders.fetchPayments(razorpay_order_id);
      const items = Array.isArray(paymentsList?.items) ? paymentsList.items : [];
      const capturedPayment = items.find(p => p.status === 'captured' || p.status === 'authorized');

      if (!capturedPayment) {
        return res.status(200).json({
          status: false,
          paid: false,
          message: 'Payment not yet captured on Razorpay.'
        });
      }
      verifiedPaymentId = capturedPayment.id;
      verifiedSignature = 'VERIFIED_VIA_RAZORPAY_API';
    } else {
      // MODE 2: Standard Checkout HMAC-SHA256 Signature Verification
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          status: false,
          message: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
        });
      }

      const bodyData = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(bodyData)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(String(razorpay_signature), 'utf8');

      const isSignatureValid =
        expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

      if (!isSignatureValid) {
        return res.status(400).json({
          status: false,
          message: 'Invalid payment signature! Verification failed.'
        });
      }
    }

    // Fetch Order details from Razorpay so we ALWAYS have userId, email & credits even if Firestore doc wasn't pre-created
    let rzpOrderNotes = {};
    let rzpOrderAmountRupees = 0;
    try {
      const orderInfo = await razorpay.orders.fetch(razorpay_order_id);
      rzpOrderNotes = orderInfo?.notes || {};
      rzpOrderAmountRupees = Math.floor((Number(orderInfo?.amount) || 0) / 100);
    } catch (e) {
      console.warn('Could not fetch Razorpay order notes:', e.message);
    }

    const fallbackUserId = String(bodyUserId || rzpOrderNotes.userId || '').trim();
    const fallbackEmail = String(bodyEmail || rzpOrderNotes.email || '').trim();
    const fallbackCredits = Math.floor(Math.max(0, Number(bodyCredits) || Number(rzpOrderNotes.creditsRequested) || rzpOrderAmountRupees || 0));
    const fallbackAmountPaid = Math.floor(Math.max(0, Number(bodyAmount) || Number(rzpOrderNotes.totalPayable) || rzpOrderAmountRupees || 0));

    // If Firebase Admin SDK is not configured on Vercel, return verified details so frontend can credit immediately
    if (!admin.apps.length) {
      return res.status(200).json({
        status: true,
        verified: true,
        paid: true,
        dbUpdated: false,
        message: 'Signature verified successfully.',
        order_id: razorpay_order_id,
        orderId: razorpay_order_id,
        payment_id: verifiedPaymentId,
        paymentId: verifiedPaymentId,
        creditsAdded: fallbackCredits,
        amountPaid: fallbackAmountPaid
      });
    }

    const db = admin.firestore();
    const paymentRef = db.collection('payments').doc(String(razorpay_order_id).trim());
    const usedPaymentRef = db.collection('usedUtrs').doc(String(verifiedPaymentId).trim());

    // Atomic Firestore Transaction: Works even if paymentSnap did NOT exist previously!
    const txResult = await db.runTransaction(async (t) => {
      const paymentSnap = await t.get(paymentRef);
      const paymentData = paymentSnap.exists ? paymentSnap.data() : {};

      if (paymentData.status === 'Auto-Approved' || paymentData.status === 'Approved') {
        const existingUserId = String(paymentData.userId || fallbackUserId).trim();
        let currentBal = undefined;
        if (existingUserId) {
          const uSnap = await t.get(db.collection('users').doc(existingUserId));
          if (uSnap.exists) currentBal = Number(uSnap.data().credits) || 0;
        }
        return {
          ok: true,
          alreadyProcessed: true,
          email: paymentData.email || fallbackEmail,
          creditsAdded: Number(paymentData.creditsRequested) || fallbackCredits,
          updatedCredits: currentBal,
          amountPaid: Number(paymentData.amountPaid) || fallbackAmountPaid
        };
      }

      const usedSnap = await t.get(usedPaymentRef);
      if (usedSnap.exists) {
        return { ok: false, status: 400, reason: 'Payment ID has already been utilized' };
      }

      const userId = String(paymentData.userId || fallbackUserId).trim();
      const email = String(paymentData.email || fallbackEmail).trim();
      const creditsToAdd = Math.floor(Math.max(0, Number(paymentData.creditsRequested) || fallbackCredits));
      const amountPaid = Math.floor(Math.max(0, Number(paymentData.amountPaid) || fallbackAmountPaid));
      const wantsVip = Boolean(paymentData.wantsVip);
      const vipDays = Math.floor(Math.max(0, Number(paymentData.vipDaysRequested) || 0));

      let updatedCredits = creditsToAdd;

      if (userId) {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await t.get(userRef);

        if (userSnap.exists) {
          const uData = userSnap.data();
          const currentCredits = Number(uData.credits) || 0;
          updatedCredits = currentCredits + creditsToAdd;
          const now = Date.now();
          const currentExpiry =
            uData.isVip && uData.vipExpiry && uData.vipExpiry > now
              ? Number(uData.vipExpiry)
              : now;

          const updateFields = {
            credits: updatedCredits,
            lastRechargedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          if (wantsVip && vipDays > 0) {
            updateFields.isVip = true;
            updateFields.vipExpiry = currentExpiry + vipDays * MS_PER_DAY;
          }
          t.update(userRef, updateFields);
        }
      }

      t.set(paymentRef, {
        userId: userId,
        email: email,
        orderId: razorpay_order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: verifiedPaymentId,
        razorpaySignature: verifiedSignature,
        utrNumber: verifiedPaymentId,
        amountPaid: amountPaid,
        creditsRequested: creditsToAdd,
        creditsAdded: creditsToAdd,
        wantsVip: wantsVip,
        vipDaysRequested: vipDays,
        status: 'Auto-Approved',
        note: `Razorpay Instant Auto-Recharge (${verifiedPaymentId})`,
        timestamp: paymentData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      t.set(usedPaymentRef, {
        userId: userId,
        orderId: razorpay_order_id,
        paymentId: verifiedPaymentId,
        amount: amountPaid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        ok: true,
        alreadyProcessed: false,
        email: email,
        creditsAdded: creditsToAdd,
        updatedCredits: updatedCredits,
        wantsVip: wantsVip,
        vipDays: vipDays,
        amountPaid: amountPaid
      };
    });

    if (!txResult.ok) {
      return res.status(txResult.status || 400).json({
        status: false,
        message: txResult.reason
      });
    }

    // Telegram Notification
    if (!txResult.alreadyProcessed && txResult.email) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (botToken && chatId) {
        const vipLine = txResult.wantsVip ? `\n👑 *VIP Activated:* +${txResult.vipDays} Days` : '';
        const tgMessage = `✅ *Razorpay Payment Auto-Approved (ojasprints.in)*\n👤 *User:* ${txResult.email}\n💰 *Amount:* ₹${txResult.amountPaid}\n💎 *Credits Added:* +${txResult.creditsAdded} Cr (New Balance: ${txResult.updatedCredits} Cr)${vipLine}\n🧾 *Payment ID:* \`${verifiedPaymentId}\`\n🆔 *Order ID:* \`${razorpay_order_id}\``;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: tgMessage, parse_mode: 'Markdown' })
        }).catch(() => {});
      }
    }

    return res.status(200).json({
      status: true,
      verified: true,
      paid: true,
      dbUpdated: true,
      message: 'Payment verified and credits added to wallet!',
      order_id: razorpay_order_id,
      orderId: razorpay_order_id,
      payment_id: verifiedPaymentId,
      paymentId: verifiedPaymentId,
      creditsAdded: txResult.creditsAdded,
      updatedCredits: txResult.updatedCredits,
      amountPaid: txResult.amountPaid
    });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    return res.status(500).json({
      status: false,
      message: error.message || 'Internal Server Error'
    });
  }
}
