export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!botToken || !chatId) {
      return res.status(200).json({ status: false, message: 'Telegram notifications not configured on server' });
    }

    let tgMessage = '';

    if (body.type === 'PAYMENT_UTR_TICKET') {
      tgMessage = `🎫 *Payment Issue Ticket Raised (24-48h Resolution)*\n🌐 *Portal:* ojasprints.in\n👤 *User:* ${body.user || 'Unknown'}\n💰 *Amount:* ₹${body.amount || 0}\n🧾 *UTR / Ref No:* \`${body.utr || 'N/A'}\`\n🆔 *Order ID:* \`${body.orderId || 'N/A'}\`\n📝 *Issue Note:* ${body.note || 'Payment deducted / failed, please verify & approve.'}\n\n⏳ *Action:* Please verify in /ovi Admin Panel within 24-48 hours.`;
    } else if (body.type === 'PAYMENT_AUTO_APPROVED') {
      tgMessage = `✅ *Payment Auto-Approved (ojasprints.in)*\n👤 *User:* ${body.user || 'Unknown'}\n💰 *Amount:* ₹${body.amount || 0}\n💎 *Credits:* +${body.credits || 0} Cr\n🧾 *Payment ID:* \`${body.utr || 'N/A'}\`\n🆔 *Order ID:* \`${body.orderId || 'N/A'}\``;
    } else if (body.type === 'FORGOT_PASSWORD') {
      tgMessage = `🔑 *Forgot Password Ticket (ojasprints.in)*\n👤 *User ID:* ${body.userId || 'N/A'}\n📱 *WhatsApp:* ${body.phone || 'N/A'}\n💬 *Note:* ${body.message || 'Password reset requested'}`;
    } else {
      tgMessage = `🔔 *Ojas Portal Notification (ojasprints.in)*\n${JSON.stringify(body, null, 2)}`;
    }

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: tgMessage,
        parse_mode: 'Markdown'
      })
    }).catch(() => {});

    return res.status(200).json({ status: true, message: 'Admin notified via Telegram Bot' });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
}
