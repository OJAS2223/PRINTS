// ============================================================================
// FILE: js/portal-chat-history.js
// (Forgot Password Ticket, Live 2-Way Support Chat, Document History, PDF Viewer & DOB PDF Proxy)
// ============================================================================

window.openForgotPasswordModal = function() {
    const modal = document.getElementById('forgotPasswordModal');
    const idInp = document.getElementById('forgotUserIdInput');
    const phoneInp = document.getElementById('forgotUserPhoneInput');
    const noteInp = document.getElementById('forgotUserNoteInput');
    const resBox = document.getElementById('forgotResultBox');
    if (!modal) return;
    resBox.style.display = 'none';
    idInp.value = document.getElementById('loginUsername')?.value.trim() || '';
    phoneInp.value = '';
    noteInp.value = '';
    modal.style.display = 'flex';
};

window.closeForgotPasswordModal = function() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'none';
};

window.submitForgotPasswordTicket = async function(event) {
    event.preventDefault();
    const { db, collection, addDoc, getDocs, query, where } = window.fb;
    const userIdText = document.getElementById('forgotUserIdInput').value.trim();
    const userPhoneText = document.getElementById('forgotUserPhoneInput').value.trim();
    const userNoteText = document.getElementById('forgotUserNoteInput').value.trim();
    const btn = document.getElementById('btnSubmitForgotTicket');
    const resBox = document.getElementById('forgotResultBox');
    if (!userIdText || !userPhoneText) return alert("कृपया अपनी User ID और मोबाइल/WhatsApp नंबर ज़रूर भरें!");

    const rawId = userIdText.toLowerCase();
    const candidateEmail = rawId.includes('@') ? rawId : `${rawId}@print.com`;
    const cleanInputPhone = userPhoneText.replace(/\D/g, '').slice(-10);

    const showNotFoundError = () => {
        resBox.className = "p-3 rounded-2xl bg-red-50 border border-red-300 text-red-700 text-xs font-black text-center";
        resBox.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-1"></i> User ID or Mobile Number not found!`;
        resBox.style.display = 'block';
    };

    if (cleanInputPhone.length < 10) {
        showNotFoundError();
        return;
    }

    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Verifying...';
    resBox.style.display = 'none';

    try {
        let isVerifiedUser = false;
        const userQ = query(collection(db, "users"), where("email", "==", candidateEmail));
        const userSnap = await getDocs(userQ);
        userSnap.forEach((docSnap) => {
            const uData = docSnap.data() || {};
            const dbPhone = String(uData.userPhone || uData.whatsapp || uData.phone || uData.mobile || '').replace(/\D/g, '').slice(-10);
            if (dbPhone.length === 10 && dbPhone === cleanInputPhone) {
                isVerifiedUser = true;
            }
        });

        if (!isVerifiedUser) {
            showNotFoundError();
            return;
        }

        const finalMessage = userNoteText || "मैं अपना पासवर्ड भूल गया हूँ, कृपया नया पासवर्ड जारी करें।";
        await addDoc(collection(db, "supportTickets"), {
            type: "FORGOT_PASSWORD",
            userIdentifier: candidateEmail,
            userPhone: userPhoneText,
            message: `🔑 Forgot Password Request: ${finalMessage} (WhatsApp: ${userPhoneText})`,
            messages: [{ sender: 'user', text: `🔑 [FORGOT PASSWORD TICKET]\nUser ID: ${candidateEmail}\nWhatsApp: ${userPhoneText}\nNote: ${finalMessage}`, time: Date.now() }],
            status: "Open",
            unreadByAdmin: true,
            unreadByUser: false,
            timestamp: new Date(),
            updatedAtMs: Date.now()
        });
        try {
            await addDoc(collection(db, "forgotTickets"), {
                userIdentifier: candidateEmail, userPhone: userPhoneText, note: finalMessage, status: "Pending", timestamp: new Date()
            });
        } catch (e) {}
        if (typeof window.notifyAdminSecurely === 'function') {
            window.notifyAdminSecurely({ type: "FORGOT_PASSWORD", userId: candidateEmail, phone: userPhoneText, message: finalMessage });
        }
        resBox.className = "p-3.5 rounded-2xl bg-green-50 border border-green-300 text-green-900 text-xs font-bold text-center space-y-1";
        resBox.innerHTML = `<div><i class="fa-solid fa-circle-check text-green-600 text-base mr-1"></i> आपका टिकट सफलतापूर्वक रेज़ हो गया है!</div><p class="text-[11px] text-green-700">एडमिन को सूचना भेज दी गई है। जल्द ही आपके नंबर (${userPhoneText}) पर नया पासवर्ड भेज दिया जाएगा।</p>`;
        resBox.style.display = 'block';
        event.target.reset();
    } catch (err) {
        showNotFoundError();
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

window.startUserSupportChatListener = function(uid) {
    const { db, doc, updateDoc, onSnapshot } = window.fb;
    if (window.userChatUnsubscribe) window.userChatUnsubscribe();
    window.userChatUnsubscribe = onSnapshot(doc(db, "supportTickets", uid), async (snap) => {
        window.currentUserChatData = snap.exists() ? snap.data() : { messages: [], unreadByUser: false };
        const isUnread = window.currentUserChatData.unreadByUser === true;
        const headerBadge = document.getElementById('headerSupportUnreadBadge');
        const gearBadge = document.getElementById('gearSupportUnreadBadge');
        if (window.currentActiveTab === 'support_chat') {
            if (isUnread) {
                try { await updateDoc(doc(db, "supportTickets", uid), { unreadByUser: false }); } catch (e) {}
            }
            if (headerBadge) headerBadge.style.display = 'none';
            if (gearBadge) gearBadge.style.display = 'none';
            window.renderUserLiveChatMessages();
        } else {
            if (headerBadge) { headerBadge.innerText = '1'; headerBadge.style.display = isUnread ? 'inline-flex' : 'none'; }
            if (gearBadge) { gearBadge.innerText = 'New'; gearBadge.style.display = isUnread ? 'inline-block' : 'none'; }
        }
    });
};

window.renderUserLiveChatMessages = function() {
    const box = document.getElementById('userLiveChatMessagesBox');
    if (!box) return;
    let msgs = Array.isArray(window.currentUserChatData?.messages) ? [...window.currentUserChatData.messages] : [];
    if (msgs.length === 0 && window.currentUserChatData?.message) msgs.push({ sender: 'user', text: window.currentUserChatData.message, time: Date.now() });
    if (msgs.length === 0) {
        box.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400"><div class="w-12 h-12 rounded-full bg-royal-50 text-royal-500 flex items-center justify-center text-xl mb-2 border border-royal-200"><i class="fa-solid fa-comments"></i></div><p class="text-xs font-black text-slate-600">Ojas Live Support Chat</p><p class="text-[11px] text-slate-400 mt-0.5">कोई भी समस्या या सवाल नीचे लिखकर भेजें। एडमिन का रिप्लाई यहीं इसी चैट में लाइव दिखेगा।</p></div>`;
        return;
    }
    box.innerHTML = msgs.map(m => {
        const isMe = m.sender === 'user';
        const tStr = m.time ? new Date(m.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '';
        const safeText = String(m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return isMe
            ? `<div class="flex justify-end"><div class="max-w-[80%] bg-dark-900 text-white px-3.5 py-2.5 rounded-2xl rounded-br-none shadow-sm"><p class="text-xs font-semibold whitespace-pre-line leading-relaxed">${safeText}</p><span class="block text-[9px] text-royal-300 text-right mt-1 opacity-80">${tStr} • You</span></div></div>`
            : `<div class="flex justify-start"><div class="max-w-[80%] bg-amber-50 border border-amber-300 text-slate-900 px-3.5 py-2.5 rounded-2xl rounded-bl-none shadow-sm"><span class="text-[10px] font-black text-amber-800 uppercase block mb-0.5"><i class="fa-solid fa-crown text-amber-500 mr-1"></i>Admin Support</span><p class="text-xs font-bold whitespace-pre-line leading-relaxed">${safeText}</p><span class="block text-[9px] text-slate-400 text-right mt-1">${tStr}</span></div></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
};

window.sendUserSupportMessage = async function(event) {
    event.preventDefault();
    const { db, doc, setDoc } = window.fb;
    if (!window.currentUserData) return;
    const inp = document.getElementById('userSupportChatInput');
    const btn = document.getElementById('btnSendUserChat');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    btn.disabled = true;
    const uid = window.currentUserData.uid;
    try {
        const existingMsgs = Array.isArray(window.currentUserChatData?.messages) ? [...window.currentUserChatData.messages] : [];
        existingMsgs.push({ sender: 'user', text: text, time: Date.now() });
        await setDoc(doc(db, "supportTickets", uid), {
            type: 'USER_SUPPORT_CHAT',
            userId: uid,
            userIdentifier: window.currentUserData.email,
            username: window.currentUserData.username,
            message: text,
            status: 'Open',
            unreadByAdmin: true,
            unreadByUser: false,
            timestamp: new Date(),
            updatedAtMs: Date.now(),
            messages: existingMsgs
        }, { merge: true });
    } catch (err) {
        alert("मैसेज भेजने में समस्या आई: " + err.message);
    } finally {
        btn.disabled = false;
        inp.focus();
    }
};

// ================= PORTAL ADMIN STAMP HELPERS (SINGLE STAMP: paraut.png) =================
const PORTAL_SINGLE_STAMP_FILE = "paraut.png";
const PORTAL_CANDIDATE_STAMP_FILES = [PORTAL_SINGLE_STAMP_FILE];

window.availableStampsList = window.availableStampsList || [];
window.portalStampSelectionMap = window.portalStampSelectionMap || {};
window.portalUsersMap = window.portalUsersMap || {};

window.loadPortalSingleStamp = function(fileName) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (!img.naturalWidth || img.naturalWidth === 0) return resolve(null);
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth || 794;
                canvas.height = img.naturalHeight || 1122;
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) data[i + 3] = 0;
                }
                ctx.putImageData(imgData, 0, 0);
                resolve({ name: fileName, dataUrl: canvas.toDataURL('image/png') });
            } catch (e) {
                resolve({ name: fileName, dataUrl: fileName });
            }
        };
        img.onerror = () => {
            if (!fileName.startsWith('/images/') && !fileName.startsWith('images/')) {
                img.onerror = () => resolve(null);
                img.src = 'images/' + fileName;
            } else {
                resolve(null);
            }
        };
        img.src = fileName.startsWith('/') || fileName.startsWith('images/') ? fileName : '/images/' + fileName;
    });
};

window.preloadPortalStamps = async function() {
    if (window.availableStampsList.length > 0) return window.availableStampsList;
    const results = await Promise.all(PORTAL_CANDIDATE_STAMP_FILES.map(f => window.loadPortalSingleStamp(f)));
    window.availableStampsList = results.filter(item => item !== null);
    return window.availableStampsList;
};

window.getPortalSingleStampObj = async function() {
    if (window.availableStampsList.length === 0) await window.preloadPortalStamps();
    const found = window.availableStampsList.find(s => s.name.toLowerCase() === PORTAL_SINGLE_STAMP_FILE);
    if (found) return found;
    const dataUrl = typeof window.getTransparentStampDataUrl === 'function'
        ? await window.getTransparentStampDataUrl(PORTAL_SINGLE_STAMP_FILE)
        : '/images/' + PORTAL_SINGLE_STAMP_FILE;
    return { name: PORTAL_SINGLE_STAMP_FILE, dataUrl };
};

window.deductPortalAnnexureStampFee = async function(record) {
    const { db, doc, getDoc, updateDoc } = window.fb;
    if (!record || !String(record.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_')) return { ok: true, chargedNow: false };
    if (record.adminStampCharged) return { ok: true, chargedNow: false };
    const fee = window.ANNEXURE_STAMP_FEE || 20;
    const targetUid = record.userId;
    if (!targetUid || (window.currentUserData && targetUid === window.currentUserData.uid)) {
        record.adminStampCharged = true;
        try { await updateDoc(doc(db, "history", record.id), { adminStampCharged: true }); } catch (e) {}
        return { ok: true, chargedNow: false };
    }
    try {
        const userRef = doc(db, "users", targetUid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { ok: true, chargedNow: false };
        const uData = userSnap.data();
        const currentCredits = Number(uData.credits) || 0;
        if (currentCredits < fee) {
            const proceed = confirm(`⚠️ यूज़र (${uData.email || 'User'}) के वॉलेट में केवल ${currentCredits} Credits हैं, जबकि स्टैम्प (Stamp) अटैच करने का शुल्क ${fee} Credits (₹${fee}) है।\n\nक्या आप फिर भी अटैच करना चाहते हैं?`);
            if (!proceed) return { ok: false, chargedNow: false };
        }
        const newCredits = Math.max(0, currentCredits - fee);
        await updateDoc(userRef, { credits: newCredits });
        await updateDoc(doc(db, "history", record.id), { adminStampCharged: true, adminStampFee: fee, adminStampChargedAt: new Date() });
        record.adminStampCharged = true;
        record.adminStampFee = fee;
        return { ok: true, chargedNow: true, fee, newCredits, userEmail: uData.email || 'User' };
    } catch (err) {
        return { ok: true, chargedNow: false };
    }
};

window.portalCertSelectionMap = window.portalCertSelectionMap || {};

window.formatPortalRelationCode = function(relStr = '') {
    const clean = String(relStr).trim().toUpperCase();
    if (clean.includes('S/') || clean === 'S/O') return 'SO';
    if (clean.includes('D/') || clean === 'D/O') return 'DO';
    if (clean.includes('W/') || clean === 'W/O') return 'WO';
    return 'SO';
};

window.formatPortalDateForCertificate = function(fData) {
    const months = { "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12" };
    if (fData.day && fData.monthYear) {
        let dStr = fData.day.replace(/\D/g, '');
        let d = parseInt(dStr) || 1;
        let dayNum = d < 10 ? '0' + d : '' + d;
        let parts = fData.monthYear.trim().split(/\s+/);
        let mStr = (parts[0] || 'JAN').substring(0, 3).toUpperCase();
        return `${dayNum}/${months[mStr] || '01'}/${parts[1] || new Date().getFullYear()}`;
    } else if (fData.date) {
        let dStr = fData.date;
        if (dStr.includes('-')) {
            let parts = dStr.split('-');
            if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (dStr.includes('/')) {
            let parts = dStr.split('/');
            if (parts.length === 3 && parts[2].length === 4) return dStr;
            else if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    let now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
};

window.deductPortalAnnexureCertFee = async function(record) {
    const { db, doc, getDoc, updateDoc } = window.fb;
    if (!record || !String(record.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_')) return { ok: true, chargedNow: false };
    if (record.adminCertCharged) return { ok: true, chargedNow: false };
    const fee = window.ANNEXURE_CERT_FEE || 20;
    const targetUid = record.userId;
    if (!targetUid || (window.currentUserData && targetUid === window.currentUserData.uid)) {
        record.adminCertCharged = true;
        try { await updateDoc(doc(db, "history", record.id), { adminCertCharged: true }); } catch (e) {}
        return { ok: true, chargedNow: false };
    }
    try {
        const userRef = doc(db, "users", targetUid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { ok: true, chargedNow: false };
        const uData = userSnap.data();
        const currentCredits = Number(uData.credits) || 0;
        if (currentCredits < fee) {
            const proceed = confirm(`⚠️ यूज़र (${uData.email || 'User'}) के वॉलेट में केवल ${currentCredits} Credits हैं, जबकि सर्टिफिकेट (Certificate) अटैच करने का शुल्क ${fee} Credits (₹${fee}) है।\n\nक्या आप फिर भी अटैच करना चाहते हैं?`);
            if (!proceed) return { ok: false, chargedNow: false };
        }
        const newCredits = Math.max(0, currentCredits - fee);
        await updateDoc(userRef, { credits: newCredits });
        await updateDoc(doc(db, "history", record.id), { adminCertCharged: true, adminCertFee: fee, adminCertChargedAt: new Date() });
        record.adminCertCharged = true;
        record.adminCertFee = fee;
        return { ok: true, chargedNow: true, fee, newCredits, userEmail: uData.email || 'User' };
    } catch (err) {
        return { ok: true, chargedNow: false };
    }
};

window.togglePortalRowCertCheckbox = async function(origIndex, isChecked) {
    if (!window.currentUserData?.isAdmin) return;
    const { db, doc, updateDoc } = window.fb;
    const record = window.historyData[origIndex];
    if (!record) return;
    const chkEl = document.getElementById(`portalCertChk-${origIndex}`);
    if (chkEl) chkEl.disabled = true;

    if (isChecked) {
        if (record.certificateFileId) {
            const feeRes = await window.deductPortalAnnexureCertFee(record);
            if (!feeRes.ok) {
                if (chkEl) { chkEl.checked = false; chkEl.disabled = false; }
                return;
            }
            window.portalCertSelectionMap[origIndex] = { enabled: true, certificateFileId: record.certificateFileId };
            record.isCertificateAttached = true;
            try { await updateDoc(doc(db, "history", record.id), { isCertificateAttached: true }); } catch (e) {}
            if (chkEl) chkEl.disabled = false;
            window.handleUserHistoryFilterChange();
            if (feeRes.chargedNow) {
                alert(`✅ सर्टिफिकेट अटैच हो गया है और यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं!\nबचे हुए क्रेडिट्स: ${feeRes.newCredits} Cr`);
            }
            return;
        }
        try {
            const fData = record.formData || {};
            const payload = {
                candidateName: fData.applicantName || fData.parentName || fData.childName || fData.newName || 'CUSTOMER',
                relationCode: window.formatPortalRelationCode(fData.rel || 'S/o'),
                fatherName: fData.relativeName || '',
                date: window.formatPortalDateForCertificate(fData)
            };
            const targetUrl = window.API_URLS["certificate"];
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();
            if (resData.success && resData.fileId) {
                const feeRes = await window.deductPortalAnnexureCertFee(record);
                window.portalCertSelectionMap[origIndex] = { enabled: true, certificateFileId: resData.fileId };
                record.certificateFileId = resData.fileId;
                record.isCertificateAttached = true;
                await updateDoc(doc(db, "history", record.id), {
                    certificateFileId: resData.fileId,
                    isCertificateAttached: true,
                    certificateAttachedAt: new Date()
                });
                alert(`✅ सर्टिफिकेट सफलतापूर्वक जनरेट होकर एनेक्सर के साथ अटैच हो गया है!${feeRes.chargedNow ? `\n\n💰 यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं।` : ''}`);
            } else {
                throw new Error(resData.error || 'सर्टिफिकेट जनरेशन फेल हो गया');
            }
        } catch (err) {
            alert('सर्टिफिकेट जोड़ने में समस्या आई: ' + err.message);
            if (chkEl) chkEl.checked = false;
        }
    } else {
        window.portalCertSelectionMap[origIndex] = { enabled: false, certificateFileId: record.certificateFileId };
        record.isCertificateAttached = false;
        try { await updateDoc(doc(db, "history", record.id), { isCertificateAttached: false }); } catch (e) {}
    }
    if (chkEl) chkEl.disabled = false;
    window.handleUserHistoryFilterChange();
};

window.togglePortalRowStampCheckbox = async function(origIndex, isChecked) {
    if (!window.currentUserData?.isAdmin) return;
    const { db, doc, updateDoc } = window.fb;
    const record = window.historyData[origIndex];
    if (!record) return;
    if (isChecked) {
        const feeRes = await window.deductPortalAnnexureStampFee(record);
        if (!feeRes.ok) {
            const chk = document.getElementById(`portalStampChk-${origIndex}`);
            if (chk) chk.checked = false;
            return;
        }
        const chosenObj = await window.getPortalSingleStampObj();
        window.portalStampSelectionMap[origIndex] = { enabled: true, stampFile: PORTAL_SINGLE_STAMP_FILE, stampSrc: chosenObj.dataUrl };
        record.withStamp = true;
        record.stampFile = PORTAL_SINGLE_STAMP_FILE;
        try { await updateDoc(doc(db, "history", record.id), { withStamp: true, stampFile: PORTAL_SINGLE_STAMP_FILE, stampedAt: new Date() }); } catch (e) {}
        if (feeRes.chargedNow) {
            alert(`✅ स्टैम्प लगा दिया गया है और यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं!\nबचे हुए क्रेडिट्स: ${feeRes.newCredits} Cr`);
        }
    } else {
        window.portalStampSelectionMap[origIndex] = { enabled: false, stampFile: '', stampSrc: '', stampCity: '' };
        record.withStamp = false;
        record.stampFile = '';
        record.stampCity = '';
        try { await updateDoc(doc(db, "history", record.id), { withStamp: false, stampFile: '', stampCity: '' }); } catch (e) {}
    }
    window.handleUserHistoryFilterChange();
};

window.changePortalRowStampCity = async function(origIndex, cityId) {
    if (!window.currentUserData?.isAdmin || !cityId) return;
    const { db, doc, updateDoc } = window.fb;
    const record = window.historyData[origIndex];
    if (!record) return;
    if (window.availableStampsList.length === 0) await window.preloadPortalStamps();
    const chosenObj = window.getPortalStampObjForCity(cityId);
    window.portalStampSelectionMap[origIndex] = { enabled: true, stampFile: chosenObj.name, stampSrc: chosenObj.dataUrl, stampCity: cityId };
    record.withStamp = true;
    record.stampFile = chosenObj.name;
    record.stampCity = cityId;
    try { await updateDoc(doc(db, "history", record.id), { withStamp: true, stampFile: chosenObj.name, stampCity: cityId, stampedAt: new Date() }); } catch (e) {}
    window.handleUserHistoryFilterChange();
};

window.openPdfViewer = async function(fileId, fileName, historyIndex = -1) {
    document.getElementById('pdfViewerTitle').innerText = fileName;
    const iframe = document.getElementById('pdfIframe');
    const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    const spinner = document.getElementById('pdfLoadingSpinner');
    const downloadBtn = document.getElementById('modalDownloadBtn');
    const printBtn = document.getElementById('modalPrintBtn');
    const modalStampLabel = document.getElementById('modalStampToggleLabel');
    const modalStampCheckbox = document.getElementById('modalStampCheckbox');
    const shareBtn = document.getElementById('modalShareBtn');

    const isAdmin = Boolean(window.currentUserData?.isAdmin);
    const isLocalDoc = String(fileId).startsWith('LOCAL_HTML_');
    const isAutoStampedCert = (fileId === 'LOCAL_HTML_CASTE' || fileId === 'LOCAL_HTML_DOMICILE');
    const isAnnexure = String(fileId).startsWith('LOCAL_HTML_ANNEXURE_');
    let initialWithStamp = false, initialStampSrc = '', initialStampFile = '', initialCertFileId = '';

    if (isAutoStampedCert) {
        initialWithStamp = true;
        initialStampFile = 'm.png';
        initialStampSrc = await window.preloadAutoMStamp();
    } else if (historyIndex >= 0) {
        const record = (window.historyData && window.historyData[historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[historyIndex]);
        if (record) {
            initialWithStamp = !!record.withStamp;
            initialStampFile = record.stampFile || 'paraut.png';
            initialCertFileId = (record.certificateFileId && record.isCertificateAttached !== false) ? record.certificateFileId : '';
        }
        if (initialWithStamp && !initialStampSrc && typeof window.getTransparentStampDataUrl === 'function') {
            initialStampSrc = await window.getTransparentStampDataUrl(initialStampFile);
        }
    }

    window.currentModalContext = { fileId, fileName, historyIndex, withStamp: initialWithStamp, stampFile: initialStampFile, stampSrc: initialStampSrc, certificateFileId: initialCertFileId };

    const previewParent = iframe.parentElement;
    previewParent.classList.add('flex', 'flex-col');
    if (shareBtn) shareBtn.style.display = 'none';
    if (downloadBtn) downloadBtn.style.display = 'inline-flex';

    if (isLocalDoc && historyIndex >= 0) {
        await window.preloadAllHtmlTemplates();
        if (shareBtn) shareBtn.style.display = 'inline-flex';
        if (modalStampLabel) {
            if (isAdmin && isAnnexure) modalStampLabel.classList.remove('hidden');
            else modalStampLabel.classList.add('hidden');
        }
        if (modalStampCheckbox) modalStampCheckbox.checked = initialWithStamp;

        const record = (window.historyData && window.historyData[historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[historyIndex]);
        const fData = record?.formData || {};
        if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id;
        spinner.style.display = 'none';

        if (initialCertFileId) {
            iframe.style.display = 'block';
            iframe.style.flex = '1';
            iframe.style.minHeight = '350px';
            iframe.style.borderBottom = '4px solid #cbd5e1';
            iframe.src = `https://drive.google.com/file/d/${initialCertFileId}/preview`;

            htmlPreviewContainer.style.display = 'flex';
            htmlPreviewContainer.style.flex = '1';
            htmlPreviewContainer.style.minHeight = '350px';
            htmlPreviewContainer.innerHTML = window.buildLocalAffidavitHtml(fileId, fData, true, initialWithStamp, initialStampSrc);
        } else {
            iframe.style.display = 'none';
            htmlPreviewContainer.style.display = 'flex';
            htmlPreviewContainer.style.flex = '1';
            htmlPreviewContainer.innerHTML = window.buildLocalAffidavitHtml(fileId, fData, true, initialWithStamp, initialStampSrc);
        }

        if (downloadBtn) { downloadBtn.onclick = async function() { await window.downloadHtmlDocAsPdf(fileId, fData, fileName, window.currentModalContext.withStamp, window.currentModalContext.stampSrc, window.currentModalContext.certificateFileId); }; }
        if (printBtn) { printBtn.onclick = function() { window.directPrintDocument(fileId, fData, fileName, window.currentModalContext.withStamp, window.currentModalContext.stampSrc, window.currentModalContext.certificateFileId); }; }
        if (shareBtn) { shareBtn.onclick = async function() { await window.shareHtmlDocAsPdf(fileId, fData, fileName, window.currentModalContext.withStamp, window.currentModalContext.stampSrc, window.currentModalContext.certificateFileId); }; }
    } else {
        if (modalStampLabel) modalStampLabel.classList.add('hidden');
        if (shareBtn) shareBtn.style.display = 'none';
        htmlPreviewContainer.style.display = 'none';
        htmlPreviewContainer.innerHTML = '';
        iframe.style.display = 'block';
        iframe.style.flex = '1';
        spinner.style.display = 'flex';
        iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;

        if (downloadBtn) { downloadBtn.onclick = function() { window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, '_blank'); }; }
        if (printBtn) { printBtn.onclick = function() { window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank'); }; }
    }
    const modal = document.getElementById('pdfViewerModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    document.body.style.overflow = 'hidden';
};

window.closePdfViewer = function() {
    const modal = document.getElementById('pdfViewerModal');
    if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); }
    const iframe = document.getElementById('pdfIframe');
    if (iframe) iframe.src = '';
    const htmlContainer = document.getElementById('htmlDocPreviewContainer');
    if (htmlContainer) htmlContainer.innerHTML = '';
    document.body.style.overflow = 'auto';
};

window.userHistoryBatchSize = 20;
window.userHistoryLastVisibleDoc = null;
window.userHistoryHasMore = true;
window.userHistoryIsLoading = false;
window.userHistoryObserver = null;
window.userHistoryFallbackCache = null;

window.loadUserHistory = async function(isReset = true) {
    const { db, collection, getDocs, query, where, orderBy, limit, startAfter } = window.fb;
    const historyContainer = document.getElementById('historyTableBody');
    const btn = document.getElementById('btnLoadMoreUserHistory');
    if (!historyContainer) return;

    if (isReset) {
        window.historyData = [];
        window.userHistoryLastVisibleDoc = null;
        window.userHistoryHasMore = true;
        window.userHistoryFallbackCache = null;
        historyContainer.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400 font-bold text-xs"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>Loading records...</td></tr>`;
        const mobC = document.getElementById('historyMobileCards');
        if (mobC) mobC.innerHTML = `<div class="p-6 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-slate-200"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>Loading records...</div>`;
    }

    if (window.userHistoryIsLoading || !window.userHistoryHasMore) return;
    window.userHistoryIsLoading = true;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> लोड हो रहा है...';
    }

    const isAdmin = Boolean(window.currentUserData?.isAdmin);

    try {
        if (isAdmin && isReset) {
            await window.preloadPortalStamps();
            try {
                const usersSnap = await getDocs(collection(db, "users"));
                window.portalUsersMap = {};
                const userDropdown = document.getElementById('userHistoryUserFilter');
                const prevVal = (userDropdown && userDropdown.dataset.userSelected === '1') ? userDropdown.value : window.currentUserData.uid;
                if (userDropdown) {
                    userDropdown.innerHTML = `<option value="${window.currentUserData.uid}">👑 Admin (${window.currentUserData.email})</option><option value="ALL">All Users (सभी यूज़र)</option>`;
                }
                usersSnap.forEach(uDoc => {
                    const uData = uDoc.data();
                    if (uData?.email) {
                        window.portalUsersMap[uDoc.id] = uData.email;
                        if (userDropdown && uDoc.id !== window.currentUserData.uid) {
                            userDropdown.innerHTML += `<option value="${uDoc.id}">${uData.email}</option>`;
                        }
                    }
                });
                if (userDropdown) userDropdown.value = prevVal || window.currentUserData.uid;
            } catch (e) {}
        }

        const selectedUid = isAdmin
            ? (document.getElementById('userHistoryUserFilter')?.value || window.currentUserData.uid)
            : window.currentUserData.uid;

        if (window.userHistoryFallbackCache !== null) {
            const nextSlice = window.userHistoryFallbackCache.slice(window.historyData.length, window.historyData.length + window.userHistoryBatchSize);
            window.historyData.push(...nextSlice);
            if (window.historyData.length >= window.userHistoryFallbackCache.length) window.userHistoryHasMore = false;
        } else {
            const historyCol = collection(db, "history");
            let q;
            try {
                if (isAdmin && selectedUid === 'ALL') {
                    q = window.userHistoryLastVisibleDoc
                        ? query(historyCol, orderBy("timestamp", "desc"), startAfter(window.userHistoryLastVisibleDoc), limit(window.userHistoryBatchSize))
                        : query(historyCol, orderBy("timestamp", "desc"), limit(window.userHistoryBatchSize));
                } else {
                    q = window.userHistoryLastVisibleDoc
                        ? query(historyCol, where("userId", "==", selectedUid), orderBy("timestamp", "desc"), startAfter(window.userHistoryLastVisibleDoc), limit(window.userHistoryBatchSize))
                        : query(historyCol, where("userId", "==", selectedUid), orderBy("timestamp", "desc"), limit(window.userHistoryBatchSize));
                }
                const snap = await getDocs(q);
                if (snap.empty || snap.docs.length < window.userHistoryBatchSize) window.userHistoryHasMore = false;
                if (!snap.empty) {
                    window.userHistoryLastVisibleDoc = snap.docs[snap.docs.length - 1];
                    snap.forEach((docSnap) => { window.historyData.push({ id: docSnap.id, ...docSnap.data() }); });
                }
            } catch (indexErr) {
                const fallbackQ = (isAdmin && selectedUid === 'ALL')
                    ? historyCol
                    : query(historyCol, where("userId", "==", selectedUid));
                const fullSnap = await getDocs(fallbackQ);
                const allRows = [];
                fullSnap.forEach((docSnap) => { allRows.push({ id: docSnap.id, ...docSnap.data() }); });
                allRows.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
                window.userHistoryFallbackCache = allRows;
                const firstSlice = allRows.slice(0, window.userHistoryBatchSize);
                window.historyData = [...firstSlice];
                window.userHistoryHasMore = allRows.length > window.historyData.length;
            }
        }

        if (isAdmin) {
            window.portalStampSelectionMap = window.portalStampSelectionMap || {};
            window.portalCertSelectionMap = window.portalCertSelectionMap || {};
            window.historyData.forEach((rec, idx) => {
                if (rec.withStamp && !window.portalStampSelectionMap[idx]) {
                    window.portalStampSelectionMap[idx] = {
                        enabled: true,
                        stampFile: rec.stampFile || 'paraut.png',
                        stampCity: rec.stampCity || 'baraut'
                    };
                }
                if (rec.certificateFileId && !window.portalCertSelectionMap[idx]) {
                    window.portalCertSelectionMap[idx] = {
                        enabled: rec.isCertificateAttached !== false,
                        certificateFileId: rec.certificateFileId
                    };
                }
            });
        }

        window.handleUserHistoryFilterChange();
        window.setupUserHistoryInfiniteScroll();

        if (isReset) {
            const pendingDobPrints = window.historyData.filter(item => {
                if (item.fileId !== 'SERVER_API_DOB_PRINT') return false;
                const st = String(item.formData?.API_STATUS || 'pending').toLowerCase();
                const hasPdf = Boolean(item.formData?.HAS_PDF || item.formData?.ENCRYPTED_PDF_TOKEN || item.formData?.PDF_URL);
                return !hasPdf && st !== 'successful' && st !== 'approved' && st !== 'failed' && st !== 'rejected';
            });
            if (pendingDobPrints.length > 0) {
                pendingDobPrints.slice(0, 5).forEach((item, idx) => {
                    setTimeout(() => { window.checkDobPrintOrderStatus(item.id, null, true); }, (idx + 1) * 900);
                });
            }
        }
    } catch (err) {
        if (isReset) historyContainer.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 text-xs">Failed to load history.</td></tr>`;
    } finally {
        window.userHistoryIsLoading = false;
        if (btn) {
            btn.disabled = !window.userHistoryHasMore;
            btn.innerHTML = window.userHistoryHasMore
                ? '<i class="fa-solid fa-angles-down mr-1"></i> और रिकॉर्ड्स लोड करें (Load More)'
                : '✅ सभी रिकॉर्ड्स लोड हो चुके हैं';
            btn.className = window.userHistoryHasMore
                ? "bg-dark-900 hover:bg-black text-royal-300 font-black px-5 py-2 rounded-xl text-xs shadow-sm transition inline-flex items-center gap-2"
                : "bg-slate-200 text-slate-500 font-bold px-5 py-2 rounded-xl text-xs transition cursor-default inline-flex items-center gap-2";
        }
    }
};

window.loadNextUserHistoryBatch = async function() {
    if (window.userHistoryIsLoading || !window.userHistoryHasMore) return;
    await window.loadUserHistory(false);
};

window.setupUserHistoryInfiniteScroll = function() {
    const sentinel = document.getElementById('userHistoryScrollSentinel');
    if (!sentinel) return;
    if (window.userHistoryObserver) window.userHistoryObserver.disconnect();
    window.userHistoryObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && window.userHistoryHasMore && !window.userHistoryIsLoading) {
            window.loadNextUserHistoryBatch();
        }
    }, { rootMargin: '150px' });
    window.userHistoryObserver.observe(sentinel);
};

