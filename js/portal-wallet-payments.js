// ============================================================================
// FILE: js/portal-wallet-payments.js
// (Razorpay Checkout, Server-Verified Wallet Crediting, Passbook Ledger & Payment Tickets)
// ============================================================================

window.calculateCredits = function() {
    const rawCreditAmt = Math.floor(Math.max(0, parseFloat(document.getElementById('rupeeAmount')?.value) || 0));
    window.currentRechargeCredits = rawCreditAmt;
    window.currentWantsVip = false;
    window.currentVipDays = 0;
    window.currentVipPlanFee = 0;
    window.currentTotalPayable = rawCreditAmt;

    const calcCreditsEl = document.getElementById('calculatedCredits');
    if (calcCreditsEl) calcCreditsEl.innerText = `${rawCreditAmt} Cr`;
    const totalPayableDisplay = document.getElementById('totalPayableDisplay');
    if (totalPayableDisplay) totalPayableDisplay.innerText = `₹${window.currentTotalPayable}`;
};

window.creditWalletAfterVerifiedPayment = async function(verifyData) {
    if (window.isCreditingInProgress) return;
    window.isCreditingInProgress = true;

    const { db, doc, getDoc } = window.fb;

    try {
        const uid = window.currentUserData.uid;
        const email = window.currentUserData.email;
        const orderId = verifyData.orderId || verifyData.order_id || window.currentActiveOrderId;
        const paymentId = verifyData.paymentId || verifyData.payment_id || 'RAZORPAY_VERIFIED';
        const creditsToAdd = Number(verifyData.creditsAdded) || Number(window.currentRechargeCredits) || 0;
        const amountPaid = Number(verifyData.amountPaid) || Number(window.currentTotalPayable) || creditsToAdd;

        if (creditsToAdd <= 0) {
            throw new Error('Invalid credits amount.');
        }

        // Server already updated Firestore via Firebase Admin SDK!
        if (verifyData.dbUpdated === true) {
            if (verifyData.updatedCredits !== undefined) {
                window.currentUserData.credits = Number(verifyData.updatedCredits);
            } else {
                const uSnap = await getDoc(doc(db, "users", uid));
                if (uSnap.exists()) {
                    window.currentUserData.credits = Number(uSnap.data().credits) || 0;
                }
            }
            const crEl = document.getElementById('displayCredits');
            if (crEl) crEl.innerText = window.currentUserData.credits;

            window.showPaymentSuccessScreen(amountPaid, creditsToAdd, paymentId);
            return;
        }

        // If server could not update Firestore because FIREBASE_SERVICE_ACCOUNT is not configured:
        const statusBanner = document.getElementById('rzpPaymentStatusBanner');
        if (statusBanner) {
            statusBanner.className = "p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs font-bold text-center mt-3 space-y-2";
            statusBanner.innerHTML = `
                <div><i class="fa-solid fa-triangle-exclamation text-amber-600 mr-1"></i> पेमेंट वेरीफाई हो गया है (Payment ID: <strong>${paymentId}</strong>), लेकिन सर्वर ऑटो-क्रेडिट कॉन्फ़िगर नहीं है।</div>
                <p class="text-[11px]">कृपया नीचे दिए गए टिकट फॉर्म में यह Payment ID सबमिट करें ताकि एडमिन तुरंत आपके +${creditsToAdd} Credits अप्रूव कर सकें।</p>`;
            statusBanner.style.display = 'block';
        }
        const tBox = document.getElementById('paymentIssueTicketBox');
        if (tBox) tBox.style.display = 'block';
        const utrInp = document.getElementById('ticketUtrInput');
        if (utrInp && paymentId) utrInp.value = paymentId;

        if (typeof window.notifyAdminSecurely === 'function') {
            window.notifyAdminSecurely({
                type: "PAYMENT_UTR_TICKET",
                user: email,
                amount: amountPaid,
                utr: paymentId,
                orderId: orderId || 'N/A',
                note: 'Razorpay verified, awaiting manual approval (server admin SDK not configured)'
            });
        }
    } finally {
        window.isCreditingInProgress = false;
    }
};

