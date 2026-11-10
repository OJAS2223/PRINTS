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

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
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
      creditsRequested,
      totalPayable
    } = req.body || {};

    const razorpay = keyId ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

    let verifiedPaymentId = razorpay_payment_id || '';
    let verifiedSignature = razorpay_signature || '';

    // 1. Check Order Status mode (If customer scanned QR and closed modal)
    if (action === 'check_order_status') {
      if (!razorpay_order_id || !razorpay) {
        return res.status(400).json({ status: false, message: 'Missing order_id or Razorpay key' });
      }
      const paymentsList = await razorpay.orders.fetchPayments(razorpay_order_id);
      const items = Array.isArray(paymentsList?.items) ? paymentsList.items : [];
      const paidItem = items.find(p => p.status === 'captured' || p.status === 'authorized');

      if (!paidItem) {
        return res.status(200).json({
          status: false,
          paid: false,
          message: 'Payment not yet captured on Razorpay.'
        });
      }
      verifiedPaymentId = paidItem.id;
      verifiedSignature = 'VERIFIED_BY_RAZORPAY_API';
    } else {
      // 2. Standard Checkout Signature Verification: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          status: false,
          message: 'Missing required payment verification fields'
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

    // Fetch exact order notes & amount from Razorpay so credits are 100% accurate
    let rzpNotes = {};
    let rzpRupees = 0;
    if (razorpay) {
      try {
        const orderInfo = await razorpay.orders.fetch(razorpay_order_id);
        rzpNotes = orderInfo?.notes || {};
        rzpRupees = Math.floor((Number(orderInfo?.amount) || 0) / 100);
      } catch (e) {
        console.warn('Order fetch warning:', e.message);
      }
    }

    const finalCredits = Math.floor(Math.max(0, Number(rzpNotes.creditsRequested) || Number(creditsRequested) || rzpRupees || 0));
    const finalRupees = Math.floor(Math.max(0, Number(rzpNotes.totalPayable) || Number(totalPayable) || rzpRupees || 0));
    const finalEmail = String(rzpNotes.email || '').trim();
    const finalUserId = String(rzpNotes.userId || '').trim();

    // If Firebase Service Account is NOT set on Vercel, return verified=true so Frontend auto-credits Firestore immediately
    if (!admin.apps.length) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (botToken && chatId) {
        const tgMessage = `✅ *Razorpay Payment Verified (ojasprints.in)*\n👤 *User:* ${finalEmail || 'Portal User'}\n💰 *Amount:* ₹${finalRupees}\n💎 *Credits Added:* +${finalCredits} Cr\n🧾 *Payment ID:* \`${verifiedPaymentId}\`\n🆔 *Order ID:* \`${razorpay_order_id}\``;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: tgMessage, parse_mode: 'Markdown' })
        }).catch(() => {});
      }

      return res.status(200).json({
        status: true,
        verified: true,
        paid: true,
        dbUpdated: false,
        message: 'Signature verified successfully!',
        order_id: razorpay_order_id,
        orderId: razorpay_order_id,
        payment_id: verifiedPaymentId,
        paymentId: verifiedPaymentId,
        creditsAdded: finalCredits,
        amountPaid: finalRupees
      });
    }

    // If Firebase Admin IS configured, update Firestore on server as well
    const db = admin.firestore();
    const paymentRef = db.collection('payments').doc(String(razorpay_order_id).trim());
    const usedPaymentRef = db.collection('usedUtrs').doc(String(verifiedPaymentId).trim());

    const txResult = await db.runTransaction(async (t) => {
      const paymentSnap = await t.get(paymentRef);
      const paymentData = paymentSnap.exists ? paymentSnap.data() : {};

      if (paymentData.status === 'Auto-Approved' || paymentData.status === 'Approved') {
        return {
          ok: true,
          alreadyProcessed: true,
          email: paymentData.email || finalEmail,
          creditsAdded: Number(paymentData.creditsRequested) || finalCredits,
          amountPaid: Number(paymentData.amountPaid) || finalRupees
        };
      }

      const usedSnap = await t.get(usedPaymentRef);
      if (usedSnap.exists) {
        return { ok: false, status: 400, reason: 'Payment ID has already been utilized' };
      }

      const userId = String(paymentData.userId || finalUserId).trim();
      const email = String(paymentData.email || finalEmail).trim();
      const creditsToAdd = Math.floor(Math.max(0, Number(paymentData.creditsRequested) || finalCredits));
      const amountPaid = Math.floor(Math.max(0, Number(paymentData.amountPaid) || finalRupees));
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

          const updateFields = { credits: updatedCredits };
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
        status: 'Auto-Approved',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: paymentData.timestamp || admin.firestore.FieldValue.serverTimestamp()
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

    return res.status(200).json({
      status: true,
      verified: true,
      paid: true,
      dbUpdated: true,
      message: 'Payment signature verified and credits added to wallet!',
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
