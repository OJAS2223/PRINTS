import crypto from 'crypto';
import admin from 'firebase-admin';
 
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
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({
      status: false,
      message: 'Server payment secret (RAZORPAY_KEY_SECRET) is not configured'
    });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: false,
        message: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
      });
    }

    // Razorpay standard algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
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

    // Return 400 immediately on signature mismatch - DO NOT mark as paid
    if (!isSignatureValid) {
      return res.status(400).json({
        status: false,
        message: 'Invalid payment signature! Verification failed.'
      });
    }

    // If Firebase Admin SDK is not initialized, still confirm valid signature
    if (!admin.apps.length) {
      return res.status(200).json({
        status: true,
        message: 'Signature verified successfully (Database service account not configured).',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id
      });
    }

    const db = admin.firestore();
    const paymentRef = db.collection('payments').doc(String(razorpay_order_id).trim());
    const usedPaymentRef = db.collection('usedUtrs').doc(String(razorpay_payment_id).trim());

    // Atomic Firestore Transaction to credit user account safely & avoid replay
    const txResult = await db.runTransaction(async (t) => {
      const paymentSnap = await t.get(paymentRef);

      // If no pre-existing payment doc found, create one now with success status
      if (!paymentSnap.exists) {
        t.set(paymentRef, {
          orderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          razorpaySignature: razorpay_signature,
          status: 'Auto-Approved',
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
          ok: true,
          alreadyProcessed: false,
          creditsAdded: 0,
          updatedCredits: 0,
          amountPaid: 0
        };
      }

      const paymentData = paymentSnap.data();
      if (paymentData.status === 'Auto-Approved' || paymentData.status === 'Approved') {
        return {
          ok: true,
          alreadyProcessed: true,
          email: paymentData.email,
          creditsAdded: Number(paymentData.creditsRequested) || 0,
          amountPaid: Number(paymentData.amountPaid) || 0
        };
      }

      const usedSnap = await t.get(usedPaymentRef);
      if (usedSnap.exists) {
        return { ok: false, status: 400, reason: 'Payment ID has already been utilized' };
      }

      const userId = String(paymentData.userId || '').trim();
      let updatedCredits = 0;
      let creditsToAdd = Math.floor(Math.max(0, Number(paymentData.creditsRequested) || 0));
      const wantsVip = Boolean(paymentData.wantsVip);
      const vipDays = Math.floor(Math.max(0, Number(paymentData.vipDaysRequested) || 0));

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
            credits: updatedCredits
          };
          if (wantsVip && vipDays > 0) {
            updateFields.isVip = true;
            updateFields.vipExpiry = currentExpiry + vipDays * MS_PER_DAY;
          }
          t.update(userRef, updateFields);
        }
      }

      t.update(paymentRef, {
        status: 'Auto-Approved',
        utrNumber: razorpay_payment_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      t.set(usedPaymentRef, {
        userId: userId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: Number(paymentData.amountPaid) || 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        ok: true,
        alreadyProcessed: false,
        email: paymentData.email,
        creditsAdded: creditsToAdd,
        updatedCredits,
        wantsVip,
        vipDays,
        amountPaid: Number(paymentData.amountPaid) || 0
      };
    });

    if (!txResult.ok) {
      return res.status(txResult.status || 400).json({
        status: false,
        message: txResult.reason
      });
    }

    // Optional Telegram notification
    if (!txResult.alreadyProcessed && txResult.email) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (botToken && chatId) {
        const vipLine = txResult.wantsVip ? `\n👑 *VIP Activated:* +${txResult.vipDays} Days` : '';
        const tgMessage = `✅ *Razorpay Payment Verified (ojasprints.in)*\n👤 *User:* ${txResult.email}\n💰 *Amount:* ₹${txResult.amountPaid}\n💎 *Credits Added:* +${txResult.creditsAdded} Cr (Balance: ${txResult.updatedCredits} Cr)${vipLine}\n🧾 *Payment ID:* \`${razorpay_payment_id}\`\n🆔 *Order ID:* \`${razorpay_order_id}\`\n⚡ *Method:* Razorpay Standard Web Checkout`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: tgMessage, parse_mode: 'Markdown' })
        }).catch(() => {});
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Payment signature verified successfully and credits added to wallet!',
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      creditsAdded: txResult.creditsAdded,
      updatedCredits: txResult.updatedCredits
    });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    return res.status(500).json({
      status: false,
      message: error.message || 'Internal Server Error'
    });
  }
}
