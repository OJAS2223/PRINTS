import admin from 'firebase-admin';

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const eventData = body.data || body.result || body;

    const orderId = String(eventData.client_txn_id || eventData.orderId || eventData.order_id || body.client_txn_id || body.order_id || '').trim();
    const utr = String(eventData.utr || eventData.bank_ref_num || eventData.upi_txn_id || body.utr || orderId || '').trim();
    const rawStatus = String(eventData.status || eventData.txnStatus || body.status || body.event || '').toUpperCase();
    const paidAmount = Number(eventData.amount || body.amount || 0);

    if (!orderId || rawStatus.includes('TEST') || (!rawStatus.includes('SUCCESS') && !rawStatus.includes('COMPLETED') && !rawStatus.includes('PAID'))) {
      return res.status(200).json({ message: 'Webhook received / Test OK' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ message: 'FIREBASE_SERVICE_ACCOUNT is missing in Vercel' });
    }

    const db = admin.firestore();
    const paymentRef = db.collection('payments').doc(orderId);
    const utrRef = db.collection('usedUtrs').doc(utr);

    // Atomic Firestore Transaction to prevent duplicate UTR replay & race conditions
    const txResult = await db.runTransaction(async (t) => {
      const paymentSnap = await t.get(paymentRef);
      if (!paymentSnap.exists) {
        return { ok: false, reason: 'Order not found' };
      }

      const paymentData = paymentSnap.data();
      if (paymentData.status === 'Auto-Approved' || paymentData.status === 'Approved') {
        return { ok: false, reason: 'Already processed' };
      }

      // Strict amount verification: if gateway sends amount, ensure it matches expected amountPaid
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

    const botToken = process.env.TELEGRAM_BOT_TOKEN || "8586078140:AAG-ydpakzFDAwHFtJC8AUanxZAODpGZDOk";
    const chatId = process.env.TELEGRAM_CHAT_ID || "8942287807";
    const vipLine = txResult.wantsVip ? `\n👑 *VIP Activated:* +${txResult.vipDays} Days` : '';
    const tgMessage = `✅ *Auto-Payment Verified!*\n*User:* ${txResult.email}\n*Amount Paid:* ₹${txResult.amountPaid}\n*Credits Added:* +${txResult.creditsToAdd} Cr${vipLine}\n*UTR:* \`${utr}\`\n*Order ID:* \`${orderId}\`\n\n*Status:* Auto-Approved via Secure Webhook ⚡`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: tgMessage, parse_mode: 'Markdown' })
    }).catch(() => {});

    return res.status(200).json({ message: 'Credits & VIP updated automatically!' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
