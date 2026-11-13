import crypto from 'crypto';
import admin from 'firebase-admin';

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};

    // Verify Razorpay Webhook Signature (Mandatory when webhook/key secret is configured)
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '').trim();
    const receivedSig = req.headers['x-razorpay-signature'];

    if (!webhookSecret) {
      return res.status(500).json({ message: 'Webhook secret not configured on server' });
    }
    if (!receivedSig) {
      return res.status(401).json({ message: 'Missing x-razorpay-signature header' });
    }

    const rawBodyStr = typeof req.rawBody === 'string'
      ? req.rawBody
      : (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(body));

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBodyStr)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const receivedBuf = Buffer.from(String(receivedSig), 'utf8');
    const isSigValid = expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!isSigValid) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    const rzpPaymentEntity = body?.payload?.payment?.entity;
    const eventData = rzpPaymentEntity || body.data || body.result || body;

    const orderId = String(
      eventData.order_id ||
      eventData.client_txn_id ||
      eventData.orderId ||
      body.client_txn_id ||
      body.order_id ||
      ''
    ).trim();

    const utr = String(
      eventData.acquirer_data?.rrn ||
      eventData.id ||
      eventData.utr ||
      eventData.bank_ref_num ||
      eventData.upi_txn_id ||
      body.utr ||
      orderId ||
      ''
    ).trim();

    const rawStatus = String(
      body.event ||
      eventData.status ||
      eventData.txnStatus ||
      body.status ||
      ''
    ).toUpperCase();

    let paidAmount = Number(eventData.amount || body.amount || 0);
    // Razorpay ALWAYS sends amount in paise (even when < ₹100 / < 10000 paise)
    if (rzpPaymentEntity && paidAmount > 0) {
      paidAmount = Math.round(paidAmount / 100);
    }

    const isSuccessStatus =
      rawStatus.includes('SUCCESS') ||
      rawStatus.includes('COMPLETED') ||
      rawStatus.includes('PAID') ||
      rawStatus.includes('CAPTURED');

    if (!orderId || rawStatus.includes('TEST') || !isSuccessStatus) {
      return res.status(200).json({ message: 'Webhook received / Ignored' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ message: 'FIREBASE_SERVICE_ACCOUNT is missing in Vercel' });
    }

    const db = admin.firestore();
    const paymentRef = db.collection('payments').doc(orderId);
    const utrRef = db.collection('usedUtrs').doc(utr);

    const txResult = await db.runTransaction(async (t) => {
      const paymentSnap = await t.get(paymentRef);
      if (!paymentSnap.exists) {
        return { ok: false, reason: 'Order not found' };
      }

      const paymentData = paymentSnap.data();
      if (paymentData.status === 'Auto-Approved' || paymentData.status === 'Approved') {
        return { ok: false, reason: 'Already processed' };
      }

      const expectedAmount = Number(paymentData.amountPaid) || 0;
      if (paidAmount > 0 && expectedAmount > 0 && Math.abs(paidAmount - expectedAmount) > 1) {
        return { ok: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${paidAmount}` };
      }

      if (utr && utr !== orderId) {
        const utrSnap = await t.get(utrRef);
        if (utrSnap.exists) {
          return { ok: false, reason: 'Duplicate UTR detected' };
        }
      }

      const userId = String(paymentData.userId);
      const userRef = db.collection('users').doc(userId);
      const userSnap = await t.get(userRef);

      const creditsToAdd = Math.floor(Math.max(0, Number(paymentData.creditsRequested) || 0));
      const wantsVip = Boolean(paymentData.wantsVip);
      const vipDays = Math.floor(Math.max(0, Number(paymentData.vipDaysRequested) || 0));

      if (userSnap.exists) {
        const uData = userSnap.data();
        const currentCredits = Number(uData.credits) || 0;
        const now = Date.now();
        const currentExpiry = (uData.isVip && uData.vipExpiry && uData.vipExpiry > now) ? Number(uData.vipExpiry) : now;

        const updateFields = {
          credits: currentCredits + creditsToAdd
        };
        if (wantsVip && vipDays > 0) {
          updateFields.isVip = true;
          updateFields.vipExpiry = currentExpiry + (vipDays * MS_PER_DAY);
        }
        t.update(userRef, updateFields);
      }

      t.update(paymentRef, {
        status: 'Auto-Approved',
        utrNumber: utr,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (utr) {
        t.set(utrRef, {
          userId: userId,
          orderId: orderId,
          amount: expectedAmount,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return {
        ok: true,
        email: paymentData.email,
        amountPaid: expectedAmount || paidAmount,
        creditsToAdd,
        wantsVip,
        vipDays
      };
    });

    if (!txResult.ok) {
      return res.status(200).json({ message: txResult.reason });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const vipLine = txResult.wantsVip ? `\n👑 *VIP Activated:* +${txResult.vipDays} Days` : '';
      const tgMessage = `✅ *Auto-Payment Verified (ojasprints.in)!*\n👤 *User:* ${txResult.email}\n💰 *Amount Paid:* ₹${txResult.amountPaid}\n💎 *Credits Added:* +${txResult.creditsToAdd} Cr${vipLine}\n🧾 *UTR / Ref:* \`${utr}\`\n🆔 *Order ID:* \`${orderId}\`\n\n⚡ *Status:* Auto-Approved via Secure Webhook`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: tgMessage, parse_mode: 'Markdown' })
      }).catch(() => {});
    }

    return res.status(200).json({ message: 'Credits & VIP updated automatically!' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