window.handleUserHistoryFilterChange = function() {
    const type = document.getElementById('userHistoryTypeFilter')?.value || 'ALL';
    const date = document.getElementById('userHistoryDateFilter')?.value || '';
    const search = (document.getElementById('userHistorySearchInput')?.value || '').trim().toLowerCase();
    const userFilter = document.getElementById('userHistoryUserFilter')?.value || 'ALL';
    window.renderHistory(type, date, search, userFilter);
};

window.editAnnexureRecord = async function(docId) {
    const { db, doc, getDoc } = window.fb;
    if (!docId) return;
    if (!window.currentUserData || !window.currentUserData.isAdmin) {
        alert('केवल एडमिन के पास ही डॉक्यूमेंट एडिट करने की अनुमति है!');
        return;
    }
    let record = (window.historyData && window.historyData.find(d => d.id === docId)) ||
                 (window.adminAllHistoryData && window.adminAllHistoryData.find(d => d.id === docId));
    if (!record) {
        try {
            const snap = await getDoc(doc(db, "history", docId));
            if (snap.exists()) record = { id: snap.id, ...snap.data() };
        } catch (e) {}
    }
    if (!record) return alert('डॉक्यूमेंट रिकॉर्ड नहीं मिला!');
    const sType = record.serviceType;
    const adminEditTabMap = {
        'Domicile': 'domicile', 'Caste': 'caste', 'e-Voter ID': 'evoter',
        'DOB Delhi': 'dob_delhi', 'DOB Minor': 'dob_delhi', 'DOB Baraut': 'dob_baraut', 'Minor': 'minor', 'DOB': 'minor',
        'Passport': 'passport', 'Passport Services': 'passport',
        'Gazette Notification': 'gazette',
        ...(window.ANNEXURE_SERVICE_TO_TAB || {})
    };
    const tabName = adminEditTabMap[sType] || '';
    if (!tabName) return alert('इस डॉक्यूमेंट का फॉर्म एडिट के लिए उपलब्ध नहीं है!');

    window.currentEditingAnnexure = {
        docId: docId, serviceType: sType, fileId: record.fileId, fileName: record.fileName, formData: record.formData || {}
    };

    await window.switchService(tabName);
    setTimeout(() => {
        if (typeof window.populateAnnexureFormForEdit === 'function') {
            window.populateAnnexureFormForEdit(record.formData || {});
        }
    }, 150);
};