window.showPaymentSuccessScreen = function(amountPaid, creditsAdded, paymentId) {
    if (window.activePaymentUnsubscribe) window.activePaymentUnsubscribe();
    window.currentActiveOrderId = null;
    const walletUI = document.getElementById('walletMainUI');
    if (walletUI) {
        walletUI.innerHTML = `
            <div class="p-6 bg-green-50 rounded-2xl border-2 border-green-400 text-center space-y-2">
                <i class="fa-solid fa-circle-check text-5xl text-green-600 mb-2 animate-bounce"></i>
                <h2 class="text-xl font-black text-green-900">पेमेंट सफल! (Auto-Verified)</h2>
                <p class="text-xs font-bold text-green-700">आपका ₹${amountPaid} का पेमेंट तुरंत वेरीफाई हो गया है और आपके वॉलेट में <strong>+${creditsAdded} Credits</strong> जोड़ दिए गए हैं!</p>
                <p class="text-[11px] font-mono text-slate-500">Payment ID: ${paymentId}</p>
                <div class="pt-3">
                    <button onclick="window.switchService('payments_history')" class="bg-green-600 hover:bg-green-700 text-white font-black py-2.5 px-6 rounded-xl text-xs shadow">वॉलेट पासबुक देखें</button>
                </div>
            </div>`;
    }
};

