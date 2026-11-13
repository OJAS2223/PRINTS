// ============================================================================
// FILE: js/admin-payments-history.js
// Payments Approval, Paginated Document History, Stamps, Certs, Safe Delete & DOB Sync
// ============================================================================

const {
    auth, db, doc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc,
    query, orderBy, limit, startAfter
} = window.fb;

const MS_PER_DAY = window.MS_PER_DAY;

// ================= PAYMENTS MANAGEMENT =================
window.loadAllPayments = async function() {
    const tableBody = document.getElementById('adminPaymentsTableBody');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-slate-400 font-bold text-xs"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>सभी पेमेंट और हिस्ट्री लोड हो रही हैं...</td></tr>`;
    }
    try {
        const querySnapshot = await getDocs(collection(db, "payments"));
        window.allPaymentsData = [];
        const now = Date.now();
        const MS_72_HOURS = 72 * 60 * 60 * 1000;

        querySnapshot.forEach((docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() };
            const sec = item.timestamp?.seconds || (item.timestamp ? Math.floor(new Date(item.timestamp).getTime() / 1000) : 0);
            const itemTime = sec * 1000;
            if (item.status === 'Pending' && itemTime > 0 && (now - itemTime > MS_72_HOURS)) {
                item.status = 'Cancelled (Expired 72h)';
                try { updateDoc(doc(db, "payments", item.id), { status: 'Cancelled (Expired 72h)', expiredAt: new Date() }); } catch (e) {}
            }
            window.allPaymentsData.push(item);
        });
        window.allPaymentsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        window.updatePaymentStatsAndBadges();
        window.renderPaymentsByFilter();
    } catch (err) {}
};