window.renderHistory = function(filterType = 'ALL', filterDate = '', filterSearch = '', filterUser = 'ALL') {
    const historyContainer = document.getElementById('historyTableBody');
    const mobileCardsContainer = document.getElementById('historyMobileCards');
    if (!historyContainer && !mobileCardsContainer) return;
    if (historyContainer) historyContainer.innerHTML = '';
    if (mobileCardsContainer) mobileCardsContainer.innerHTML = '';
    const isAdmin = Boolean(window.currentUserData?.isAdmin);
    const indexedData = window.historyData.map((item, idx) => ({ ...item, _origIndex: idx }));
    let filteredData = indexedData;

    if (isAdmin && filterUser !== 'ALL') {
        filteredData = filteredData.filter(item => String(item.userId) === String(filterUser));
    }

    if (filterType !== 'ALL') {
        filteredData = filteredData.filter(item => {
            const st = String(item.serviceType || '').trim();
            if (filterType === 'Minor') return st === 'Minor' || st === 'DOB';
            if (filterType === 'Passport') return st === 'Passport' || st === 'Passport Services';
            if (filterType === 'DOB Print') return st === 'DOB Print' || st === 'DOB Original PDF';
            return st === filterType;
        });
    }

    if (filterDate) {
        filteredData = filteredData.filter(item => {
            const sec = item.timestamp?.seconds || (item.timestamp ? Math.floor(new Date(item.timestamp).getTime() / 1000) : 0);
            if (!sec) return false;
            const d = new Date(sec * 1000);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === filterDate;
        });
    }

    if (filterSearch) {
        filteredData = filteredData.filter(item => {
            const fName = (item.fileName || '').toLowerCase();
            const fData = item.formData || {};
            const appName = (fData.applicantName || fData.parentName || fData.childName || fData.NAME || fData.newName || fData.NEW_NAME || '').toLowerCase();
            const uEmail = isAdmin ? (window.portalUsersMap[item.userId] || '').toLowerCase() : '';
            return fName.includes(filterSearch) || appName.includes(filterSearch) || uEmail.includes(filterSearch);
        });
    }

    const countEl = document.getElementById('userHistoryCount');
    if (countEl) countEl.innerText = `Total Files: ${filteredData.length}`;

    if (filteredData.length === 0) {
        if (historyContainer) historyContainer.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 text-xs"><i class="fa-regular fa-folder-open text-3xl mb-2 text-slate-300"></i><br>No records found.</td></tr>`;
        if (mobileCardsContainer) mobileCardsContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200"><i class="fa-regular fa-folder-open text-3xl mb-2 text-slate-300"></i><br>No records found.</div>`;
        return;
    }

    filteredData.forEach((data) => {
        const sec = data.timestamp?.seconds || Math.floor(Date.now() / 1000);
        const dateObj = new Date(sec * 1000);
        const dateStr = dateObj.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
        const timeStr = dateObj.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});

        const isServerDobPrint = (data.fileId === 'SERVER_API_DOB_PRINT');
        const isLocalDoc = String(data.fileId || '').startsWith('LOCAL_HTML_');
        const isAnnexure = String(data.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_');

        let badgesHtml = '';
        if (isAdmin) {
            const ownerLabel = (data.userId === window.currentUserData.uid)
                ? '<span class="bg-royal-100 text-royal-800 border border-royal-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5">👑 Admin</span>'
                : `<span class="bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold ml-1.5"><i class="fa-solid fa-user text-[9px] mr-0.5"></i>${window.portalUsersMap[data.userId] || 'User'}</span>`;
            badgesHtml += ownerLabel;
        }
        const isCasteOrDomicile = (data.fileId === 'LOCAL_HTML_CASTE' || data.fileId === 'LOCAL_HTML_DOMICILE');
        if (!isCasteOrDomicile) {
            if (data.certificateFileId && data.isCertificateAttached !== false) badgesHtml += `<span class="bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5"><i class="fa-solid fa-certificate mr-0.5"></i>Cert</span>`;
            if (data.withStamp) badgesHtml += `<span class="bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5"><i class="fa-solid fa-stamp mr-0.5"></i>Stamped</span>`;
        }

        let rawStatus = String(data.formData?.API_STATUS ?? 'pending').trim().toLowerCase();
        if (rawStatus === 'true' || rawStatus === '1' || rawStatus === 'ok' || rawStatus === '') rawStatus = 'pending';
        const hasPdf = Boolean(data.formData?.HAS_PDF || data.formData?.ENCRYPTED_PDF_TOKEN || data.formData?.PDF_URL);
        const isCompleted = hasPdf || rawStatus === 'successful' || rawStatus === 'approved' || rawStatus === 'completed';
        const isFailed = rawStatus === 'failed' || rawStatus === 'rejected';
        const safeFileName = String(data.fileName || 'Document.pdf').replace(/'/g, "\\'");

        if (isServerDobPrint) {
            badgesHtml += `<span class="bg-teal-100 text-teal-900 border border-teal-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5">Ref: ${data.formData?.APPLICATION_REF || 'N/A'}</span>`;
            if (isCompleted) badgesHtml += `<span class="bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5"><i class="fa-solid fa-check-circle mr-0.5"></i>SUCCESSFUL</span>`;
            else if (isFailed) badgesHtml += `<span class="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5"><i class="fa-solid fa-circle-xmark mr-0.5"></i>${rawStatus.toUpperCase()} (REFUNDED)</span>`;
            else badgesHtml += `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5 animate-pulse"><i class="fa-solid fa-clock mr-0.5"></i>PENDING</span>`;
        }

        let adminInlineControls = '';
        if (isAdmin) {
            if (isAnnexure) {
                const stampState = window.portalStampSelectionMap[data._origIndex];
                const isStampChecked = !!(stampState ? stampState.enabled : data.withStamp);
                const certState = window.portalCertSelectionMap[data._origIndex];
                const isCertChecked = !!(certState ? certState.enabled : (data.certificateFileId && data.isCertificateAttached !== false));
                adminInlineControls += `
                    <label title="Attach Certificate" class="inline-flex items-center gap-1 ${isCertChecked ? 'bg-indigo-100 text-indigo-700 border-indigo-400 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200'} border px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition">
                        <input type="checkbox" id="portalCertChk-${data._origIndex}" ${isCertChecked ? 'checked' : ''} onchange="window.togglePortalRowCertCheckbox(${data._origIndex}, this.checked)" class="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer">
                        <i class="fa-solid fa-certificate"></i>
                    </label>
                    <label title="Stamp" class="inline-flex items-center gap-1 ${isStampChecked ? 'bg-green-100 text-green-700 border-green-400 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200'} border px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition">
                        <input type="checkbox" id="portalStampChk-${data._origIndex}" ${isStampChecked ? 'checked' : ''} onchange="window.togglePortalRowStampCheckbox(${data._origIndex}, this.checked)" class="w-3.5 h-3.5 accent-green-600 rounded cursor-pointer">
                        <i class="fa-solid fa-stamp"></i>
                    </label>`;
            }
            const canAdminEditDoc = !isServerDobPrint && (isLocalDoc || (data.formData && Object.keys(data.formData).length > 0));
            if (canAdminEditDoc) {
                adminInlineControls += `<button onclick="window.editAnnexureRecord('${data.id}')" class="inline-flex items-center justify-center w-8 h-8 bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-500 hover:text-white rounded-lg text-xs transition shadow-xs" title="Edit Document"><i class="fa-solid fa-pen-to-square"></i></button>`;
            }
        }

        const actionBtnsHtml = isServerDobPrint
            ? (isCompleted
                ? `<div class="inline-flex items-center gap-1.5">
                       <button onclick="window.openServerDobPrintPdf('${data.id}', '${safeFileName}')" class="inline-flex items-center gap-1 bg-royal-50 text-royal-700 border border-royal-200 hover:bg-royal-600 hover:text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition shadow-sm"><i class="fa-solid fa-eye"></i> Preview</button>
                       <button onclick="window.downloadServerDobPrintPdf('${data.id}')" class="inline-flex items-center gap-1 bg-green-600 text-white hover:bg-green-700 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition shadow-sm"><i class="fa-solid fa-download"></i> Download PDF</button>
                   </div>`
                : `<div class="inline-flex items-center gap-1.5">
                       <button onclick="window.checkDobPrintOrderStatus('${data.id}', this, false)" class="inline-flex items-center gap-1 bg-amber-500 text-dark-950 hover:bg-amber-400 px-3 py-1.5 rounded-lg text-[11px] font-black transition shadow-sm"><i class="fa-solid fa-rotate"></i> Check Status</button>
                   </div>`)
            : `<div class="inline-flex items-center flex-wrap justify-end gap-1">${adminInlineControls}<button onclick="window.openPdfViewer('${data.fileId}', '${safeFileName}', ${data._origIndex})" class="inline-flex items-center gap-1 bg-royal-50 text-royal-700 border border-royal-200 hover:bg-royal-600 hover:text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition shadow-sm"><i class="fa-solid fa-print"></i> Preview / Print</button></div>`;

        const typeLabel = data.serviceType === 'DOB Print' ? 'DOB Original PDF' : data.serviceType;
        if (historyContainer) {
            historyContainer.innerHTML += `
                <tr class="border-b border-slate-100 text-xs hover:bg-slate-50 transition">
                    <td class="p-3 font-bold text-slate-800">${data.fileName}${badgesHtml}</td>
                    <td class="p-3"><span class="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">${typeLabel}</span></td>
                    <td class="p-3 text-slate-500 text-[11px] font-medium">${dateStr} <br> ${timeStr}</td>
                    <td class="p-3 text-right whitespace-nowrap">${actionBtnsHtml}</td>
                </tr>
            `;
        }
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML += `
                <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2">
                    <div class="flex items-center justify-between gap-2">
                        <span class="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">${typeLabel}</span>
                        <span class="text-[10px] font-bold text-slate-400">${dateStr} • ${timeStr}</span>
                    </div>
                    <div class="text-xs font-black text-slate-800 leading-snug break-words">${data.fileName}</div>
                    ${badgesHtml ? `<div class="flex flex-wrap items-center gap-1">${badgesHtml.replace(/ml-1\.5/g, '')}</div>` : ''}
                    <div class="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-1.5">${actionBtnsHtml}</div>
                </div>
            `;
        }
    });
};