window.checkActiveRazorpayOrderStatus = async function(silent = false) {
    const orderId = window.currentActiveOrderId || window.currentRzpOrderData?.order_id;
    if (!orderId) return;

    const statusBanner = document.getElementById('rzpPaymentStatusBanner');
    if (!silent && statusBanner) {
        statusBanner.className = "p-3.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-900 text-xs font-bold text-center mt-3";
        statusBanner.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Razorpay से पेमेंट स्टेटस चेक किया जा रहा है...`;
        statusBanner.style.display = 'block';
    }

    try {
        const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'check_order_status',
                razorpay_order_id: orderId,
                creditsRequested: window.currentRechargeCredits,
                totalPayable: window.currentTotalPayable
            })
        });
        const data = await res.json();
        if (res.ok && data.status && data.verified) {
            await window.creditWalletAfterVerifiedPayment(data);
        } else if (!silent && statusBanner) {
            statusBanner.className = "p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold text-center mt-3 space-y-2";
            statusBanner.innerHTML = `
                <div><i class="fa-solid fa-circle-info text-amber-600 mr-1"></i> अभी पेमेंट कन्फर्म नहीं हुआ है। यदि आपने QR पर पेमेंट कर दिया है तो नीचे बटन दबाएं:</div>
                <button type="button" onclick="window.checkActiveRazorpayOrderStatus(false)" class="bg-amber-500 hover:bg-amber-600 text-dark-950 font-black px-4 py-1.5 rounded-lg text-xs shadow-sm">
                    <i class="fa-solid fa-rotate mr-1"></i> Check &amp; Auto-Credit Now
                </button>`;
            statusBanner.style.display = 'block';
        }
    } catch (e) {
        if (!silent) console.error('Order status check error:', e);
    }
};

window.generateQR = async function() {
    const { auth, db, doc, setDoc } = window.fb;
    if (window.currentUserData?.hasFreeAccess) return;
    window.calculateCredits();

    if (window.currentRechargeCredits < 1 || window.currentTotalPayable < 1) {
        return alert('कृपया कम से कम ₹1 या उससे अधिक की रिचार्ज राशि दर्ज करें!');
    }

    const btn = document.getElementById('btnGenerateQR');
    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Opening Razorpay...';
    }

    window.currentActiveOrderId = null;
    window.currentRzpOrderData = null;

    try {
        let authHeader = {};
        if (auth.currentUser) {
            const idToken = await auth.currentUser.getIdToken();
            authHeader = { 'Authorization': `Bearer ${idToken}` };
        }

        const res = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
                userId: window.currentUserData.uid,
                email: window.currentUserData.email,
                username: window.currentUserData.username,
                amount: Math.round(window.currentTotalPayable * 100),
                currency: 'INR',
                receipt: `OJAS_${Date.now()}`,
                totalPayable: window.currentTotalPayable,
                creditsRequested: window.currentRechargeCredits,
                wantsVip: false,
                vipDaysRequested: 0,
                vipPlanFee: 0
            })
        });

        const rawText = await res.text();
        let orderData;
        try { orderData = JSON.parse(rawText); }
        catch (parseErr) { throw new Error(`सर्वर से अमान्य रिस्पॉन्स मिला (Status ${res.status})`); }

        if (!res.ok || !orderData.status || !orderData.order_id) {
            throw new Error(orderData.message || 'Razorpay ऑर्डर बनाने में समस्या आई।');
        }

        window.currentRzpOrderData = orderData;
        window.currentActiveOrderId = orderData.order_id;

        try {
            await setDoc(doc(db, "payments", orderData.order_id), {
                userId: window.currentUserData.uid,
                email: window.currentUserData.email,
                orderId: orderData.order_id,
                razorpayOrderId: orderData.order_id,
                amountPaid: window.currentTotalPayable,
                creditsRequested: window.currentRechargeCredits,
                wantsVip: false,
                vipDaysRequested: 0,
                vipPlanFee: 0,
                utrNumber: orderData.order_id,
                status: 'Pending',
                timestamp: new Date()
            }, { merge: true });
        } catch (dbErr) {}

        window.openRazorpayModalNow();
    } catch (err) {
        alert('Payment Initiation Error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
    }
};

window.togglePaymentTicketBox = function() {
    const box = document.getElementById('paymentIssueTicketBox');
    if (!box) return;
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window.submitPaymentIssueTicket = async function() {
    const { db, doc, setDoc, updateDoc, collection, addDoc } = window.fb;
    const rawUtr = document.getElementById('ticketUtrInput')?.value.trim() || '';
    const utr = rawUtr.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const issueNote = document.getElementById('ticketIssueNoteInput')?.value.trim() || 'पेमेंट फेल / पेंडिंग हो गया है, कृपया वेरीफाई करके क्रेडिट्स अप्रूव करें।';
    const resMsg = document.getElementById('paymentTicketResultMsg');
    const btn = document.getElementById('btnRaisePaymentTicket');
    if (!utr || utr.length < 6) return alert("कृपया अपना 12-अंकों का सही UTR / Reference नंबर या Razorpay Payment ID दर्ज करें!");
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> टिकट सबमिट हो रहा है...';

    const ticketMsgText = `💳 [PAYMENT FAILED / PENDING TICKET - 24 TO 48 HOURS]\nAmount: ₹${window.currentTotalPayable}\nCredits: +${window.currentRechargeCredits} Cr\nUTR / Ref No: ${utr}\nOrder ID: ${window.currentActiveOrderId || 'N/A'}\nNote: ${issueNote}`;
    try {
        if (window.currentActiveOrderId) {
            try {
                await updateDoc(doc(db, "payments", window.currentActiveOrderId), {
                    utrNumber: utr,
                    status: "Pending (Ticket Raised - 24-48h)",
                    note: issueNote,
                    ticketRaisedAt: new Date()
                });
            } catch (e) {}
        } else {
            const newPayDoc = await addDoc(collection(db, "payments"), {
                userId: window.currentUserData.uid,
                email: window.currentUserData.email,
                amountPaid: window.currentTotalPayable || 100,
                creditsRequested: window.currentRechargeCredits || 100,
                wantsVip: false,
                vipDaysRequested: 0,
                vipPlanFee: 0,
                utrNumber: utr,
                note: issueNote,
                status: "Pending (Ticket Raised - 24-48h)",
                timestamp: new Date()
            });
            window.currentActiveOrderId = newPayDoc.id;
        }
        const uid = window.currentUserData.uid;
        const chatRef = doc(db, "supportTickets", uid);
        const existingMsgs = Array.isArray(window.currentUserChatData?.messages) ? [...window.currentUserChatData.messages] : [];
        existingMsgs.push({ sender: 'user', text: ticketMsgText, time: Date.now() });
        await setDoc(chatRef, {
            type: 'PAYMENT_ISSUE_TICKET',
            userId: uid,
            userIdentifier: window.currentUserData.email,
            username: window.currentUserData.username,
            message: `💳 Payment Ticket (24-48h): ₹${window.currentTotalPayable} (UTR: ${utr})`,
            status: 'Open',
            unreadByAdmin: true,
            unreadByUser: false,
            timestamp: new Date(),
            updatedAtMs: Date.now(),
            messages: existingMsgs
        }, { merge: true });

        if (typeof window.notifyAdminSecurely === 'function') {
            window.notifyAdminSecurely({
                type: "PAYMENT_UTR_TICKET",
                user: window.currentUserData.email,
                amount: window.currentTotalPayable,
                utr: utr,
                orderId: window.currentActiveOrderId || 'N/A',
                note: issueNote
            });
        }

        resMsg.className = "p-4 rounded-xl bg-green-50 border-2 border-green-400 text-green-900 text-xs font-bold text-center space-y-1.5 mt-3";
        resMsg.innerHTML = `
            <div class="text-sm font-black text-green-800"><i class="fa-solid fa-circle-check text-green-600 mr-1"></i> आपका पेमेंट टिकट सफलतापूर्वक जनरेट हो गया है!</div>
            <p class="text-[11px] text-green-800 leading-relaxed">
                UTR / Ref No: <strong>${utr}</strong> दर्ज कर लिया गया है और एडमिन को अलर्ट भेज दिया गया है।<br>
                ⏳ <strong>24 से 48 घंटे</strong> के भीतर वेरीफाई करके आपके वॉलेट में क्रेडिट्स अप्रूव कर दिए जाएंगे।
            </p>`;
        resMsg.style.display = 'block';
        document.getElementById('ticketUtrInput').value = '';
        if (document.getElementById('ticketIssueNoteInput')) document.getElementById('ticketIssueNoteInput').value = '';
    } catch (err) {
        alert("टिकट रेज़ करने में समस्या आई: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

window.openRazorpayModalNow = function() {
    const orderData = window.currentRzpOrderData;
    if (!orderData || !orderData.order_id) {
        return alert('कृपया पहले Pay Now via Razorpay बटन पर क्लिक करें।');
    }
    if (typeof window.Razorpay === 'undefined') {
        return alert('Razorpay SDK लोड नहीं हो सका। कृपया अपना इंटरनेट कनेक्शन चेक करें और पेज रिफ्रेश करें।');
    }

    const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Ojas Print Service',
        description: `Wallet Recharge (+${window.currentRechargeCredits} Credits)`,
        image: '/images/logo.png',
        order_id: orderData.order_id,
        prefill: {
            name: window.currentUserData?.username || '',
            email: window.currentUserData?.email || ''
        },
        theme: { color: '#4f46e5' },
        modal: {
            ondismiss: async function () {
                await window.checkActiveRazorpayOrderStatus(false);
            }
        },
        handler: async function (response) {
            const statusBanner = document.getElementById('rzpPaymentStatusBanner');
            if (statusBanner) {
                statusBanner.className = "p-3.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-900 text-xs font-bold text-center mt-3";
                statusBanner.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> पेमेंट वेरीफाई हो रहा है और क्रेडिट्स जोड़े जा रहे हैं... कृपया प्रतीक्षा करें।`;
                statusBanner.style.display = 'block';
            }

            try {
                const verifyRes = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'verify_signature',
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        creditsRequested: window.currentRechargeCredits,
                        totalPayable: window.currentTotalPayable
                    })
                });
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok || !verifyData.status) {
                    throw new Error(verifyData.message || 'Signature verification failed');
                }

                await window.creditWalletAfterVerifiedPayment({
                    ...verifyData,
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id
                });
            } catch (err) {
                alert('पेमेंट वेरिफिकेशन में समस्या आई: ' + err.message);
                const tBox = document.getElementById('paymentIssueTicketBox');
                if (tBox) tBox.style.display = 'block';
            }
        }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
        const errDesc = response?.error?.description || 'Payment failed.';
        const statusBanner = document.getElementById('rzpPaymentStatusBanner');
        if (statusBanner) {
            statusBanner.className = "p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold text-center mt-3";
            statusBanner.innerHTML = `<i class="fa-solid fa-circle-xmark text-red-600 mr-1"></i> पेमेंट फेल: ${errDesc}`;
            statusBanner.style.display = 'block';
        }
    });
    rzp.open();
};