window.updatePaymentStatsAndBadges = function() {
    let pendingCount = 0, pendingAmt = 0, approvedCount = 0, approvedAmt = 0, rejectedCount = 0, rejectedAmt = 0;
    window.allPaymentsData.forEach(item => {
        const amt = parseFloat(item.amountPaid) || 0;
        const st = (item.status || 'Pending');
        if (st === 'Pending' || st.includes('Ticket')) { pendingCount++; pendingAmt += amt; }
        else if (st === 'Approved' || st === 'Auto-Approved' || st === 'Gift / Bonus' || st === 'Refunded') { approvedCount++; approvedAmt += amt; }
        else if (st === 'Rejected' || st.includes('Cancelled')) { rejectedCount++; rejectedAmt += amt; }
    });
    if (document.getElementById('statPendingCount')) document.getElementById('statPendingCount').innerText = `${pendingCount} Requests`;
    if (document.getElementById('statPendingAmt')) document.getElementById('statPendingAmt').innerText = `₹${pendingAmt}`;
    if (document.getElementById('statApprovedCount')) document.getElementById('statApprovedCount').innerText = `${approvedCount} Txns`;
    if (document.getElementById('statApprovedAmt')) document.getElementById('statApprovedAmt').innerText = `₹${approvedAmt}`;
    if (document.getElementById('statRejectedCount')) document.getElementById('statRejectedCount').innerText = `${rejectedCount} Txns`;
    if (document.getElementById('statRejectedAmt')) document.getElementById('statRejectedAmt').innerText = `₹${rejectedAmt}`;
    if (document.getElementById('pillCountPending')) document.getElementById('pillCountPending').innerText = pendingCount;
    if (document.getElementById('pillCountApproved')) document.getElementById('pillCountApproved').innerText = approvedCount;
    if (document.getElementById('pillCountRejected')) document.getElementById('pillCountRejected').innerText = rejectedCount;
    if (document.getElementById('pillCountAll')) document.getElementById('pillCountAll').innerText = window.allPaymentsData.length;
    const navBadge = document.getElementById('navPendingBadge');
    if (navBadge) {
        navBadge.innerText = pendingCount;
        navBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
};

window.setPaymentFilter = function(filterStatus) {
    window.currentPaymentFilter = filterStatus;
    const filters = ['Pending', 'Approved', 'Rejected', 'ALL'];
    filters.forEach(f => {
        const btn = document.getElementById(`filterPill-${f}`);
        if (!btn) return;
        if (f === filterStatus) {
            btn.className = "px-3 py-2.5 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shadow-sm transition flex items-center justify-center gap-1.5 border border-royal-500/40";
        } else {
            btn.className = "px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center gap-1.5 border border-slate-200";
        }
    });
    window.renderPaymentsByFilter();
};

window.renderPaymentsByFilter = function() {
    const tableBody = document.getElementById('adminPaymentsTableBody');
    const searchQuery = (document.getElementById('paymentSearchInput')?.value || '').trim().toLowerCase();
    const activeFilter = window.currentPaymentFilter;

    let list = window.allPaymentsData.filter(item => {
        const st = (item.status || 'Pending');
        if (activeFilter === 'Pending' && st !== 'Pending' && !st.includes('Ticket')) return false;
        if (activeFilter === 'Approved' && st !== 'Approved' && st !== 'Auto-Approved' && st !== 'Gift / Bonus' && st !== 'Refunded') return false;
        if (activeFilter === 'Rejected' && st !== 'Rejected' && !st.includes('Cancelled')) return false;
        if (searchQuery) {
            const emailMatch = (item.email || '').toLowerCase().includes(searchQuery);
            const utrMatch = (item.utrNumber || '').toLowerCase().includes(searchQuery);
            const amtMatch = String(item.amountPaid || '').includes(searchQuery);
            const noteMatch = (item.note || '').toLowerCase().includes(searchQuery);
            return emailMatch || utrMatch || amtMatch || noteMatch;
        }
        return true;
    });

    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (list.length === 0) {
        const emptyTitle = activeFilter === 'Pending' ? 'कोई पेंडिंग पेमेंट या टिकट नहीं है!' : 'इस फिल्टर में कोई पेमेंट रिकॉर्ड नहीं मिला!';
        tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-slate-400 font-bold"><i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i><br>${emptyTitle}</td></tr>`;
        return;
    }

    list.forEach(data => {
        const sec = data.timestamp?.seconds || Math.floor(Date.now() / 1000);
        const dateObj = new Date(sec * 1000);
        const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const vipDays = data.vipDaysRequested || (data.wantsVip ? 30 : 0);
        const creditsReq = data.creditsRequested !== undefined ? data.creditsRequested : (data.creditsAdded || 0);
        const status = data.status || 'Pending';
        const isGift = status === 'Gift / Bonus';
        const isRefund = status === 'Refunded' || data.type === 'SERVICE_REFUND';

        let statusBadge = '';
        if (isRefund) {
            statusBadge = `<span class="bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-rotate-left mr-1"></i>Refunded</span>`;
        } else if (isGift) {
            statusBadge = `<span class="bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-gift mr-1"></i>Gift / Bonus</span>`;
        } else if (status.includes('Ticket')) {
            statusBadge = `<span class="bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse"><i class="fa-solid fa-ticket mr-1"></i>Ticket Raised</span>`;
        } else if (status === 'Pending') {
            statusBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse"><i class="fa-solid fa-clock mr-1"></i>Pending</span>`;
        } else if (status === 'Approved' || status === 'Auto-Approved') {
            statusBadge = `<span class="bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-check-circle mr-1"></i>Approved</span>`;
        } else if (status.includes('Cancelled')) {
            statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-ban mr-1"></i>Cancelled</span>`;
        } else {
            statusBadge = `<span class="bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-circle-xmark mr-1"></i>${status}</span>`;
        }

        let actionHtml = '';
        if (status === 'Pending' || status.includes('Ticket')) {
            actionHtml = `
                <div class="flex items-center justify-end gap-1.5">
                    <button onclick="window.approvePayment('${data.id}', '${data.userId}', ${creditsReq}, ${vipDays}, false)" class="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1"><i class="fa-solid fa-check"></i> Approve</button>
                    <button onclick="window.rejectPayment('${data.id}')" class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 px-2 py-1.5 rounded-lg text-xs font-bold transition" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
        } else if (status === 'Rejected' || status.includes('Cancelled')) {
            actionHtml = `
                <div class="flex items-center justify-end gap-1.5">
                    <button onclick="window.approvePayment('${data.id}', '${data.userId}', ${creditsReq}, ${vipDays}, true)" class="bg-amber-500 hover:bg-amber-600 text-dark-950 px-2.5 py-1.5 rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1"><i class="fa-solid fa-wand-magic-sparkles"></i> Resolve</button>
                    <button onclick="window.deletePaymentRecord('${data.id}')" class="w-7 h-7 bg-slate-100 hover:bg-red-500 text-slate-500 hover:text-white rounded-lg text-xs transition flex items-center justify-center" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        } else {
            actionHtml = `
                <div class="flex items-center justify-end gap-2">
                    <span class="text-green-700 font-bold text-xs"><i class="fa-solid fa-circle-check"></i> Done</span>
                    <button onclick="window.deletePaymentRecord('${data.id}')" class="text-slate-400 hover:text-red-600 p-1 rounded transition" title="Delete Record"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>`;
        }

        const amtDisplay = isRefund
            ? `<span class="bg-teal-100 text-teal-900 font-black px-2 py-0.5 rounded text-xs border border-teal-300">🔄 REFUND</span>`
            : (isGift
                ? `<span class="bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded text-xs border border-purple-200">🎁 FREE (₹0)</span>`
                : `<span class="font-black text-dark-900 text-sm">₹${data.amountPaid || 0}</span>`);

        tableBody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
                <td class="p-3 text-slate-500 font-medium whitespace-nowrap">
                    ${dateStr}<br><span class="text-[10px] text-slate-400">${timeStr}</span>
                </td>
                <td class="p-3 font-black text-dark-900">
                    <div class="flex items-center gap-1.5 max-w-[210px] truncate" title="${data.email}">
                        <i class="fa-solid fa-user text-royal-500 text-[10px]"></i>
                        <span>${data.email}</span>
                    </div>
                </td>
                <td class="p-3 whitespace-nowrap">${amtDisplay}</td>
                <td class="p-3">
                    <div class="flex flex-col gap-0.5">
                        ${creditsReq !== 0 ? `<span class="font-black ${creditsReq > 0 ? 'text-royal-600' : 'text-red-600'}">${creditsReq > 0 ? '+' : ''}${creditsReq} Cr</span>` : ''}
                        ${vipDays > 0 ? `<span class="bg-amber-400 text-dark-950 px-1.5 py-0.2 rounded text-[9px] font-black inline-block w-max">👑 +${vipDays}d VIP</span>` : ''}
                        ${data.note ? `<span class="text-[10px] text-purple-700 font-black flex items-center gap-1"><i class="fa-solid fa-circle-info text-purple-500"></i> ${data.note}</span>` : ''}
                    </div>
                </td>
                <td class="p-3 whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                        <span class="font-mono font-bold text-slate-700 text-[11px]">${data.utrNumber || 'ONLINE_UPI'}</span>
                        ${data.utrNumber ? `<button onclick="window.copyUtrText('${data.utrNumber}', this)" class="text-slate-400 hover:text-slate-700 p-1" title="Copy UTR"><i class="fa-regular fa-copy text-xs"></i></button>` : ''}
                    </div>
                </td>
                <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
                <td class="p-3 text-right whitespace-nowrap">${actionHtml}</td>
            </tr>`;
    });
};

window.approvePayment = async function(paymentDocId, userId, creditsToAdd, vipDaysToAdd, isResolution = false) {
    const titleText = isResolution ? `Resolve & Approve Payment:` : `Approve Payment:`;
    const confirmMsg = vipDaysToAdd > 0
        ? `${titleText}\n• Add +${creditsToAdd} Credits\n• Add +${vipDaysToAdd} Days VIP Access\n\nक्या आप कन्फर्म हैं?`
        : `${titleText}\n• Add +${creditsToAdd} Credits to this user?\n\nक्या आप कन्फर्म हैं?`;
    if (!confirm(confirmMsg)) return;

    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        let currentCredits = 0, currentExpiry = 0;
        if (userSnap.exists()) {
            const uData = userSnap.data();
            currentCredits = uData.credits || 0;
            currentExpiry = uData.vipExpiry || 0;
        }
        const newCredits = currentCredits + creditsToAdd;
        const updatePayload = { credits: newCredits };
        if (vipDaysToAdd > 0) {
            const now = Date.now();
            const baseTime = (currentExpiry > now) ? currentExpiry : now;
            updatePayload.isVip = true;
            updatePayload.vipExpiry = baseTime + (vipDaysToAdd * MS_PER_DAY);
        }
        await updateDoc(userRef, updatePayload);
        await updateDoc(doc(db, "payments", paymentDocId), { status: "Approved", resolvedAt: new Date() });
        alert(`सफलतापूर्वक अप्रूव हो गया! +${creditsToAdd} Credits यूज़र के वॉलेट में जोड़ दिए गए हैं।`);
        await window.loadAllUsersForDropdown();
        window.loadAllPayments();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.rejectPayment = async function(paymentDocId) {
    if (!confirm(`क्या आप इस पेमेंट को REJECT करना चाहते हैं?`)) return;
    try { await updateDoc(doc(db, "payments", paymentDocId), { status: "Rejected" }); window.loadAllPayments(); } catch (err) {}
};

window.deletePaymentRecord = async function(paymentDocId) {
    if (!confirm(`क्या आप इस पेमेंट हिस्ट्री रिकॉर्ड को हमेशा के लिए डिलीट करना चाहते हैं?`)) return;
    try { await deleteDoc(doc(db, "payments", paymentDocId)); window.loadAllPayments(); } catch (err) {}
};

// ================= HISTORY, STAMP, CERTIFICATE & SAFE FILTERED DELETE =================
window.adminHistoryLastVisibleDoc = null;
window.adminHistoryHasMore = true;
window.adminHistoryIsLoading = false;
window.adminHistoryBatchSize = 50;
window.adminHistoryObserver = null;

window.loadAdminHistory = async function(isReset = true) {
    const container = document.getElementById('adminHistoryListContainer');
    const btn = document.getElementById('btnLoadMoreHistory');

    if (isReset) {
        window.adminAllHistoryData = [];
        window.adminHistoryLastVisibleDoc = null;
        window.adminHistoryHasMore = true;
        if (container) {
            container.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-100"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>रिकॉर्ड्स लोड हो रहे हैं...</div>`;
        }
    }

    if (window.adminHistoryIsLoading || !window.adminHistoryHasMore) return;
    window.adminHistoryIsLoading = true;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> लोड हो रहा है...';
    }

    await window.preloadAllAvailableStamps();

    try {
        const filterUserDropdown = document.getElementById('filterUser');
        if (filterUserDropdown && filterUserDropdown.options.length <= 1) {
            const currUserFilter = filterUserDropdown.value;
            filterUserDropdown.innerHTML = '<option value="ALL">All Users</option>';
            filterUserDropdown.innerHTML += `<option value="${window.currentUserData.uid}">👑 Harish Kumar (Admin)</option>`;
            for (const [uid, data] of Object.entries(window.usersDataList)) {
                window.allUsersMap[uid] = data.email;
                if (uid !== window.currentUserData.uid) filterUserDropdown.innerHTML += `<option value="${uid}">${data.email}</option>`;
            }
            filterUserDropdown.value = currUserFilter || 'ALL';
        }

        const historyCol = collection(db, "history");
        let historyQuery;
        if (window.adminHistoryLastVisibleDoc) {
            historyQuery = query(historyCol, orderBy("timestamp", "desc"), startAfter(window.adminHistoryLastVisibleDoc), limit(window.adminHistoryBatchSize));
        } else {
            historyQuery = query(historyCol, orderBy("timestamp", "desc"), limit(window.adminHistoryBatchSize));
        }

        let snap;
        try {
            snap = await getDocs(historyQuery);
        } catch (queryErr) {
            historyQuery = query(historyCol, limit(window.adminHistoryBatchSize));
            snap = await getDocs(historyQuery);
        }

        if (snap.empty || snap.docs.length < window.adminHistoryBatchSize) {
            window.adminHistoryHasMore = false;
        }

        if (!snap.empty) {
            window.adminHistoryLastVisibleDoc = snap.docs[snap.docs.length - 1];
            snap.forEach(docSnap => {
                window.adminAllHistoryData.push({ id: docSnap.id, ...docSnap.data() });
            });
        }

        window.stampSelectionMap = window.stampSelectionMap || {};
        window.certificateSelectionMap = window.certificateSelectionMap || {};

        window.adminAllHistoryData.forEach((rec, idx) => {
            if (rec.withStamp && !window.stampSelectionMap[idx]) {
                window.stampSelectionMap[idx] = {
                    enabled: true,
                    stampFile: rec.stampFile || 'stamp.png',
                    stampSrc: window.getStampDataUrlByName(rec.stampFile || 'stamp.png')
                };
            }
            const certEnabled = rec.certificateFileId ? (rec.isCertificateAttached !== false) : false;
            if (rec.certificateFileId && !window.certificateSelectionMap[idx]) {
                window.certificateSelectionMap[idx] = { enabled: certEnabled, certificateFileId: rec.certificateFileId };
            }
        });

        window.renderAdminHistory();
        window.setupAdminHistoryInfiniteScroll();

        if (isReset) {
            const pendingDobRecords = window.adminAllHistoryData.filter(rec => {
                if (rec.fileId !== 'SERVER_API_DOB_PRINT') return false;
                const st = String(rec.formData?.API_STATUS || 'pending').toLowerCase();
                const hasPdf = Boolean(rec.formData?.HAS_PDF || rec.formData?.ENCRYPTED_PDF_TOKEN || rec.formData?.PDF_URL);
                return !hasPdf && st !== 'successful' && st !== 'approved' && st !== 'failed' && st !== 'rejected';
            });
            pendingDobRecords.slice(0, 4).forEach((rec, idx) => {
                setTimeout(() => { window.adminCheckDobPrintStatus(rec.id, null, true); }, (idx + 1) * 900);
            });
        }
    } catch (err) {
        if (container && isReset) {
            container.innerHTML = `<div class="p-6 text-center text-red-500 font-bold bg-white rounded-2xl">एरर: ${err.message}</div>`;
        }
    } finally {
        window.adminHistoryIsLoading = false;
        if (btn) {
            btn.disabled = !window.adminHistoryHasMore;
            btn.innerHTML = window.adminHistoryHasMore
                ? '<i class="fa-solid fa-angles-down mr-1"></i> और रिकॉर्ड्स लोड करें (Load More)'
                : '✅ सभी रिकॉर्ड्स लोड हो चुके हैं';
            btn.className = window.adminHistoryHasMore
                ? "bg-dark-900 hover:bg-black text-royal-300 font-black px-6 py-2.5 rounded-xl text-xs shadow-sm transition flex items-center gap-2 mx-auto"
                : "bg-slate-200 text-slate-500 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-default mx-auto";
        }
    }
};