window.checkDobPrintOrderStatus = async function(docId, btnEl, silent = false) {
    if (!docId || !window.fb.auth.currentUser) return;
    const origHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...'; }
    try {
        const idToken = await window.fb.auth.currentUser.getIdToken(true);
        const res = await fetch('/api/dob-print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ action: 'check_status', docId })
        });
        const data = await res.json();
        const isReady = Boolean(data.hasPdf || data.apiStatus === 'successful' || data.apiStatus === 'approved');
        if (!silent) alert(data.message || (isReady ? '✅ SUCCESSFUL! PDF डाउनलोड के लिए तैयार है।' : '⏳ Status: PENDING'));
        if (isReady || data.refunded || !silent) await window.loadUserHistory();
    } catch (err) {
        if (!silent) alert('Error checking status: ' + err.message);
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origHtml; }
    }
};

window.openServerDobPrintPdf = async function(docId, fileName) {
    if (!window.fb.auth.currentUser) return;
    const idToken = await window.fb.auth.currentUser.getIdToken();
    const proxyViewUrl = `/api/dob-print?action=proxy_pdf&docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(idToken)}`;
    const proxyDownloadUrl = `${proxyViewUrl}&download=1`;

    document.getElementById('pdfViewerTitle').innerText = fileName || 'DOB Original PDF';
    const iframe = document.getElementById('pdfIframe');
    const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    const spinner = document.getElementById('pdfLoadingSpinner');
    const printBtn = document.getElementById('modalPrintBtn');
    const downloadBtn = document.getElementById('modalDownloadBtn');

    htmlPreviewContainer.style.display = 'none';
    htmlPreviewContainer.innerHTML = '';
    iframe.style.display = 'block';
    spinner.style.display = 'flex';
    iframe.src = proxyViewUrl;

    if (printBtn) printBtn.onclick = () => window.open(proxyDownloadUrl, '_blank');
    if (downloadBtn) downloadBtn.onclick = () => window.open(proxyDownloadUrl, '_blank');

    const modal = document.getElementById('pdfViewerModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    document.body.style.overflow = 'hidden';
};

window.downloadServerDobPrintPdf = async function(docId) {
    if (!window.fb.auth.currentUser) return;
    const idToken = await window.fb.auth.currentUser.getIdToken();
    window.open(`/api/dob-print?action=proxy_pdf&docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(idToken)}&download=1`, '_blank');
};