window.setPassbookFilter = function(filterKey) {
    window.currentPassbookFilter = filterKey;
    const pills = ['ALL', 'RECHARGE', 'DEDUCTION', 'REFUND', 'GIFT'];
    pills.forEach(p => {
        const btn = document.getElementById(`pbPill-${p}`);
        if (!btn) return;
        btn.className = (p === filterKey)
            ? "px-3 py-2 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shadow-sm border border-royal-500/40 transition flex items-center justify-center gap-1.5"
            : "px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition flex items-center justify-center gap-1.5";
    });
    window.renderUserPassbookLedger();
};

window.loadUserPayments = async function() {
    const { db, doc, updateDoc, collection, getDocs, query, where } = window.fb;
    const tableBody = document.getElementById('userPaymentsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 font-bold text-xs"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>आपकी पूरी वॉलेट पासबुक लोड हो रही है...</td></tr>`;

    try {
        const uid = window.currentUserData.uid;
        const [paySnap, histSnap] = await Promise.all([
            getDocs(query(collection(db, "payments"), where("userId", "==", uid))),
            getDocs(query(collection(db, "history"), where("userId", "==", uid)))
        ]);

        window.userPaymentsData = [];
        window.historyData = [];
        const entries = [];
        const now = Date.now();
        const MS_72_HOURS = 72 * 60 * 60 * 1000;

        let totalRechargedCr = 0, totalDeductedCr = 0, totalRefundedCr = 0, totalGiftCr = 0, totalPendingAmt = 0, pendingCount = 0;

        const getTimeMs = (ts) => {
            if (!ts) return 0;
            if (typeof ts.seconds === 'number') return ts.seconds * 1000;
            if (typeof ts.toMillis === 'function') return ts.toMillis();
            const parsed = new Date(ts).getTime();
            return isNaN(parsed) ? 0 : parsed;
        };

        paySnap.forEach((docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() };
            const itemTime = getTimeMs(item.timestamp);

            if (item.status === 'Pending' && itemTime > 0 && (now - itemTime > MS_72_HOURS)) {
                item.status = 'Cancelled (Expired 72h)';
                try { updateDoc(doc(db, "payments", item.id), { status: 'Cancelled (Expired 72h)', expiredAt: new Date() }); } catch (e) {}
            }
            window.userPaymentsData.push(item);

            const st = String(item.status || 'Pending');
            const isRefund = st === 'Refunded' || item.type === 'SERVICE_REFUND' || String(item.utrNumber || '').startsWith('REFUND');
            const isGift = st === 'Gift / Bonus' || item.utrNumber === 'ADMIN_GIFT';
            const isAdminDeduct = st === 'Admin Deduction' || item.utrNumber === 'ADMIN_DEDUCT';
            const isApprovedRecharge = (st === 'Approved' || st === 'Auto-Approved') && !isRefund && !isGift;
            const isPendingRecharge = st === 'Pending' || st.includes('Ticket');

            const creditsVal = Math.abs(Number(item.creditsRequested !== undefined ? item.creditsRequested : (item.creditsAdded || item.amountPaid || 0)));
            const amtPaid = Number(item.amountPaid) || 0;

            if (isRefund) {
                totalRefundedCr += creditsVal;
                entries.push({
                    id: `pay_${item.id}`, timeMs: itemTime || now, category: 'REFUND',
                    title: '🔄 Credit Refund (क्रेडिट रिफंड)',
                    subtitle: item.note || 'कैंसिल / फेल सर्विस का ऑटो-रिफंड',
                    serviceTag: 'REFUND', creditDelta: +creditsVal, amountRupees: 0,
                    refText: item.utrNumber || 'AUTO_REFUND', statusText: 'Refunded', statusStyle: 'green'
                });
            } else if (isGift) {
                totalGiftCr += creditsVal;
                entries.push({
                    id: `pay_${item.id}`, timeMs: itemTime || now, category: 'GIFT',
                    title: '🎁 Admin Gift / Bonus Credits',
                    subtitle: item.note || 'एडमिन द्वारा फ्री बोनस क्रेडिट्स दिए गए',
                    serviceTag: 'GIFT', creditDelta: +creditsVal, amountRupees: 0,
                    refText: 'ADMIN_GIFT', statusText: 'Credited', statusStyle: 'purple'
                });
            } else if (isAdminDeduct) {
                totalDeductedCr += creditsVal;
                entries.push({
                    id: `pay_${item.id}`, timeMs: itemTime || now, category: 'DEDUCTION',
                    title: '⚙️ Admin Wallet Adjustment',
                    subtitle: item.note || 'एडमिन द्वारा क्रेडिट्स समायोजित किए गए',
                    serviceTag: 'ADJUSTMENT', creditDelta: -creditsVal, amountRupees: 0,
                    refText: 'ADMIN_DEDUCT', statusText: 'Deducted', statusStyle: 'red'
                });
            } else {
                if (isApprovedRecharge) totalRechargedCr += creditsVal;
                else if (isPendingRecharge) { totalPendingAmt += amtPaid; pendingCount++; }

                let statusStyle = 'amber';
                if (isApprovedRecharge) statusStyle = 'green';
                else if (st.includes('Ticket')) statusStyle = 'indigo';
                else if (st.includes('Rejected') || st.includes('Cancelled')) statusStyle = 'slate';

                entries.push({
                    id: `pay_${item.id}`, timeMs: itemTime || now, category: 'RECHARGE',
                    title: '💳 Wallet Credit Recharge (वॉलेट रिचार्ज)',
                    subtitle: item.note ? `Note: ${item.note}` : `Razorpay Online Payment (₹${amtPaid})`,
                    serviceTag: 'RECHARGE', creditDelta: isApprovedRecharge ? +creditsVal : 0,
                    pendingCredits: !isApprovedRecharge ? creditsVal : 0, amountRupees: amtPaid,
                    refText: item.razorpayPaymentId || item.utrNumber || item.orderId || 'RAZORPAY',
                    statusText: st, statusStyle: statusStyle,
                    rawOrderId: item.razorpayOrderId || item.orderId || ''
                });
            }
        });

        histSnap.forEach((docSnap) => {
            const docItem = { id: docSnap.id, ...docSnap.data() };
            window.historyData.push(docItem);

            const docTime = getTimeMs(docItem.timestamp);
            const sType = docItem.serviceType || 'Document';
            const fData = docItem.formData || {};

            let baseCost = fData.CREDITS_DEDUCTED !== undefined
                ? Number(fData.CREDITS_DEDUCTED)
                : (docItem.creditsDeducted !== undefined
                    ? Number(docItem.creditsDeducted)
                    : (typeof window.getServiceCreditCost === 'function' ? window.getServiceCreditCost(sType) : 10));

            if (window.currentUserData?.hasFreeAccess && fData.CREDITS_DEDUCTED === undefined) baseCost = 0;

            const applicantName = fData.NAME || fData.applicantName || fData.childName || fData.NEW_NAME || fData.parentName || docItem.fileName || 'Customer';
            const refNo = fData.APPLICATION_REF || fData.BRN_NO || fData.REG_NO || fData.EPIC_NO || fData.GAZETTE_NO || fData.RN || docItem.id.slice(0, 8).toUpperCase();
            const displayService = sType === 'DOB Print' ? 'DOB Original PDF' : (sType === 'Minor' ? 'DOB Certificate' : sType);

            if (baseCost > 0) {
                totalDeductedCr += baseCost;
                entries.push({
                    id: `hist_${docItem.id}`, timeMs: docTime || now, category: 'DEDUCTION',
                    title: `📄 ${displayService} Generated`,
                    subtitle: `नाम: ${applicantName} (${docItem.fileName || ''})`,
                    serviceTag: displayService.toUpperCase(), creditDelta: -baseCost, amountRupees: baseCost,
                    refText: refNo, statusText: 'Card Deducted', statusStyle: 'red'
                });
            }
            if (docItem.adminStampCharged) {
                const stampFee = Number(docItem.adminStampFee) || 20;
                totalDeductedCr += stampFee;
                entries.push({
                    id: `stamp_${docItem.id}`, timeMs: getTimeMs(docItem.adminStampChargedAt) || (docTime + 1000), category: 'DEDUCTION',
                    title: `🔏 Stamp Attached on ${displayService}`,
                    subtitle: `नाम: ${applicantName} (${(docItem.stampCity || 'Stamp').toUpperCase()})`,
                    serviceTag: 'STAMP (+20 Cr)', creditDelta: -stampFee, amountRupees: stampFee,
                    refText: refNo, statusText: 'Stamp Fee', statusStyle: 'red'
                });
            }
            if (docItem.adminCertCharged) {
                const certFee = Number(docItem.adminCertFee) || 20;
                totalDeductedCr += certFee;
                entries.push({
                    id: `cert_${docItem.id}`, timeMs: getTimeMs(docItem.adminCertChargedAt) || (docTime + 2000), category: 'DEDUCTION',
                    title: `📜 Certificate Attached on ${displayService}`,
                    subtitle: `नाम: ${applicantName}`,
                    serviceTag: 'CERT (+20 Cr)', creditDelta: -certFee, amountRupees: certFee,
                    refText: refNo, statusText: 'Cert Fee', statusStyle: 'red'
                });
            }
        });

        entries.sort((a, b) => b.timeMs - a.timeMs);
        window.userPassbookEntries = entries;

        const elBal = document.getElementById('sumCurrentBalance'); if (elBal) elBal.innerText = `${window.currentUserData.credits || 0} Cr`;
        const elRech = document.getElementById('sumApprovedAmt'); if (elRech) elRech.innerText = `+${totalRechargedCr} Cr`;
        const elDed = document.getElementById('sumTotalDeducted'); if (elDed) elDed.innerText = `-${totalDeductedCr} Cr`;
        const elRefGift = document.getElementById('sumTotalRefundGift'); if (elRefGift) elRefGift.innerText = `+${totalRefundedCr + totalGiftCr} Cr`;
        const elPend = document.getElementById('sumPendingAmt'); if (elPend) elPend.innerText = `₹${totalPendingAmt} (${pendingCount})`;

        window.renderUserPassbookLedger();
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 text-xs">Failed to load wallet passbook: ${err.message}</td></tr>`;
    }
};