window.loadNextAdminHistoryBatch = async function() {
    if (window.adminHistoryIsLoading || !window.adminHistoryHasMore) return;
    await window.loadAdminHistory(false);
};

window.setupAdminHistoryInfiniteScroll = function() {
    const sentinel = document.getElementById('adminHistoryScrollSentinel');
    if (!sentinel) return;
    if (window.adminHistoryObserver) window.adminHistoryObserver.disconnect();
    window.adminHistoryObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && window.adminHistoryHasMore && !window.adminHistoryIsLoading) {
            window.loadNextAdminHistoryBatch();
        }
    }, { rootMargin: '200px' });
    window.adminHistoryObserver.observe(sentinel);
};

// === ADMIN DOB ORIGINAL PDF PREVIEW, DOWNLOAD, STATUS CHECK & REFUND ===
window.adminCheckDobPrintStatus = async function(docId, btnEl, silent = false) {
    if (!docId || !auth.currentUser) return;
    const origHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...'; }
    try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch('/api/dob-print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ action: 'check_status', docId })
        });
        const data = await res.json();
        const isReady = Boolean(data.hasPdf || data.apiStatus === 'successful' || data.apiStatus === 'approved');
        if (!silent) {
            alert(data.message || (isReady ? '✅ SUCCESSFUL! PDF डाउनलोड और प्रीव्यू के लिए तैयार है।' : '⏳ Status: PENDING'));
        }
        const snap = await getDoc(doc(db, "history", docId));
        if (snap.exists()) {
            const idx = window.adminAllHistoryData.findIndex(r => r.id === docId);
            if (idx !== -1) window.adminAllHistoryData[idx] = { id: snap.id, ...snap.data() };
            window.renderAdminHistory();
        }
    } catch (err) {
        if (!silent) alert('Error checking status: ' + err.message);
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origHtml; }
    }
};