window.verifyPendingOrderFromPassbook = async function(orderId, creditsVal, amountVal, btnEl) {
    if (!orderId) return;
    const origHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...'; }
    try {
        const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check_order_status', razorpay_order_id: orderId, creditsRequested: creditsVal, totalPayable: amountVal })
        });
        const data = await res.json();
        if (res.ok && data.status && data.verified) {
            await window.creditWalletAfterVerifiedPayment(data);
            if (data.dbUpdated) {
                alert(`✅ पेमेंट वेरीफाई हो गया! आपके वॉलेट में +${data.creditsAdded} Credits जोड़ दिए गए हैं।`);
            }
            window.loadUserPayments();
        } else {
            alert('अभी इस ऑर्डर का पेमेंट Razorpay पर पूरा नहीं दिखा रहा है।');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origHtml; }
    }
};

window.renderUserPassbookLedger = function() {
    const tableBody = document.getElementById('userPaymentsTableBody');
    if (!tableBody) return;

    const filter = window.currentPassbookFilter || 'ALL';
    const searchVal = (document.getElementById('passbookSearchInput')?.value || '').trim().toLowerCase();

    let list = (window.userPassbookEntries || []).filter(item => {
        if (filter !== 'ALL' && item.category !== filter) return false;
        if (searchVal) {
            const hay = `${item.title} ${item.subtitle} ${item.serviceTag} ${item.refText} ${item.statusText}`.toLowerCase();
            return hay.includes(searchVal);
        }
        return true;
    });

    const countEl = document.getElementById('passbookCountLabel');
    if (countEl) countEl.innerText = `Showing ${list.length} Transactions`;

    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i><br>इस फ़िल्टर में कोई ट्रांजैक्शन नहीं मिला।</td></tr>`;
        return;
    }

    tableBody.innerHTML = list.map(item => {
        const d = new Date(item.timeMs);
        const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        let tagBadge = '';
        if (item.category === 'RECHARGE') tagBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"><i class="fa-solid fa-bolt mr-1"></i>Recharge</span>`;
        else if (item.category === 'DEDUCTION') tagBadge = `<span class="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"><i class="fa-solid fa-file-invoice mr-1"></i>${item.serviceTag}</span>`;
        else if (item.category === 'REFUND') tagBadge = `<span class="bg-teal-100 text-teal-900 border border-teal-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"><i class="fa-solid fa-rotate-left mr-1"></i>Refund</span>`;
        else if (item.category === 'GIFT') tagBadge = `<span class="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"><i class="fa-solid fa-gift mr-1"></i>Admin Gift</span>`;

        let creditCellHtml = '';
        if (item.creditDelta > 0) creditCellHtml = `<span class="text-sm font-black text-emerald-600">+${item.creditDelta} Cr</span>`;
        else if (item.creditDelta < 0) creditCellHtml = `<span class="text-sm font-black text-rose-600">${item.creditDelta} Cr</span>`;
        else creditCellHtml = `<span class="text-xs font-bold text-slate-400">(${item.pendingCredits || 0} Cr)</span>`;

        let statusBadge = '';
        if (item.statusStyle === 'green') statusBadge = `<span class="bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-check-circle mr-1"></i>${item.statusText}</span>`;
        else if (item.statusStyle === 'red') statusBadge = `<span class="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-circle-minus mr-1"></i>${item.statusText}</span>`;
        else if (item.statusStyle === 'purple') statusBadge = `<span class="bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-gift mr-1"></i>${item.statusText}</span>`;
        else if (item.statusStyle === 'indigo') statusBadge = `<span class="bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse"><i class="fa-solid fa-ticket mr-1"></i>Ticket Raised</span>`;
        else if (item.statusStyle === 'amber') {
            const verifyBtn = item.rawOrderId && String(item.rawOrderId).startsWith('order_')
                ? `<button onclick="window.verifyPendingOrderFromPassbook('${item.rawOrderId}', ${item.pendingCredits || 0}, ${item.amountRupees || 0}, this)" class="ml-1.5 bg-amber-500 hover:bg-amber-600 text-dark-950 px-2 py-0.5 rounded-md text-[10px] font-black transition shadow-sm"><i class="fa-solid fa-rotate mr-0.5"></i>Auto-Verify</button>`
                : '';
            statusBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-clock mr-1"></i>${item.statusText}</span>${verifyBtn}`;
        } else {
            statusBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">${item.statusText}</span>`;
        }

        return `
            <tr class="border-b border-slate-100 text-xs hover:bg-slate-50 transition">
                <td class="p-3 text-slate-500 font-medium whitespace-nowrap">${dateStr}<br><span class="text-[10px] text-slate-400">${timeStr}</span></td>
                <td class="p-3 whitespace-nowrap">${tagBadge}</td>
                <td class="p-3"><div class="font-black text-slate-800 text-xs">${item.title}</div><div class="text-[11px] font-semibold text-slate-500 truncate max-w-[280px]" title="${item.subtitle}">${item.subtitle}</div></td>
                <td class="p-3 whitespace-nowrap">${creditCellHtml}</td>
                <td class="p-3 font-mono font-bold text-slate-600 text-[11px] whitespace-nowrap">${item.refText}</td>
                <td class="p-3 text-right whitespace-nowrap">${statusBadge}</td>
            </tr>
        `;
    }).join('');
};