window.adminOpenServerDobPrintPdf = async function(docId, fileName) {
    if (!auth.currentUser) return;
    const idToken = await auth.currentUser.getIdToken();
    const proxyViewUrl = `/api/dob-print?action=proxy_pdf&docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(idToken)}`;
    const proxyDownloadUrl = `${proxyViewUrl}&download=1`;

    document.getElementById('pdfViewerTitle').innerText = fileName || 'DOB Original PDF';
    const iframe = document.getElementById('pdfIframe');
    const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    const spinner = document.getElementById('pdfLoadingSpinner');
    const downloadBtn = document.getElementById('modalDownloadBtn');
    const printBtn = document.getElementById('modalPrintBtn');
    const modalStampLabel = document.getElementById('modalStampToggleLabel');

    if (modalStampLabel) modalStampLabel.classList.add('hidden');
    htmlPreviewContainer.style.display = 'none';
    htmlPreviewContainer.innerHTML = '';
    iframe.style.display = 'block';
    spinner.style.display = 'flex';
    iframe.src = proxyViewUrl;

    if (downloadBtn) downloadBtn.onclick = function() { window.open(proxyDownloadUrl, '_blank'); };
    if (printBtn) printBtn.onclick = function() { window.open(proxyDownloadUrl, '_blank'); };

    const modal = document.getElementById('pdfViewerModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); }
    document.body.style.overflow = 'hidden';
};

window.adminDownloadServerDobPrintPdf = async function(docId) {
    if (!auth.currentUser) return;
    const idToken = await auth.currentUser.getIdToken();
    const proxyDownloadUrl = `/api/dob-print?action=proxy_pdf&docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(idToken)}&download=1`;
    window.open(proxyDownloadUrl, '_blank');
};

window.adminRefundDobOrder = async function(docId) {
    const rec = window.adminAllHistoryData.find(r => r.id === docId);
    if (!rec) return alert('Record not found!');
    if (rec.formData?.REFUNDED) return alert('इस रिकॉर्ड का रिफंड पहले ही किया जा चुका है!');
    const hasPdf = Boolean(rec.formData?.HAS_PDF || rec.formData?.ENCRYPTED_PDF_TOKEN || rec.formData?.PDF_URL);
    if (hasPdf) return alert('इस रिकॉर्ड की ओरिजिनल PDF पहले ही जनरेट हो चुकी है (SUCCESSFUL), इसलिए इसे रिफंड करने की आवश्यकता नहीं है!');

    const refundCr = Number(rec.formData?.CREDITS_DEDUCTED) || 140;
    const targetUid = rec.userId;
    const uEmail = window.allUsersMap[targetUid] || 'User';

    if (!confirm(`क्या आप वाकई "${rec.fileName}" को कैंसिल करके यूज़र (${uEmail}) को +${refundCr} Credits रिफंड करना चाहते हैं?`)) return;

    try {
        const userRef = doc(db, "users", targetUid);
        const userSnap = await getDoc(userRef);
        let newCredits = refundCr;
        if (userSnap.exists()) {
            const cur = Number(userSnap.data().credits) || 0;
            newCredits = cur + refundCr;
            await updateDoc(userRef, { credits: newCredits });
            if (window.usersDataList[targetUid]) window.usersDataList[targetUid].credits = newCredits;
        }
        await updateDoc(doc(db, "history", docId), { 'formData.API_STATUS': 'failed', 'formData.REFUNDED': true, updatedAt: new Date() });
        await addDoc(collection(db, "payments"), {
            userId: targetUid, email: uEmail, amountPaid: 0, creditsRequested: refundCr,
            wantsVip: false, vipDaysRequested: 0, vipPlanFee: 0,
            utrNumber: `REFUND_${rec.formData?.APPLICATION_REF || docId.slice(0, 8)}`,
            status: 'Refunded', type: 'SERVICE_REFUND',
            note: `DOB Original PDF Cancelled/Refunded (${rec.formData?.NAME || ''} - ${rec.formData?.BRN_NO || ''})`,
            timestamp: new Date()
        });
        alert(`✅ सफलतापूर्वक +${refundCr} Credits यूज़र (${uEmail}) के वॉलेट में रिफंड कर दिए गए हैं!`);
        window.loadAdminHistory(true);
    } catch (err) {
        alert('Refund Error: ' + err.message);
    }
};

// ================= SEPARATE ₹20 STAMP & ₹20 CERTIFICATE DEDUCTION ENGINE =================
window.deductAnnexureAddonFee = async function(record, addonType) {
    if (!record || !String(record.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_')) return { ok: true, chargedNow: false };
    const isStamp = (addonType === 'stamp');
    const flagField = isStamp ? 'adminStampCharged' : 'adminCertCharged';
    const feeField = isStamp ? 'adminStampFee' : 'adminCertFee';
    const timeField = isStamp ? 'adminStampChargedAt' : 'adminCertChargedAt';
    const fee = isStamp ? (window.ANNEXURE_STAMP_FEE || 20) : (window.ANNEXURE_CERT_FEE || 20);
    const labelHi = isStamp ? 'स्टैम्प (Stamp)' : 'सर्टिफिकेट (Certificate)';

    if (record[flagField]) return { ok: true, chargedNow: false };
    const targetUid = record.userId;
    if (!targetUid || (window.currentUserData && targetUid === window.currentUserData.uid)) {
        record[flagField] = true;
        try { await updateDoc(doc(db, "history", record.id), { [flagField]: true }); } catch (e) {}
        return { ok: true, chargedNow: false };
    }

    try {
        const userRef = doc(db, "users", targetUid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { ok: true, chargedNow: false };
        const uData = userSnap.data();
        const currentCredits = Number(uData.credits) || 0;
        if (currentCredits < fee) {
            const proceed = confirm(`⚠️ यूज़र (${uData.email || 'User'}) के वॉलेट में केवल ${currentCredits} Credits हैं, जबकि ${labelHi} अटैच करने का शुल्क ${fee} Credits (₹${fee}) है।\n\nक्या आप फिर भी अटैच करना चाहते हैं?`);
            if (!proceed) return { ok: false, chargedNow: false };
        }
        const newCredits = Math.max(0, currentCredits - fee);
        await updateDoc(userRef, { credits: newCredits });
        await updateDoc(doc(db, "history", record.id), { [flagField]: true, [feeField]: fee, [timeField]: new Date() });

        record[flagField] = true;
        record[feeField] = fee;
        if (window.usersDataList && window.usersDataList[targetUid]) {
            window.usersDataList[targetUid].credits = newCredits;
            const selectedUid = document.getElementById('userSelectDropdown')?.value;
            if (selectedUid === targetUid) {
                const crEl = document.getElementById('currentUserCreditsDisplay');
                if (crEl) crEl.innerText = newCredits;
            }
        }
        return { ok: true, chargedNow: true, fee, newCredits, userEmail: uData.email || 'User' };
    } catch (err) {
        return { ok: true, chargedNow: false };
    }
};

window.toggleRowStampCheckbox = async function(origIndex, isChecked) {
    const record = window.adminAllHistoryData[origIndex];
    if (!record) return;
    if (isChecked) {
        const feeRes = await window.deductAnnexureAddonFee(record, 'stamp');
        if (!feeRes.ok) {
            const chk = document.getElementById(`stampChk-${origIndex}`);
            if (chk) chk.checked = false;
            return;
        }
        if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
        const cityDropdown = document.getElementById(`stampCitySelect-${origIndex}`);
        const selectedCity = cityDropdown?.value || record.stampCity || 'baraut';
        const chosenObj = window.getStampObjForCity(selectedCity);
        window.stampSelectionMap[origIndex] = { enabled: true, stampFile: chosenObj.name, stampSrc: chosenObj.dataUrl, stampCity: selectedCity };
        record.withStamp = true;
        record.stampFile = chosenObj.name;
        record.stampCity = selectedCity;
        try { await updateDoc(doc(db, "history", record.id), { withStamp: true, stampFile: chosenObj.name, stampCity: selectedCity, stampedAt: new Date() }); } catch (e) {}
        if (feeRes.chargedNow) {
            alert(`✅ स्टैम्प लगा दिया गया है और यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं!\nबचे हुए क्रेडिट्स: ${feeRes.newCredits} Cr`);
        }
    } else {
        window.stampSelectionMap[origIndex] = { enabled: false, stampFile: '', stampSrc: '', stampCity: '' };
        record.withStamp = false;
        record.stampFile = '';
        record.stampCity = '';
        try { await updateDoc(doc(db, "history", record.id), { withStamp: false, stampFile: '', stampCity: '' }); } catch (e) {}
    }
    window.renderAdminHistory();
};

window.changeRowStampCity = async function(origIndex, cityId) {
    const record = window.adminAllHistoryData[origIndex];
    if (!record || !cityId) return;
    if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
    const chosenObj = window.getStampObjForCity(cityId);
    window.stampSelectionMap[origIndex] = { enabled: true, stampFile: chosenObj.name, stampSrc: chosenObj.dataUrl, stampCity: cityId };
    record.withStamp = true;
    record.stampFile = chosenObj.name;
    record.stampCity = cityId;
    try { await updateDoc(doc(db, "history", record.id), { withStamp: true, stampFile: chosenObj.name, stampCity: cityId, stampedAt: new Date() }); } catch (e) {}
    window.renderAdminHistory();
};

window.changeModalStampCity = async function(cityId) {
    const ctx = window.currentModalContext;
    if (!ctx || !cityId) return;
    if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
    const chosenObj = window.getStampObjForCity(cityId);
    ctx.stampFile = chosenObj.name;
    ctx.stampSrc = chosenObj.dataUrl;
    ctx.stampCity = cityId;
    if (ctx.historyIndex >= 0) {
        window.stampSelectionMap[ctx.historyIndex] = { enabled: ctx.withStamp, stampFile: ctx.stampFile, stampSrc: ctx.stampSrc, stampCity: cityId };
        const record = window.adminAllHistoryData[ctx.historyIndex];
        if (record) {
            record.stampFile = ctx.stampFile;
            record.stampCity = cityId;
            try { await updateDoc(doc(db, "history", record.id), { stampFile: ctx.stampFile, stampCity: cityId }); } catch (e) {}
        }
        window.renderAdminHistory();
    }
    const record = window.adminAllHistoryData[ctx.historyIndex];
    const fData = record?.formData || {};
    if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id;
    const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    if (htmlPreviewContainer) {
        htmlPreviewContainer.innerHTML = window.buildLocalAffidavitHtml(ctx.fileId, fData, true, ctx.withStamp, ctx.stampSrc);
    }
};

window.formatRelationCodeForScript = function(relStr = '') {
    const clean = String(relStr).trim().toUpperCase();
    if (clean.includes('S/') || clean === 'S/O') return 'SO';
    if (clean.includes('D/') || clean === 'D/O') return 'DO';
    if (clean.includes('W/') || clean === 'W/O') return 'WO';
    return 'SO';
};

window.formatDateForCertificate = function(fData) {
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

window.toggleCertificateCheckbox = async function(origIndex, isChecked) {
    const record = window.adminAllHistoryData[origIndex];
    if (!record) return;
    const checkboxEl = document.getElementById(`certChk-${origIndex}`);
    if (checkboxEl) checkboxEl.disabled = true;

    if (isChecked) {
        if (record.certificateFileId) {
            const feeRes = await window.deductAnnexureAddonFee(record, 'cert');
            if (!feeRes.ok) {
                if (checkboxEl) { checkboxEl.checked = false; checkboxEl.disabled = false; }
                return;
            }
            window.certificateSelectionMap[origIndex] = { enabled: true, certificateFileId: record.certificateFileId };
            record.isCertificateAttached = true;
            try { await updateDoc(doc(db, "history", record.id), { isCertificateAttached: true }); } catch (e) {}
            if (checkboxEl) checkboxEl.disabled = false;
            window.renderAdminHistory();
            if (feeRes.chargedNow) {
                alert(`✅ सर्टिफिकेट अटैच हो गया है और यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं!\nबचे हुए क्रेडिट्स: ${feeRes.newCredits} Cr`);
            }
            return;
        }
        try {
            const fData = record.formData || {};
            const payload = {
                candidateName: fData.applicantName || fData.parentName || fData.childName || fData.newName || 'CUSTOMER',
                relationCode: window.formatRelationCodeForScript(fData.rel || 'S/o'),
                fatherName: fData.relativeName || '',
                date: window.formatDateForCertificate(fData)
            };
            const targetUrl = window.API_URLS["certificate"];
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();
            if (resData.success && resData.fileId) {
                const feeRes = await window.deductAnnexureAddonFee(record, 'cert');
                window.certificateSelectionMap[origIndex] = { enabled: true, certificateFileId: resData.fileId };
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
            if (checkboxEl) checkboxEl.checked = false;
        }
    } else {
        window.certificateSelectionMap[origIndex] = { enabled: false, certificateFileId: record.certificateFileId };
        record.isCertificateAttached = false;
        try { await updateDoc(doc(db, "history", record.id), { isCertificateAttached: false }); } catch (e) {}
    }
    if (checkboxEl) checkboxEl.disabled = false;
    window.renderAdminHistory();
};

window.getExactFilteredAdminHistory = function() {
    const fUser = document.getElementById('filterUser')?.value || 'ALL';
    const fType = document.getElementById('filterType')?.value || 'ALL';
    const fDate = document.getElementById('filterDate')?.value || '';
    const fSearch = (document.getElementById('adminHistorySearchInput')?.value || '').trim().toLowerCase();

    const indexedData = (window.adminAllHistoryData || []).map((item, idx) => ({ ...item, _origIndex: idx }));
    let filteredData = indexedData;

    if (fUser !== 'ALL') filteredData = filteredData.filter(item => String(item.userId) === String(fUser));
    if (fType !== 'ALL') {
        filteredData = filteredData.filter(item => {
            const st = String(item.serviceType || '').trim();
            if (fType === 'Minor') return st === 'Minor' || st === 'DOB';
            if (fType === 'Passport') return st === 'Passport' || st === 'Passport Services';
            if (fType === 'DOB Print') return st === 'DOB Print' || st === 'DOB Original PDF';
            return st === fType;
        });
    }
    if (fSearch) {
        filteredData = filteredData.filter(item => {
            const fName = (item.fileName || '').toLowerCase();
            const fData = item.formData || {};
            const appName = (fData.applicantName || fData.parentName || fData.childName || fData.NAME || fData.NEW_NAME || '').toLowerCase();
            const email = (window.allUsersMap[item.userId] || '').toLowerCase();
            return fName.includes(fSearch) || appName.includes(fSearch) || email.includes(fSearch);
        });
    }
    if (fDate) {
        filteredData = filteredData.filter(item => {
            const sec = item.timestamp?.seconds || (item.timestamp ? Math.floor(new Date(item.timestamp).getTime() / 1000) : 0);
            if (!sec) return false;
            const d = new Date(sec * 1000);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === fDate;
        });
    }
    return { filteredData, fUser, fType, fDate, fSearch, hasActiveFilter: (fUser !== 'ALL' || fType !== 'ALL' || Boolean(fDate) || Boolean(fSearch)) };
};

window.toggleSelectAllAdminHistory = function(isChecked) {
    document.querySelectorAll('.admin-history-row-chk').forEach(chk => { chk.checked = isChecked; });
    window.updateSelectedDeleteButtonCount();
};

window.updateSelectedDeleteButtonCount = function() {
    const checkedCount = document.querySelectorAll('.admin-history-row-chk:checked').length;
    const btn = document.getElementById('bulkDeleteBtn');
    if (!btn) return;
    if (checkedCount > 0) {
        btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected (${checkedCount})`;
        btn.className = "bg-red-600 hover:bg-red-700 text-white border border-red-700 px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm";
    } else {
        btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Filtered`;
        btn.className = "bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5";
    }
};

window.renderAdminHistory = function() {
    const container = document.getElementById('adminHistoryListContainer');
    if (!container) return;
    const { filteredData } = window.getExactFilteredAdminHistory();

    document.getElementById('historyCount').innerHTML = `
        <span class="inline-flex flex-wrap items-center gap-3">
            <span>दिख रहे हैं: <strong>${filteredData.length}</strong> फाइल्स</span>
            ${filteredData.length > 0 ? `
                <label class="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-lg text-[11px] font-black cursor-pointer select-none border border-slate-300">
                    <input type="checkbox" id="chkSelectAllHistory" onchange="window.toggleSelectAllAdminHistory(this.checked)" class="w-3.5 h-3.5 accent-red-600 rounded cursor-pointer">
                    <span>Select All Shown (${filteredData.length})</span>
                </label>
            ` : ''}
        </span>
    `;

    window.updateSelectedDeleteButtonCount();
    container.innerHTML = '';

    if (filteredData.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-100"><i class="fa-regular fa-folder-open text-4xl mb-2 text-slate-300"></i><br>इस फ़िल्टर में कोई फाइल नहीं मिली।</div>`;
        return;
    }

    filteredData.forEach(data => {
        const sec = data.timestamp?.seconds || Math.floor(Date.now() / 1000);
        const dateObj = new Date(sec * 1000);
        const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const userBadge = (data.userId === window.currentUserData.uid)
            ? '<span class="text-royal-700 font-black bg-royal-100 px-2 py-0.5 rounded text-[10px] border border-royal-200">👑 Admin</span>'
            : `<span class="font-bold text-slate-600 text-xs">${window.allUsersMap[data.userId] || 'User'}</span>`;
        const safeFileName = String(data.fileName || 'Document.pdf').replace(/'/g, "\\'");

        const isServerDobPrint = (data.fileId === 'SERVER_API_DOB_PRINT');
        const isLocalDoc = String(data.fileId || '').startsWith('LOCAL_HTML_');
        const isAutoStampedCert = (data.fileId === 'LOCAL_HTML_CASTE' || data.fileId === 'LOCAL_HTML_DOMICILE');
        const isAnnexure = String(data.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_');
        const stampState = window.stampSelectionMap[data._origIndex];
        const isStampChecked = isAutoStampedCert ? true : !!(stampState && stampState.enabled);

        const certState = window.certificateSelectionMap[data._origIndex] || { enabled: false, certificateFileId: data.certificateFileId || '' };
        const isCertChecked = !!certState.enabled;

        let rawApiStatus = String(data.formData?.API_STATUS ?? 'pending').trim().toLowerCase();
        if (rawApiStatus === 'true' || rawApiStatus === '1' || rawApiStatus === 'ok' || rawApiStatus === '') rawApiStatus = 'pending';
        const hasServerPdf = Boolean(data.formData?.HAS_PDF || data.formData?.ENCRYPTED_PDF_TOKEN || data.formData?.PDF_URL);
        const isDobCompleted = isServerDobPrint && (hasServerPdf || rawApiStatus === 'successful' || rawApiStatus === 'approved' || rawApiStatus === 'completed');
        const isDobRefunded = isServerDobPrint && Boolean(data.formData?.REFUNDED);

        let dobStatusBadgesHtml = '';
        if (isServerDobPrint) {
            dobStatusBadgesHtml += `<span class="bg-teal-100 text-teal-900 border border-teal-300 px-2 py-0.5 rounded-md text-[10px] font-black">Ref: ${data.formData?.APPLICATION_REF || 'N/A'}</span>`;
            if (isDobCompleted) dobStatusBadgesHtml += `<span class="bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-md text-[10px] font-black"><i class="fa-solid fa-check-circle mr-0.5"></i>SUCCESSFUL (PDF Ready)</span>`;
            else if (isDobRefunded) dobStatusBadgesHtml += `<span class="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-md text-[10px] font-black"><i class="fa-solid fa-rotate-left mr-0.5"></i>REFUNDED</span>`;
            else dobStatusBadgesHtml += `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black animate-pulse"><i class="fa-solid fa-clock mr-0.5"></i>PENDING</span>`;
        }

        const certificateCheckboxHtml = isAnnexure ? `
            <label class="inline-flex items-center gap-1.5 ${isCertChecked ? 'bg-indigo-100 text-indigo-900 border-indigo-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'} border px-2.5 py-2 rounded-xl text-xs font-black cursor-pointer select-none transition shadow-sm" title="सर्टिफिकेट ऑटोमैटिक जनरेट करके अटैच करें">
                <input type="checkbox" id="certChk-${data._origIndex}" ${isCertChecked ? 'checked' : ''} onchange="window.toggleCertificateCheckbox(${data._origIndex}, this.checked)" class="w-4 h-4 accent-indigo-600 rounded cursor-pointer">
                <span><i class="fa-solid fa-certificate ${isCertChecked ? 'text-indigo-700' : 'text-slate-500'} mr-0.5"></i> ${isCertChecked ? 'Cert Attached' : 'Attach Cert'}</span>
            </label>
        ` : '';

        const currentStampCity = data.stampCity || (stampState && stampState.stampCity) || 'baraut';
        const stampCheckboxHtml = isAutoStampedCert ? `
            <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1.5 rounded-xl text-xs font-black shadow-sm">
                <i class="fa-solid fa-stamp text-emerald-700"></i> Auto Stamped (m.png)
            </span>
        ` : (isAnnexure ? `
            <div class="inline-flex items-center gap-1.5 ${isStampChecked ? 'bg-green-100 text-green-900 border-green-400' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'} border px-2.5 py-1.5 rounded-xl text-xs font-black shadow-sm">
                <label class="inline-flex items-center gap-1 cursor-pointer select-none">
                    <input type="checkbox" id="stampChk-${data._origIndex}" ${isStampChecked ? 'checked' : ''} onchange="window.toggleRowStampCheckbox(${data._origIndex}, this.checked)" class="w-4 h-4 accent-green-600 rounded cursor-pointer">
                    <span><i class="fa-solid fa-stamp ${isStampChecked ? 'text-green-700' : 'text-amber-600'} mr-0.5"></i> ${isStampChecked ? 'Stamped' : 'Stamp'}</span>
                </label>
                <select id="stampCitySelect-${data._origIndex}" onchange="window.changeRowStampCity(${data._origIndex}, this.value)" class="p-1 border border-slate-300 rounded-lg text-[10px] font-black bg-white text-slate-800 outline-none cursor-pointer">
                    <option value="baraut" ${currentStampCity === 'baraut' ? 'selected' : ''}>Baraut (बड़ौत)</option>
                    <option value="baghpat" ${currentStampCity === 'baghpat' ? 'selected' : ''}>Baghpat (बागपत)</option>
                    <option value="kairana" ${currentStampCity === 'kairana' ? 'selected' : ''}>Kairana (कैराना)</option>
                    <option value="shamli" ${currentStampCity === 'shamli' ? 'selected' : ''}>Shamli (शामली)</option>
                    <option value="ghaziabad" ${currentStampCity === 'ghaziabad' ? 'selected' : ''}>Ghaziabad (गाजियाबाद)</option>
                    <option value="muzaffarnagar" ${currentStampCity === 'muzaffarnagar' ? 'selected' : ''}>Muzaffarnagar (मुजफ्फरनगर)</option>
                    <option value="saharanpur" ${currentStampCity === 'saharanpur' ? 'selected' : ''}>Saharanpur (सहारनपुर)</option>
                    <option value="meerut" ${currentStampCity === 'meerut' ? 'selected' : ''}>Meerut (मेरठ)</option>
                </select>
            </div>
        ` : '');

        const canAdminEditDoc = !isServerDobPrint && (isLocalDoc || (data.formData && Object.keys(data.formData).length > 0));
        const editAnnexureBtnHtml = canAdminEditDoc ? `
            <a href="/portal?editAnnexure=${data.id}" target="_blank" class="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-500 hover:text-white px-2.5 py-2 rounded-xl text-xs font-black transition shadow-sm" title="डॉक्यूमेंट एडिट करें"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
        ` : '';

        let mainActionBtnsHtml = '';
        if (isServerDobPrint) {
            if (isDobCompleted) {
                mainActionBtnsHtml = `
                    <button onclick="window.adminOpenServerDobPrintPdf('${data.id}', '${safeFileName}')" class="inline-flex items-center gap-1.5 bg-royal-50 text-royal-700 px-3 py-2 rounded-xl text-xs font-black hover:bg-royal-500 hover:text-white transition border border-royal-200 shadow-sm"><i class="fa-solid fa-eye"></i> Preview</button>
                    <button onclick="window.adminDownloadServerDobPrintPdf('${data.id}')" class="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-black transition shadow-sm"><i class="fa-solid fa-download"></i> Download PDF</button>
                `;
            } else {
                const refundBtn = !isDobRefunded
                    ? `<button onclick="window.adminRefundDobOrder('${data.id}')" class="inline-flex items-center gap-1 bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-600 hover:text-white px-2.5 py-2 rounded-xl text-xs font-black transition shadow-sm" title="कैंसिल होने पर यूज़र को 140 Cr रिफंड करें"><i class="fa-solid fa-rotate-left"></i> Refund 140 Cr</button>`
                    : '';
                mainActionBtnsHtml = `
                    <button onclick="window.adminCheckDobPrintStatus('${data.id}', this, false)" class="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-dark-950 px-3 py-2 rounded-xl text-xs font-black transition shadow-sm"><i class="fa-solid fa-rotate"></i> Check Status</button>
                    ${refundBtn}
                `;
            }
        } else {
            mainActionBtnsHtml = `
                <button onclick="window.openPdfViewer('${data.fileId}', '${safeFileName}', ${data._origIndex})" class="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 bg-royal-50 text-royal-700 px-3 py-2 rounded-xl text-xs font-black hover:bg-royal-500 hover:text-white transition border border-royal-200"><i class="fa-solid fa-eye"></i> Preview</button>
                <button onclick="window.triggerDirectPrintByIndex(${data._origIndex}, this)" class="inline-flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-dark-950 px-3 py-2 rounded-xl text-xs font-black transition shadow-sm"><i class="fa-solid fa-print"></i> Print</button>
            `;
        }

        container.innerHTML += `
            <div class="bg-white p-3.5 md:p-4 rounded-2xl border ${isStampChecked || isCertChecked || isDobCompleted ? 'border-royal-300 bg-slate-50/50' : 'border-slate-200'} shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 hover:border-royal-400 transition">
                <div class="flex items-start gap-3 overflow-hidden w-full">
                    <input type="checkbox" value="${data.id}" onchange="window.updateSelectedDeleteButtonCount()" class="admin-history-row-chk w-4 h-4 mt-1 accent-red-600 rounded cursor-pointer shrink-0" title="इस फाइल को डिलीट के लिए चुनें">
                    <div class="space-y-1 overflow-hidden w-full">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">${data.serviceType === 'DOB Print' ? 'DOB Original PDF' : data.serviceType}</span>
                            ${dobStatusBadgesHtml}
                            ${data.adminStampCharged ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black"><i class="fa-solid fa-stamp mr-0.5"></i>20 Cr Stamp</span>` : ""}
                            ${data.adminCertCharged ? `<span class="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-md text-[10px] font-black"><i class="fa-solid fa-certificate mr-0.5"></i>20 Cr Cert</span>` : ""}
                            ${userBadge}
                            <span class="text-[11px] text-slate-400 font-medium ml-auto xl:ml-0">${dateStr} • ${timeStr}</span>
                        </div>
                        <p class="font-black text-slate-800 text-xs md:text-sm truncate">${data.fileName}</p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end shrink-0 border-t xl:border-t-0 pt-2 xl:pt-0 border-slate-100">
                    ${certificateCheckboxHtml}
                    ${stampCheckboxHtml}
                    ${editAnnexureBtnHtml}
                    ${mainActionBtnsHtml}
                    <button onclick="window.deleteHistoryRecord('${data.id}')" class="w-9 h-9 inline-flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition border border-red-100" title="केवल यही 1 फाइल डिलीट करें"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.deleteHistoryRecord = async function(docId) {
    const cleanId = String(docId || '').trim();
    if (!cleanId) return alert('अमान्य डॉक्यूमेंट ID!');
    const targetRec = (window.adminAllHistoryData || []).find(item => item.id === cleanId);
    const fileLabel = targetRec ? `${targetRec.fileName} (${targetRec.serviceType})` : cleanId;
    if (!confirm(`🗑️ Single File Delete:\n\nक्या आप केवल इस 1 फाइल को डिलीट करना चाहते हैं?\n📄 फाइल: ${fileLabel}`)) return;
    try {
        await deleteDoc(doc(db, "history", cleanId));
        window.adminAllHistoryData = (window.adminAllHistoryData || []).filter(item => item.id !== cleanId);
        window.renderAdminHistory();
    } catch (err) {
        alert('फाइल डिलीट करने में समस्या आई: ' + err.message);
    }
};

window.bulkDeleteFilteredHistory = async function() {
    const checkedBoxes = Array.from(document.querySelectorAll('.admin-history-row-chk:checked'));
    let targetIdsToDelete = [];
    let confirmMessage = '';

    if (checkedBoxes.length > 0) {
        targetIdsToDelete = checkedBoxes.map(chk => String(chk.value).trim()).filter(Boolean);
        confirmMessage = `🗑️ Selected Files Delete:\n\nआपने ${targetIdsToDelete.length} फाइलों पर टिक (Select) किया है।\nक्या आप केवल इन ${targetIdsToDelete.length} चुनी हुई फाइलों को डिलीट करना चाहते हैं?`;
    } else {
        const { filteredData, fUser, fType, fDate, fSearch, hasActiveFilter } = window.getExactFilteredAdminHistory();
        if (!hasActiveFilter) {
            return alert(
                '⚠️ सुरक्षा लॉक (Database Protection):\n\n' +
                'पूरा डेटाबेस एक साथ डिलीट होने से बचाने के लिए बिना फ़िल्टर के Bulk Delete बंद है!\n\n' +
                '👉 कृपया पहले:\n1. कोई एक User, Document Type, या Date सेलेक्ट करें, या\n2. जिन फाइलों को डिलीट करना है उनके आगे दिए गए बॉक्स (Checkbox) पर टिक लगाएं।'
            );
        }
        if (filteredData.length === 0) return alert('इस फ़िल्टर में डिलीट करने के लिए कोई फाइल नहीं है!');
        targetIdsToDelete = filteredData.map(item => String(item.id || '').trim()).filter(Boolean);
        const userLabel = fUser === 'ALL' ? 'All Users' : (window.allUsersMap[fUser] || 'Selected User');
        const typeLabel = fType === 'ALL' ? 'All Types' : fType;
        confirmMessage = `⚠️ Filtered Delete Confirmation:\n\n• यूज़र फ़िल्टर: ${userLabel}\n• डॉक्यूमेंट टाइप: ${typeLabel}${fDate ? ` | Date: ${fDate}` : ''}${fSearch ? ` | Search: "${fSearch}"` : ''}\n• कुल डिलीट होने वाली फाइलें: ${targetIdsToDelete.length} फाइल्स\n\nक्या आप वाकई केवल इन ${targetIdsToDelete.length} फ़िल्टर की गई फाइलों को डिलीट करना चाहते हैं?`;
    }

    if (targetIdsToDelete.length === 0 || !confirm(confirmMessage)) return;
    const btn = document.getElementById('bulkDeleteBtn');
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...'; btn.disabled = true; }

    try {
        const deletedSet = new Set();
        for (const docId of targetIdsToDelete) {
            if (docId) { await deleteDoc(doc(db, "history", docId)); deletedSet.add(docId); }
        }
        window.adminAllHistoryData = (window.adminAllHistoryData || []).filter(item => !deletedSet.has(item.id));
        window.renderAdminHistory();
        alert(`✅ सफलतापूर्वक केवल ${deletedSet.size} चुनी गई फाइलें डिलीट की गईं! बाकी सभी रिकॉर्ड्स सुरक्षित हैं।`);
    } catch (err) {
        alert('डिलीट करने में एरर आया: ' + err.message);
    } finally {
        if (btn) { btn.innerHTML = origHTML; btn.disabled = false; window.updateSelectedDeleteButtonCount(); }
    }
};

window.triggerDirectPrintByIndex = async function(historyIndex, btnEl) {
    const record = window.adminAllHistoryData[historyIndex];
    if (!record) return;
    if (record.fileId === 'SERVER_API_DOB_PRINT') return window.adminDownloadServerDobPrintPdf(record.id);
    const stampState = window.stampSelectionMap[historyIndex];
    const withStamp = !!(stampState && stampState.enabled);
    let chosenSrc = stampState?.stampSrc || '';
    if (withStamp && !chosenSrc) {
        if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
        const chosenObj = window.pickRandomAvailableStampObj();
        chosenSrc = chosenObj.dataUrl;
        window.stampSelectionMap[historyIndex] = { enabled: true, stampFile: chosenObj.name, stampSrc: chosenSrc };
    }
    const certState = window.certificateSelectionMap[historyIndex];
    const certFileId = (certState && certState.enabled) ? certState.certificateFileId : '';
    window.directPrintDocument(record.fileId, record.formData || {}, record.fileName || 'Document.pdf', withStamp, chosenSrc, certFileId);
};

window.toggleModalStampPreview = async function(isChecked) {
    const ctx = window.currentModalContext;
    if (!ctx || !String(ctx.fileId).startsWith('LOCAL_HTML_')) return;
    if (isChecked && ctx.historyIndex >= 0 && window.adminAllHistoryData[ctx.historyIndex]) {
        const feeRes = await window.deductAnnexureAddonFee(window.adminAllHistoryData[ctx.historyIndex], 'stamp');
        if (!feeRes.ok) {
            const modalChk = document.getElementById('modalStampCheckbox');
            if (modalChk) modalChk.checked = false;
            return;
        }
    }
    if (isChecked) {
        if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
        const chosenObj = window.pickRandomAvailableStampObj();
        ctx.withStamp = true; ctx.stampFile = chosenObj.name; ctx.stampSrc = chosenObj.dataUrl;
    } else {
        ctx.withStamp = false; ctx.stampFile = ''; ctx.stampSrc = '';
    }
    if (ctx.historyIndex >= 0) {
        window.stampSelectionMap[ctx.historyIndex] = { enabled: ctx.withStamp, stampFile: ctx.stampFile, stampSrc: ctx.stampSrc };
        const record = window.adminAllHistoryData[ctx.historyIndex];
        if (record) {
            record.withStamp = ctx.withStamp; record.stampFile = ctx.stampFile;
            try { await updateDoc(doc(db, "history", record.id), { withStamp: ctx.withStamp, stampFile: ctx.stampFile || '', stampedAt: new Date() }); } catch (e) {}
        }
        window.renderAdminHistory();
    }
    const record = window.adminAllHistoryData[ctx.historyIndex];
    const fData = record?.formData || {};
    if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id;
    const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    htmlPreviewContainer.innerHTML = window.buildLocalAffidavitHtml(ctx.fileId, fData, true, ctx.withStamp, ctx.stampSrc);
};

window.openPdfViewer = async function(fileId, fileName, historyIndex = -1) {
    if (fileId === 'SERVER_API_DOB_PRINT' && historyIndex >= 0) {
        const record = window.adminAllHistoryData[historyIndex];
        if (record) return window.adminOpenServerDobPrintPdf(record.id, fileName);
    }

    document.getElementById('pdfViewerTitle').innerText = fileName;
    const iframe = document.getElementById('pdfIframe');
    const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    const spinner = document.getElementById('pdfLoadingSpinner');
    const downloadBtn = document.getElementById('modalDownloadBtn');
    const printBtn = document.getElementById('modalPrintBtn');
    const modalStampLabel = document.getElementById('modalStampToggleLabel');
    const modalStampCheckbox = document.getElementById('modalStampCheckbox');
    const shareBtn = document.getElementById('modalShareBtn');

    const isLocalDoc = String(fileId).startsWith('LOCAL_HTML_');
    const isAutoStampedCert = (fileId === 'LOCAL_HTML_CASTE' || fileId === 'LOCAL_HTML_DOMICILE');
    const isAnnexure = String(fileId).startsWith('LOCAL_HTML_ANNEXURE_');
    let initialWithStamp = false, initialStampSrc = '', initialStampFile = '', initialCertFileId = '';

    if (isAutoStampedCert) {
        initialWithStamp = true;
        initialStampFile = 'm.png';
        initialStampSrc = await window.preloadAutoMStamp();
    } else if (historyIndex >= 0) {
        const existingState = window.stampSelectionMap ? window.stampSelectionMap[historyIndex] : null;
        initialWithStamp = !!(existingState && existingState.enabled);
        initialStampSrc = existingState?.stampSrc || '';
        initialStampFile = existingState?.stampFile || '';

        const existingCert = window.certificateSelectionMap ? window.certificateSelectionMap[historyIndex] : null;
        initialCertFileId = (existingCert && existingCert.enabled) ? existingCert.certificateFileId : '';
    }

    if (initialWithStamp && !initialStampSrc && typeof window.preloadAllAvailableStamps === 'function') {
        if (window.availableStampsList && window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
        if (window.pickRandomAvailableStampObj) {
            const chosenObj = window.pickRandomAvailableStampObj();
            initialStampSrc = chosenObj.dataUrl;
            initialStampFile = chosenObj.name;
            if (historyIndex >= 0 && window.stampSelectionMap) {
                window.stampSelectionMap[historyIndex] = { enabled: true, stampFile: initialStampFile, stampSrc: initialStampSrc };
            }
        }
    }

    window.currentModalContext = { fileId, fileName, historyIndex, withStamp: initialWithStamp, stampFile: initialStampFile, stampSrc: initialStampSrc, certificateFileId: initialCertFileId };
    if (shareBtn) shareBtn.style.display = 'none';

    const previewParent = iframe.parentElement;
    previewParent.classList.add('flex', 'flex-col');

    if (isLocalDoc && historyIndex >= 0) {
        await window.preloadAllHtmlTemplates();
        if (shareBtn) shareBtn.style.display = 'flex';
        if (modalStampLabel) {
            if (isAnnexure) modalStampLabel.classList.remove('hidden');
            else modalStampLabel.classList.add('hidden');
        }
        if (modalStampCheckbox) modalStampCheckbox.checked = initialWithStamp;
        const modalCitySelect = document.getElementById('modalStampCitySelect');
        if (modalCitySelect) {
            const record = (window.historyData && window.historyData[historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[historyIndex]);
            modalCitySelect.value = record?.stampCity || 'baraut';
        }

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
