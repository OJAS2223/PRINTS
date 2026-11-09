// === THEME MANAGER (DARK / LIGHT MODE) ===
window.initTheme = function() {
    const saved = localStorage.getItem('ojas_theme');
    const isDark = saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeToggleIcons(isDark);
};
window.toggleTheme = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('ojas_theme', isDark ? 'dark' : 'light');
    updateThemeToggleIcons(isDark);
};
function updateThemeToggleIcons(isDark) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.innerHTML = isDark 
            ? '<i class="fa-solid fa-sun text-amber-400 text-xs md:text-sm"></i>' 
            : '<i class="fa-solid fa-moon text-royal-300 text-xs md:text-sm"></i>';
        btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTheme);
} else {
    window.initTheme();
}

// ============================================================================
// FILE: js/admin-logic.js (COMPLETE & UNIFIED PORTAL LOGIN GUARD)
// ============================================================================

import "./config-templates.js?v=5.1";

const {
    firebaseConfig, auth, db, onAuthStateChanged, signOut,
    doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, onSnapshot,
    query, where, orderBy, limit, startAfter
} = window.fb;

const ADMIN_EMAIL = window.ADMIN_EMAIL;
const FREE_VIP_EMAILS = window.FREE_VIP_EMAILS;
const MS_PER_DAY = window.MS_PER_DAY;

// ================= STAMP FILES AUTO-DETECT & RANDOM CONFIG =================
const CITY_STAMP_CONFIG = [
    { id: 'baraut', name: 'Baraut (बड़ौत)', files: ['baraut.png', 'stamp_baraut.png', 'stamp1.png', 'stamp.png'] },
    { id: 'baghpat', name: 'Baghpat (बागपत)', files: ['baghpat.png', 'stamp_baghpat.png', 'stamp2.png'] },
    { id: 'kairana', name: 'Kairana (कैराना)', files: ['kairana.png', 'stamp_kairana.png', 'stamp3.png'] },
    { id: 'shamli', name: 'Shamli (शामली)', files: ['shamli.png', 'stamp_shamli.png', 'stamp4.png'] },
    { id: 'ghaziabad', name: 'Ghaziabad (गाजियाबाद)', files: ['ghaziabad.png', 'stamp_ghaziabad.png', 'stamp5.png'] },
    { id: 'muzaffarnagar', name: 'Muzaffarnagar (मुजफ्फरनगर)', files: ['muzaffarnagar.png', 'stamp_muzaffarnagar.png'] },
    { id: 'saharanpur', name: 'Saharanpur (सहारनपुर)', files: ['saharanpur.png', 'stamp_saharanpur.png'] },
    { id: 'meerut', name: 'Meerut (मेरठ)', files: ['meerut.png', 'stamp_meerut.png'] }
];

const CANDIDATE_STAMP_FILES = [
    "stamp.png", "stamp1.png", "stamp2.png", "stamp3.png", "stamp4.png", "stamp5.png",
    "baraut.png", "stamp_baraut.png",
    "baghpat.png", "stamp_baghpat.png",
    "kairana.png", "stamp_kairana.png",
    "shamli.png", "stamp_shamli.png",
    "ghaziabad.png", "stamp_ghaziabad.png",
    "muzaffarnagar.png", "stamp_muzaffarnagar.png",
    "saharanpur.png", "stamp_saharanpur.png",
    "meerut.png", "stamp_meerut.png"
];

window.getStampObjForCity = function(cityId) {
    if (!cityId) return window.pickRandomAvailableStampObj();
    const cfg = CITY_STAMP_CONFIG.find(c => c.id === cityId);
    if (cfg) {
        for (const f of cfg.files) {
            const found = window.availableStampsList.find(s => s.name.toLowerCase() === f.toLowerCase());
            if (found) return found;
        }
    }
    const directFound = window.availableStampsList.find(s => s.name.toLowerCase().includes(cityId.toLowerCase()));
    if (directFound) return directFound;
    return window.availableStampsList[0] || { name: cityId + '.png', dataUrl: cityId + '.png' };
};

window.availableStampsList = [];
window.stampSelectionMap = {};
window.certificateSelectionMap = {}; 
window.currentModalContext = { fileId: '', fileName: '', historyIndex: -1, withStamp: false, stampSrc: '', stampFile: '', certificateFileId: '' };

window.currentUserData = null;
window.allUsersMap = {};
window.usersDataList = {};
window.adminAllHistoryData = [];

window.allPaymentsData = [];
window.currentPaymentFilter = 'Pending';
window.allSupportTickets = [];
window.selectedChatTicketId = null;
window.supportUnsubscribe = null;
window.adminSupportWhatsapp = "919306437623";

window.loadSingleStampFile = function(fileName) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (!img.naturalWidth || img.naturalWidth === 0) return resolve(null);
            try {
                const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth || 794; canvas.height = img.naturalHeight || 1122; ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) { if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) { data[i + 3] = 0; } }
                ctx.putImageData(imgData, 0, 0); resolve({ name: fileName, dataUrl: canvas.toDataURL('image/png') });
            } catch (e) { resolve({ name: fileName, dataUrl: fileName }); }
        };
        img.onerror = () => { if (!fileName.startsWith('/images/') && !fileName.startsWith('images/')) { img.onerror = () => resolve(null); img.src = 'images/' + fileName; } else { resolve(null); } }; img.src = fileName.startsWith('/') || fileName.startsWith('images/') ? fileName : '/images/' + fileName;
    });
};

window.preloadAllAvailableStamps = async function() {
    if (window.availableStampsList.length > 0) return window.availableStampsList;
    const results = await Promise.all(CANDIDATE_STAMP_FILES.map(file => window.loadSingleStampFile(file)));
    window.availableStampsList = results.filter(item => item !== null);
    window.updateStampCountBadge(); return window.availableStampsList;
};

window.updateStampCountBadge = function() {
    const badge = document.getElementById('activeStampsBadge'); if (!badge) return;
    const count = window.availableStampsList.length;
    if (count > 0) {
        const names = window.availableStampsList.map(s => s.name).join(', ');
        badge.className = "text-[10px] font-black bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 rounded-full";
        badge.innerHTML = `<i class="fa-solid fa-stamp mr-1"></i>${count} Stamps Active`; badge.title = `Loaded: ${names}`;
    } else {
        badge.className = "text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full";
        badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i>No Stamp Uploaded`;
    }
};

window.pickRandomAvailableStampObj = function() {
    if (window.availableStampsList.length === 0) return { name: "stamp.png", dataUrl: "stamp.png" };
    const randomIndex = Math.floor(Math.random() * window.availableStampsList.length); return window.availableStampsList[randomIndex];
};
window.pickRandomAvailableStamp = function() { return window.pickRandomAvailableStampObj().dataUrl; };
window.getStampDataUrlByName = function(fileName) {
    if (!fileName) return window.pickRandomAvailableStamp();
    const found = window.availableStampsList.find(s => s.name === fileName); return found ? found.dataUrl : window.pickRandomAvailableStamp();
};

window.unlockAdminWorkspace = async function(user) {
    const emailLower = user.email.trim().toLowerCase();
    const isSuper = window.isSuperAdminEmail ? window.isSuperAdminEmail(emailLower) : (emailLower === ADMIN_EMAIL.toLowerCase() || emailLower === 'ovi@print.com');
    const isSub = window.isSubAdminEmail ? window.isSubAdminEmail(emailLower) : (emailLower === 'prince@gmail.com' || emailLower === 'prince@print.com');

    window.currentUserData = {
        uid: user.uid,
        email: user.email,
        isAdmin: true,
        isSuperAdmin: isSuper,
        isSubAdmin: isSub
    };
    sessionStorage.setItem('ojas_separate_admin_verified', 'true');

    const headerTitleEl = document.getElementById('adminHeaderRoleTitle');
    const tabCreateUser = document.getElementById('tab-create_user');
    const secCreateUser = document.getElementById('section-create_user');
    const btnDeleteUser = document.getElementById('btnDeleteUserAccount');
    const boxManualCredit = document.getElementById('manualCreditAdjustBox');
    const navBar = document.getElementById('adminNavTabsBar');

    if (isSub && !isSuper) {
        if (headerTitleEl) headerTitleEl.innerHTML = `Sub-Admin <span class="text-royal-400">Prince</span>`;
        if (tabCreateUser) tabCreateUser.style.display = 'none';
        if (secCreateUser) secCreateUser.style.display = 'none';
        if (btnDeleteUser) btnDeleteUser.style.display = 'none';
        if (boxManualCredit) boxManualCredit.style.display = 'none';
        if (navBar) navBar.className = "grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-2xl shadow-card border border-slate-200/80 sticky top-[52px] md:top-[68px] z-30";
    } else {
        if (headerTitleEl) headerTitleEl.innerHTML = `Admin <span class="text-royal-400">Harish Kumar</span>`;
        if (tabCreateUser) tabCreateUser.style.display = 'flex';
        if (btnDeleteUser) btnDeleteUser.style.display = 'flex';
        if (boxManualCredit) boxManualCredit.style.display = 'block';
    }

    const loadingEl = document.getElementById('loadingScreen');
    if (loadingEl) loadingEl.classList.add('hidden');
    const panelEl = document.getElementById('adminPanelContent');
    if (panelEl) panelEl.classList.remove('hidden');

    if (window.history && window.history.replaceState) {
        try { window.history.replaceState(null, document.title, '/ovi'); } catch(e){}
    }
    await window.preloadAllHtmlTemplates();
    await window.preloadAutoMStamp();
    await window.preloadAllAvailableStamps(); 
    await window.loadAllUsersForDropdown(); 
    await window.loadPortalSettingsForAdmin();
    window.startLiveSupportListener(); 
    let savedTab = sessionStorage.getItem('ojas_admin_active_tab') || 'payments';
    if (isSub && savedTab === 'create_user') savedTab = 'payments';
    window.switchAdminMainTab(savedTab);
};

// STRICT SINGLE-LOGIN GUARD: No separate login on /ovi. Redirects unauthorized users to /portal.
onAuthStateChanged(auth, async (user) => {
    const isPortalAdminVerified = sessionStorage.getItem('ojas_separate_admin_verified') === 'true';
    const emailLower = user?.email ? user.email.trim().toLowerCase() : '';
    const isAllowedAdmin = window.isAnyAdminEmail
        ? window.isAnyAdminEmail(emailLower)
        : (emailLower === ADMIN_EMAIL.toLowerCase() || emailLower === 'ovi@print.com' || emailLower === 'prince@gmail.com' || emailLower === 'prince@print.com');

    if (user && isAllowedAdmin && isPortalAdminVerified) {
        await window.unlockAdminWorkspace(user);
    } else {
        sessionStorage.removeItem('ojas_separate_admin_verified');
        window.location.replace('/portal');
    }
});

window.handleLogout = async function() {
    sessionStorage.removeItem("ojas_separate_admin_verified");
    sessionStorage.removeItem("ojas_portal_access");
    await signOut(auth);
    window.location.replace("/portal");
};

window.copyUtrText = function(utr, btnEl) { navigator.clipboard.writeText(utr); const orig = btnEl.innerHTML; btnEl.innerHTML = '<i class="fa-solid fa-check text-green-600"></i> Copied'; setTimeout(() => { btnEl.innerHTML = orig; }, 1500); };
window.getPortalLoginUrl = function() { return window.location.origin + '/portal'; };
window.formatCleanPhone = function(rawPhone = '') { let digits = String(rawPhone).replace(/\D/g, ''); if (digits.length === 10) digits = '91' + digits; return digits; };

window.buildUserCredentialsText = function(email, pass, credits) {
    return `🌟 Ojas Print Service - Login Details 🌟\n\n👤 User ID: ${email}\n🔑 Password: ${pass || 'Not Set'}\n💰 Credits Balance: ${(credits || 0)} Cr\n✨ Status: Active Portal Account (All Services Enabled)\n\n🌐 Login Portal Link:\n${window.getPortalLoginUrl()}`;
};

window.shareSelectedUserCredentials = async function(channel) {
    const uid = document.getElementById('userSelectDropdown').value; if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से यूज़र सेलेक्ट करें!');
    const uData = window.usersDataList[uid]; const phoneInput = document.getElementById('selectedUserPhoneInput')?.value.trim() || '';
    if (phoneInput && phoneInput !== uData.userPhone) { try { await updateDoc(doc(db, "users", uid), { userPhone: phoneInput }); uData.userPhone = phoneInput; } catch (e) {} }
    const passToUse = uData.userPass || '[कृपया पहले नया पासवर्ड सेट करें]';
    const messageText = window.buildUserCredentialsText(uData.email, passToUse, uData.credits, uData.isVip, uData.vipExpiry);

    if (channel === 'copy') { navigator.clipboard.writeText(messageText); alert('यूज़र की ID और Password डिटेल्स कॉपी हो गई हैं!'); return; }
    if (channel === 'whatsapp') {
        let targetPhone = window.formatCleanPhone(phoneInput || uData.userPhone || '');
        if (!targetPhone) {
            const askPhone = prompt("यूज़र का 10 अंकों का WhatsApp नंबर डालें (या बिना नंबर सीधे WhatsApp खोलने के लिए खाली छोड़कर OK दबाएं):", "");
            if (askPhone === null) return;
            if (askPhone.trim()) {
                targetPhone = window.formatCleanPhone(askPhone.trim());
                try { await updateDoc(doc(db, "users", uid), { userPhone: askPhone.trim() }); uData.userPhone = askPhone.trim(); if (document.getElementById('selectedUserPhoneInput')) { document.getElementById('selectedUserPhoneInput').value = askPhone.trim(); } } catch (e) {}
            }
        }
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`; window.open(waUrl, '_blank');
    } else if (channel === 'email') {
        const targetEmail = uData.contactEmail || (uData.email.endsWith('@print.com') ? prompt("यूज़र का असली Email एड्रेस डालें:", "") : uData.email);
        if (!targetEmail) return; window.open(`mailto:${targetEmail}?subject=${encodeURIComponent("Ojas Print Service - Your Login ID & Password")}&body=${encodeURIComponent(messageText)}`, '_self');
    }
};

window.saveSelectedUserPhone = async function() {
    const uid = document.getElementById('userSelectDropdown').value; if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले यूज़र सेलेक्ट करें!');
    const phoneVal = document.getElementById('selectedUserPhoneInput').value.trim();
    try { await updateDoc(doc(db, "users", uid), { userPhone: phoneVal }); window.usersDataList[uid].userPhone = phoneVal; alert('यूज़र का WhatsApp नंबर सेव हो गया!'); } catch (err) { alert('Error: ' + err.message); }
};

window.toggleUserAccess = async function(field, allowed) {
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से यूज़र सेलेक्ट करें!');
    const uData = window.usersDataList[uid];
    const msg = document.getElementById('adminMsg');
    try {
        const updateObj = {}; 
        updateObj[field] = allowed;
        await updateDoc(doc(db, "users", uid), updateObj); 
        window.usersDataList[uid][field] = allowed;
        
        let serviceName = field.replace('allow', '');
        msg.className = "p-3.5 bg-amber-50 text-amber-950 rounded-2xl text-xs font-black border border-amber-300 text-center shadow-sm";
        msg.innerHTML = `<i class="fa-solid ${allowed ? 'fa-eye text-green-600' : 'fa-eye-slash text-red-600'} mr-1"></i> <strong>${uData.email}</strong> के लिए ${serviceName} सेक्शन <strong>${allowed ? 'चालू (Visible)' : 'गायब (Hidden)'}</strong> कर दिया गया है!`;
        msg.classList.remove('hidden'); 
        setTimeout(() => msg.classList.add('hidden'), 3500);
    } catch (err) { alert('Error: ' + err.message); }
};

window.deleteSelectedUserAccount = async function() {
    if (window.currentUserData?.isSubAdmin) return alert('यूज़र अकाउंट डिलीट करने का अधिकार केवल Super Admin के पास है!');
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से उस यूज़र को सेलेक्ट करें जिसे आप डिलीट करना चाहते हैं!');
    const uData = window.usersDataList[uid];
    if ((uData.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) return alert('आप मुख्य सुपर एडमिन अकाउंट को डिलीट नहीं कर सकते!');
    if (!confirm(`⚠️ चेतावनी!\n\nक्या आप वाकई यूज़र "${uData.email}" का अकाउंट हमेशा के लिए डिलीट करना चाहते हैं?`)) return;
    const btn = document.getElementById('btnDeleteUserAccount'); const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Deleting User...'; }

    try {
        if (uData.userPass) {
            try {
                const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: uData.email, password: uData.userPass, returnSecureToken: true }) });
                const signInData = await signInRes.json();
                if (signInData.idToken) { await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: signInData.idToken }) }); }
            } catch (e) {}
        }
        await deleteDoc(doc(db, "users", uid)); try { await deleteDoc(doc(db, "supportTickets", uid)); } catch (e) {}
        delete window.usersDataList[uid]; await window.loadAllUsersForDropdown(); document.getElementById('userSelectDropdown').value = ''; window.handleUserSelection();
        const msg = document.getElementById('adminMsg');
        if (msg) { msg.className = "p-3.5 bg-red-50 text-red-800 rounded-2xl text-xs font-black border border-red-300 text-center shadow-sm"; msg.innerHTML = `<i class="fa-solid fa-trash-can mr-1"></i> यूज़र <strong>${uData.email}</strong> का अकाउंट हमेशा के लिए डिलीट कर दिया गया है!`; msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 4000); }
    } catch (err) { alert('Error: ' + err.message); } finally { if (btn) { btn.disabled = false; btn.innerHTML = origHtml; } }
};

window.findUserUidByIdentifier = function(identifier = '') { const clean = String(identifier).trim().toLowerCase(); if (!clean) return ''; for (const [uid, uData] of Object.entries(window.usersDataList)) { const emailLower = (uData.email || '').toLowerCase(); const unameLower = (uData.username || emailLower.split('@')[0]).toLowerCase(); if (emailLower === clean || unameLower === clean || `${clean}@print.com` === emailLower) { return uid; } } return ''; };
window.getTicketMessagesArray = function(ticket) { let arr = Array.isArray(ticket.messages) ? [...ticket.messages] : []; if (arr.length === 0 && ticket.message) { const sec = ticket.timestamp?.seconds || Math.floor(Date.now() / 1000); arr.push({ sender: 'user', text: ticket.message, time: sec * 1000 }); } return arr; };

window.startLiveSupportListener = function() {
    if (window.supportUnsubscribe) window.supportUnsubscribe();
    window.supportUnsubscribe = onSnapshot(collection(db, "supportTickets"), (snap) => {
        window.allSupportTickets = []; snap.forEach(docSnap => { window.allSupportTickets.push({ id: docSnap.id, ...docSnap.data() }); });
        window.allSupportTickets.sort((a, b) => { const timeA = a.updatedAtMs || (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0); const timeB = b.updatedAtMs || (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0); return timeB - timeA; });
        window.updateSupportNavBadge(); window.renderSupportChatSidebar();
        if (window.selectedChatTicketId) { window.renderActiveChatConversation(window.selectedChatTicketId, false); }
    });
};

window.updateSupportNavBadge = function() { let unreadCount = 0; window.allSupportTickets.forEach(t => { if (t.unreadByAdmin === true || (t.unreadByAdmin === undefined && (t.status || 'Open') === 'Open')) unreadCount++; }); const badge = document.getElementById('navSupportBadge'); if (badge) { badge.innerText = unreadCount; badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none'; } };

window.renderSupportChatSidebar = function() {
    const listEl = document.getElementById('supportChatThreadsList'); if (!listEl) return;
    const searchVal = (document.getElementById('supportSearchInput')?.value || '').trim().toLowerCase();
    const filtered = window.allSupportTickets.filter(t => { if (!searchVal) return true; return (t.userIdentifier || '').toLowerCase().includes(searchVal) || (t.userPhone || '').toLowerCase().includes(searchVal); });

    if (filtered.length === 0) { listEl.innerHTML = `<div class="p-8 text-center text-slate-400 font-bold text-xs"><i class="fa-regular fa-comments text-3xl mb-2 text-slate-300"></i><br>अभी कोई यूज़र चैट या टिकट नहीं है।</div>`; return; }
    listEl.innerHTML = '';
    filtered.forEach(t => {
        const msgs = window.getTicketMessagesArray(t); const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : { text: t.message || 'No message', sender: 'user' };
        const isSelected = window.selectedChatTicketId === t.id; const isUnread = t.unreadByAdmin === true || (t.unreadByAdmin === undefined && (t.status || 'Open') === 'Open'); const isForgot = t.type === 'FORGOT_PASSWORD';
        const timeMs = t.updatedAtMs || (t.timestamp?.seconds ? t.timestamp.seconds * 1000 : Date.now()); const timeStr = new Date(timeMs).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const activeClass = isSelected ? 'bg-royal-50 border-royal-400 shadow-sm' : (isUnread ? 'bg-red-50/60 border-red-200 hover:bg-slate-50' : 'bg-white border-slate-200 hover:bg-slate-50');

        listEl.innerHTML += `
            <div onclick="window.selectSupportChatThread('${t.id}')" class="p-3 rounded-2xl border-2 ${activeClass} cursor-pointer transition space-y-1">
                <div class="flex items-center justify-between gap-1">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        ${isUnread ? `<span class="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0 animate-pulse">NEW</span>` : ''}
                        ${isForgot ? `<span class="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0"><i class="fa-solid fa-key mr-0.5"></i>Pass</span>` : `<i class="fa-solid fa-circle-user text-royal-600 text-xs shrink-0"></i>`}
                        <span class="text-xs font-black text-dark-900 truncate">${t.userIdentifier || 'User'}</span>
                    </div>
                    <span class="text-[10px] font-semibold text-slate-400 shrink-0">${timeStr}</span>
                </div>
                <p class="text-[11px] font-semibold ${isUnread ? 'text-slate-900 font-bold' : 'text-slate-500'} truncate">${lastMsg.sender === 'admin' ? '<span class="text-indigo-600 font-black">You: </span>' : ''}${lastMsg.text}</p>
            </div>
        `;
    });
};

window.selectSupportChatThread = async function(ticketId) {
    window.selectedChatTicketId = ticketId; window.renderSupportChatSidebar(); window.renderActiveChatConversation(ticketId, true);
    const ticket = window.allSupportTickets.find(t => t.id === ticketId);
    if (ticket && (ticket.unreadByAdmin === true || ticket.unreadByAdmin === undefined)) { try { await updateDoc(doc(db, "supportTickets", ticketId), { unreadByAdmin: false }); } catch (e) {} }
};

window.renderActiveChatConversation = function(ticketId, scrollToBottom = true) {
    const emptyState = document.getElementById('chatWindowEmptyState'); const activeBox = document.getElementById('chatWindowActiveBox');
    const ticket = window.allSupportTickets.find(t => t.id === ticketId);
    if (!ticket) { if (emptyState) emptyState.classList.remove('hidden'); if (activeBox) activeBox.classList.add('hidden'); return; }

    if (emptyState) emptyState.classList.add('hidden'); if (activeBox) activeBox.classList.remove('hidden');
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier); const matchedUser = matchedUid ? window.usersDataList[matchedUid] : null;

    document.getElementById('chatHeaderUserTitle').innerText = ticket.userIdentifier || 'Unknown User';
    document.getElementById('chatHeaderUserPhone').innerText = (ticket.userPhone || matchedUser?.userPhone) ? `📱 WhatsApp: ${ticket.userPhone || matchedUser?.userPhone}` : 'No phone number saved';

    const passBadge = document.getElementById('chatHeaderSavedPassBadge');
    if (matchedUser) { passBadge.innerHTML = `Pass: <strong class="text-royal-300 font-mono">${matchedUser.userPass || 'Not Synced'}</strong> • Cr: <strong class="text-emerald-400">${matchedUser.credits || 0}</strong>`; } else { passBadge.innerHTML = `<span class="text-amber-300">Guest Ticket</span>`; }

    const msgContainer = document.getElementById('chatMessagesScrollBox');
    const msgs = window.getTicketMessagesArray(ticket); msgContainer.innerHTML = '';
    msgs.forEach(m => {
        const isAdmin = m.sender === 'admin'; const tStr = m.time ? new Date(m.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        const safeText = String(m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        if (isAdmin) {
            msgContainer.innerHTML += `<div class="flex flex-col items-end"><div class="max-w-[80%] bg-dark-900 text-white px-4 py-2.5 rounded-2xl rounded-br-none shadow-sm border border-royal-500/40"><span class="text-[9px] font-black text-royal-400 uppercase block mb-0.5"><i class="fa-solid fa-crown mr-1"></i>Admin Support</span><div class="text-xs font-semibold leading-relaxed">${safeText}</div></div><span class="text-[9px] font-bold text-slate-400 mt-0.5">${tStr}</span></div>`;
        } else {
            msgContainer.innerHTML += `<div class="flex flex-col items-start"><div class="max-w-[80%] bg-white text-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-none shadow-sm border border-slate-200"><span class="text-[9px] font-black text-indigo-600 uppercase block mb-0.5"><i class="fa-solid fa-user mr-1"></i>${ticket.userIdentifier || 'User'}</span><div class="text-xs font-bold leading-relaxed">${safeText}</div></div><span class="text-[9px] font-bold text-slate-400 mt-0.5">${tStr}</span></div>`;
        }
    });
    if (scrollToBottom) { setTimeout(() => { msgContainer.scrollTop = msgContainer.scrollHeight; }, 50); }
};

window.sendAdminChatReply = async function(event) {
    if (event) event.preventDefault(); const ticketId = window.selectedChatTicketId; if (!ticketId) return alert('कृपया पहले बाईं तरफ से किसी यूज़र की चैट पर क्लिक करें!');
    const inp = document.getElementById('adminChatReplyInput'); const replyText = inp.value.trim(); if (!replyText) return;
    const btn = document.getElementById('btnSendAdminChatReply'); const origHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const ticket = window.allSupportTickets.find(t => t.id === ticketId);
        const existingMsgs = window.getTicketMessagesArray(ticket); const newMsgObj = { sender: 'admin', text: replyText, time: Date.now() }; existingMsgs.push(newMsgObj);
        await updateDoc(doc(db, "supportTickets", ticketId), { messages: existingMsgs, lastAdminReply: replyText, status: 'Replied', unreadByAdmin: false, unreadByUser: true, updatedAtMs: Date.now() });

        const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier);
        if (matchedUid && matchedUid !== ticketId) {
            try {
                const userChatRef = doc(db, "supportTickets", matchedUid); const userChatSnap = await getDoc(userChatRef);
                let uMsgs = userChatSnap.exists() && Array.isArray(userChatSnap.data().messages) ? [...userChatSnap.data().messages] : []; uMsgs.push(newMsgObj);
                await setDoc(userChatRef, { userId: matchedUid, userIdentifier: window.usersDataList[matchedUid]?.email || ticket.userIdentifier, messages: uMsgs, lastAdminReply: replyText, status: 'Replied', unreadByAdmin: false, unreadByUser: true, updatedAtMs: Date.now() }, { merge: true });
            } catch (e) {}
        }
        inp.value = ''; window.renderActiveChatConversation(ticketId, true);
    } catch (err) { alert('रिप्लाई भेजने में समस्या आई: ' + err.message); } finally { btn.disabled = false; btn.innerHTML = origHtml; }
};

window.insertQuickChatReply = function(type) {
    const ticket = window.allSupportTickets.find(t => t.id === window.selectedChatTicketId); if (!ticket) return alert('कृपया पहले किसी यूज़र की चैट चुनें!');
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier); const u = matchedUid ? window.usersDataList[matchedUid] : null; const inp = document.getElementById('adminChatReplyInput');
    const shortId = u ? u.email : (ticket.userIdentifier || 'User'); const pass = u ? (u.userPass || '[PASS]') : '[PASS]'; const cr = u ? (u.credits || 0) : 0;

    if (type === 'id_pass') { inp.value = `नमस्ते, आपकी लॉगिन डिटेल्स नीचे दी गई हैं:\nUser ID: ${shortId}\nPassword: ${pass}\nCredits: ${cr} Cr`; } 
    else if (type === 'payment_ok') { inp.value = `नमस्ते ${shortId}, आपका पेमेंट वेरीफाई हो गया है और क्रेडिट्स/VIP आपके अकाउंट में जोड़ दिए गए हैं। पेमेंट स्टेटस रिफ्रेश कर लें।`; } 
    else if (type === 'fixed') { inp.value = `नमस्ते ${shortId}, आपकी समस्या का समाधान कर दिया गया है। कृपया अब पोर्टल चेक करें।`; }
    inp.focus();
};

window.resetPassAndSendInChat = async function() {
    const ticket = window.allSupportTickets.find(t => t.id === window.selectedChatTicketId); if (!ticket) return alert('कृपया पहले किसी यूज़र की चैट चुनें!');
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier); if (!matchedUid || !window.usersDataList[matchedUid]) { return alert(`इस यूज़र (${ticket.userIdentifier}) का अकाउंट Users लिस्ट में नहीं मिला।`); }
    const newPass = document.getElementById('chatQuickNewPassInput').value.trim(); if (!newPass || newPass.length < 6) return alert('नया पासवर्ड कम से कम 6 अक्षरों का लिखें!');
    const btn = document.getElementById('btnChatQuickResetPass'); const origHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const uData = window.usersDataList[matchedUid];

    try {
        if (uData.userPass) {
            try { const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: uData.email, password: uData.userPass, returnSecureToken: true }) }); const signInData = await signInRes.json(); if (signInData.idToken) { await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: signInData.idToken, password: newPass, returnSecureToken: true }) }); } } catch (e) {}
        }
        const updateUserPayload = { userPass: newPass, adminResetPass: newPass, passUpdatedAt: new Date() };
        if (ticket.userPhone && !uData.userPhone) { updateUserPayload.userPhone = ticket.userPhone; window.usersDataList[matchedUid].userPhone = ticket.userPhone; }
        await updateDoc(doc(db, "users", matchedUid), updateUserPayload); window.usersDataList[matchedUid].userPass = newPass;

        const autoReplyMsg = `🔑 आपका नया पासवर्ड सेट कर दिया गया है:\nUser ID: ${uData.email}\nNew Password: ${newPass}\n\nअब आप इस नए पासवर्ड से लॉगिन कर सकते हैं।`;
        const newMsgObj = { sender: 'admin', text: autoReplyMsg, time: Date.now() }; const existingMsgs = window.getTicketMessagesArray(ticket); existingMsgs.push(newMsgObj);

        await updateDoc(doc(db, "supportTickets", ticket.id), { messages: existingMsgs, lastAdminReply: autoReplyMsg, status: 'Replied', unreadByAdmin: false, unreadByUser: true, updatedAtMs: Date.now() });

        if (matchedUid !== ticket.id) {
            try { const userChatRef = doc(db, "supportTickets", matchedUid); const userChatSnap = await getDoc(userChatRef); let uMsgs = userChatSnap.exists() && Array.isArray(userChatSnap.data().messages) ? [...userChatSnap.data().messages] : []; uMsgs.push(newMsgObj); await setDoc(userChatRef, { userId: matchedUid, userIdentifier: uData.email, messages: uMsgs, lastAdminReply: autoReplyMsg, status: 'Replied', unreadByAdmin: false, unreadByUser: true, updatedAtMs: Date.now() }, { merge: true }); } catch (e) {}
        }
        document.getElementById('chatQuickNewPassInput').value = ''; window.renderActiveChatConversation(ticket.id, true);
    } catch (err) { alert('Error: ' + err.message); } finally { btn.disabled = false; btn.innerHTML = origHtml; }
};

window.alsoOpenChatUserWhatsApp = function() {
    const ticket = window.allSupportTickets.find(t => t.id === window.selectedChatTicketId); if (!ticket) return;
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier); const matchedUser = matchedUid ? window.usersDataList[matchedUid] : null;
    const cleanPhone = window.formatCleanPhone(ticket.userPhone || matchedUser?.userPhone || ''); const msgs = window.getTicketMessagesArray(ticket);
    const lastAdmin = [...msgs].reverse().find(m => m.sender === 'admin'); const textToSend = document.getElementById('adminChatReplyInput').value.trim() || lastAdmin?.text || `नमस्ते ${ticket.userIdentifier}, Ojas Portal सपोर्ट से अपडेट:`;
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}` : `https://wa.me/?text=${encodeURIComponent(textToSend)}`; window.open(url, '_blank');
};

window.deleteCurrentSupportChat = async function() { const ticketId = window.selectedChatTicketId; if (!ticketId) return; if (!confirm('क्या आप इस पूरी चैट को डिलीट करना चाहते हैं?')) return; try { await deleteDoc(doc(db, "supportTickets", ticketId)); window.selectedChatTicketId = null; window.renderActiveChatConversation(null); } catch (err) { alert('Error: ' + err.message); } };

window.startNewChatWithSelectedUser = async function() {
    const uid = document.getElementById('newChatUserSelect').value; if (!uid || !window.usersDataList[uid]) return alert('कृपया ड्रॉपडाउन से यूज़र चुनें!');
    const u = window.usersDataList[uid]; const existing = window.allSupportTickets.find(t => t.id === uid || t.userId === uid); if (existing) { window.selectSupportChatThread(existing.id); return; }
    try { const newDocRef = doc(db, "supportTickets", uid); await setDoc(newDocRef, { type: 'ADMIN_MESSAGE', userId: uid, userIdentifier: u.email, userPhone: u.userPhone || '', message: 'Support Chat Started', messages: [{ sender: 'admin', text: `नमस्ते ${u.email.split('@')[0]}, Ojas Portal एडमिन सपोर्ट में आपका स्वागत है।`, time: Date.now() }], status: 'Replied', unreadByAdmin: false, unreadByUser: true, timestamp: new Date(), updatedAtMs: Date.now() }, { merge: true }); window.selectSupportChatThread(uid); } catch (err) { alert('Error: ' + err.message); }
};

window.populateSupportUserDropdown = function() { const sel = document.getElementById('newChatUserSelect'); if (!sel) return; sel.innerHTML = '<option value="">-- किसी यूज़र के साथ नई चैट खोलें --</option>'; for (const [uid, data] of Object.entries(window.usersDataList)) { sel.innerHTML += `<option value="${uid}">${data.email}</option>`; } };

window.loadPortalSettingsForAdmin = async function() {
    try { 
        const snap = await getDoc(doc(db, "settings", "portalConfig")); 
        let cfg = { 
            showDomicile: true, showCaste: true, showEvoter: true, showMinor: true, showDobPrint: true, showGazette: true, showDobMinor: true, 
            showDobDelhi: true, showPassport: true, showAnnexures: true,
            bannerEnabled: false, bannerBadge: "UPDATE", bannerTitle: "", bannerMessage: "", bannerBtnText: "", bannerBtnLink: "", 
            banner2Enabled: false, banner2Badge: "NOTICE", banner2Title: "", banner2Message: "", banner2BtnText: "", banner2BtnLink: "",
            supportWhatsapp: "919306437623" 
        }; 
        if (snap.exists()) { cfg = { ...cfg, ...snap.data() }; }
        
        document.getElementById('chkShowDomicile').checked = cfg.showDomicile !== false; 
        document.getElementById('chkShowCaste').checked = cfg.showCaste !== false; 
        if(document.getElementById('chkShowEvoter')) document.getElementById('chkShowEvoter').checked = cfg.showEvoter !== false;
        if(document.getElementById('chkShowMinor')) document.getElementById('chkShowMinor').checked = cfg.showMinor !== false; 
        const dobMinorEl = document.getElementById('chkShowDobMinor'); if(dobMinorEl) dobMinorEl.checked = cfg.showDobMinor !== false;
        const dobPrEl = document.getElementById('chkShowDobPrint'); if(dobPrEl) dobPrEl.checked = cfg.showDobPrint !== false;
        const passEl = document.getElementById('chkShowPassport'); if(passEl) passEl.checked = cfg.showPassport !== false;
        const gazEl = document.getElementById('chkShowGazette'); if(gazEl) gazEl.checked = cfg.showGazette !== false;
        const annexEl = document.getElementById('chkShowAnnexures'); if(annexEl) annexEl.checked = cfg.showAnnexures !== false;
        
        document.getElementById('chkBannerEnabled').checked = !!cfg.bannerEnabled; 
        document.getElementById('inpBannerBadge').value = cfg.bannerBadge || 'UPDATE'; 
        document.getElementById('inpBannerTitle').value = cfg.bannerTitle || ''; 
        document.getElementById('inpBannerMessage').value = cfg.bannerMessage || ''; 
        document.getElementById('inpBannerBtnText').value = cfg.bannerBtnText || ''; 
        document.getElementById('inpBannerBtnLink').value = cfg.bannerBtnLink || ''; 
        
        const b2Chk = document.getElementById('chkBanner2Enabled'); if(b2Chk) b2Chk.checked = !!cfg.banner2Enabled;
        const b2Bdg = document.getElementById('inpBanner2Badge'); if(b2Bdg) b2Bdg.value = cfg.banner2Badge || 'NOTICE';
        const b2Ttl = document.getElementById('inpBanner2Title'); if(b2Ttl) b2Ttl.value = cfg.banner2Title || '';
        const b2Msg = document.getElementById('inpBanner2Message'); if(b2Msg) b2Msg.value = cfg.banner2Message || '';
        const b2Btn = document.getElementById('inpBanner2BtnText'); if(b2Btn) b2Btn.value = cfg.banner2BtnText || '';
        const b2Lnk = document.getElementById('inpBanner2BtnLink'); if(b2Lnk) b2Lnk.value = cfg.banner2BtnLink || '';

        const supWaEl = document.getElementById('inpSupportWhatsapp'); 
        if (supWaEl) supWaEl.value = cfg.supportWhatsapp || '919306437623'; 
        window.adminSupportWhatsapp = cfg.supportWhatsapp || '919306437623'; 
        window.updateStealthStatusPill(); if (typeof window.loadDobPrintSecretApiConfig === 'function') window.loadDobPrintSecretApiConfig();
    } catch (err) {}
};

window.updateStealthStatusPill = function() {
    const d = document.getElementById('chkShowDomicile')?.checked; const c = document.getElementById('chkShowCaste')?.checked; const b = document.getElementById('chkShowEvoter')?.checked; const m = document.getElementById('chkShowDobMinor')?.checked; const pill = document.getElementById('stealthStatusBadge'); if (!pill) return;
    if (!d && !c && !b && !m) { pill.className = "bg-red-100 text-red-700 border border-red-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase"; pill.innerHTML = `<i class="fa-solid fa-eye-slash mr-1"></i>Stealth Active`; } else if (d && c && b && m) { pill.className = "bg-green-100 text-green-800 border border-green-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase"; pill.innerHTML = `<i class="fa-solid fa-eye mr-1"></i>All Visible`; } else { pill.className = "bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase"; pill.innerHTML = `<i class="fa-solid fa-sliders mr-1"></i>Custom Mode`; }
};

window.quickToggleAllCerts = async function(makeVisible) { document.getElementById('chkShowDomicile').checked = makeVisible; document.getElementById('chkShowCaste').checked = makeVisible; if(document.getElementById('chkShowEvoter')) document.getElementById('chkShowEvoter').checked = makeVisible;
    if(document.getElementById('chkShowMinor')) document.getElementById('chkShowMinor').checked = makeVisible;
    if(document.getElementById('chkShowDobPrint')) document.getElementById('chkShowDobPrint').checked = makeVisible;
    if(document.getElementById('chkShowGazette')) document.getElementById('chkShowGazette').checked = makeVisible; const dobMinorEl = document.getElementById('chkShowDobMinor'); if(dobMinorEl) dobMinorEl.checked = makeVisible; await window.savePortalSettings(); };

window.savePortalSettings = async function(event) {
    if (event) event.preventDefault(); 
    const btn = document.getElementById('btnSavePortalConfig'); 
    const msg = document.getElementById('portalConfigMsg'); 
    const origText = btn ? btn.innerHTML : ''; 
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...'; }
    
    const rawSupWa = document.getElementById('inpSupportWhatsapp')?.value.trim() || '919306437623'; 
    const cleanSupWa = window.formatCleanPhone(rawSupWa) || '919306437623';
    
    const payload = { 
        showDomicile: document.getElementById('chkShowDomicile').checked, 
        showCaste: document.getElementById('chkShowCaste').checked, 
        showEvoter: document.getElementById('chkShowEvoter') ? document.getElementById('chkShowEvoter').checked : true,
        showMinor: document.getElementById('chkShowMinor') ? document.getElementById('chkShowMinor').checked : true, 
        showDobMinor: document.getElementById('chkShowDobMinor') ? document.getElementById('chkShowDobMinor').checked : true, 
        showDobDelhi: document.getElementById('chkShowDobMinor') ? document.getElementById('chkShowDobMinor').checked : true,
        showDobPrint: document.getElementById('chkShowDobPrint') ? document.getElementById('chkShowDobPrint').checked : true,
        showPassport: document.getElementById('chkShowPassport') ? document.getElementById('chkShowPassport').checked : true,
        showGazette: document.getElementById('chkShowGazette') ? document.getElementById('chkShowGazette').checked : true,
        showAnnexures: document.getElementById('chkShowAnnexures') ? document.getElementById('chkShowAnnexures').checked : true,
        
        bannerEnabled: document.getElementById('chkBannerEnabled').checked, 
        bannerBadge: document.getElementById('inpBannerBadge').value.trim() || 'UPDATE', 
        bannerTitle: document.getElementById('inpBannerTitle').value.trim(), 
        bannerMessage: document.getElementById('inpBannerMessage').value.trim(), 
        bannerBtnText: document.getElementById('inpBannerBtnText').value.trim(), 
        bannerBtnLink: document.getElementById('inpBannerBtnLink').value.trim(),
        
        banner2Enabled: document.getElementById('chkBanner2Enabled') ? document.getElementById('chkBanner2Enabled').checked : false,
        banner2Badge: document.getElementById('inpBanner2Badge') ? document.getElementById('inpBanner2Badge').value.trim() || 'NOTICE' : 'NOTICE',
        banner2Title: document.getElementById('inpBanner2Title') ? document.getElementById('inpBanner2Title').value.trim() : '',
        banner2Message: document.getElementById('inpBanner2Message') ? document.getElementById('inpBanner2Message').value.trim() : '',
        banner2BtnText: document.getElementById('inpBanner2BtnText') ? document.getElementById('inpBanner2BtnText').value.trim() : '',
        banner2BtnLink: document.getElementById('inpBanner2BtnLink') ? document.getElementById('inpBanner2BtnLink').value.trim() : '',

        supportWhatsapp: cleanSupWa, 
        updatedAt: new Date() 
    };
    try { 
        await setDoc(doc(db, "settings", "portalConfig"), payload, { merge: true }); 
        window.adminSupportWhatsapp = cleanSupWa; 
        window.updateStealthStatusPill(); if (typeof window.loadDobPrintSecretApiConfig === 'function') window.loadDobPrintSecretApiConfig(); 
        if (msg) { 
            msg.className = "p-3 bg-green-50 text-green-800 border border-green-300 rounded-xl text-xs font-black text-center"; 
            msg.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> पोर्टल सेटिंग्स और दोनों बैनर सफलतापूर्वक अपडेट हो गए हैं!`; 
            msg.classList.remove('hidden'); 
            setTimeout(() => msg.classList.add('hidden'), 4000); 
        } 
    } catch (err) { 
        alert("Error saving portal settings: " + err.message); 
    } finally { 
        if (btn) { btn.disabled = false; btn.innerHTML = origText; } 
    }
};

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
                try {
                    updateDoc(doc(db, "payments", item.id), { status: 'Cancelled (Expired 72h)', expiredAt: new Date() });
                } catch(e) {}
            }
            window.allPaymentsData.push(item); 
        }); 
        window.allPaymentsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); window.updatePaymentStatsAndBadges(); window.renderPaymentsByFilter(); } catch (err) { if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">Error: ${err.message}</td></tr>`; }
};

window.updatePaymentStatsAndBadges = function() {
    let pendingCount = 0, pendingAmt = 0, approvedCount = 0, approvedAmt = 0, rejectedCount = 0, rejectedAmt = 0;
    window.allPaymentsData.forEach(item => { const amt = parseFloat(item.amountPaid) || 0; const st = (item.status || 'Pending'); if (st === 'Pending' || st.includes('Ticket')) { pendingCount++; pendingAmt += amt; } else if (st === 'Approved' || st === 'Auto-Approved' || st === 'Gift / Bonus') { approvedCount++; approvedAmt += amt; } else if (st === 'Rejected' || st === 'Cancelled') { rejectedCount++; rejectedAmt += amt; } });
    document.getElementById('statPendingCount').innerText = `${pendingCount} Requests`; document.getElementById('statPendingAmt').innerText = `₹${pendingAmt}`; document.getElementById('statApprovedCount').innerText = `${approvedCount} Txns`; document.getElementById('statApprovedAmt').innerText = `₹${approvedAmt}`; document.getElementById('statRejectedCount').innerText = `${rejectedCount} Txns`; document.getElementById('statRejectedAmt').innerText = `₹${rejectedAmt}`; document.getElementById('pillCountPending').innerText = pendingCount; document.getElementById('pillCountApproved').innerText = approvedCount; document.getElementById('pillCountRejected').innerText = rejectedCount; document.getElementById('pillCountAll').innerText = window.allPaymentsData.length;
    const navBadge = document.getElementById('navPendingBadge'); if (navBadge) { navBadge.innerText = pendingCount; navBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none'; }
};

window.setPaymentFilter = function(filterStatus) {
    window.currentPaymentFilter = filterStatus; const filters = ['Pending', 'Approved', 'Rejected', 'ALL'];
    filters.forEach(f => { const btn = document.getElementById(`filterPill-${f}`); if (!btn) return; if (f === filterStatus) { btn.className = "px-3 py-2.5 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shadow-sm transition flex items-center justify-center gap-1.5 border border-royal-500/40"; } else { btn.className = "px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center gap-1.5 border border-slate-200"; } });
    window.renderPaymentsByFilter();
};

window.renderPaymentsByFilter = function() {
    const tableBody = document.getElementById('adminPaymentsTableBody');
    const searchQuery = (document.getElementById('paymentSearchInput')?.value || '').trim().toLowerCase();
    const activeFilter = window.currentPaymentFilter;

    let list = window.allPaymentsData.filter(item => {
        const st = (item.status || 'Pending');
        if (activeFilter === 'Pending' && st !== 'Pending' && !st.includes('Ticket')) return false;
        if (activeFilter === 'Approved' && st !== 'Approved' && st !== 'Auto-Approved' && st !== 'Gift / Bonus') return false;
        if (activeFilter === 'Rejected' && st !== 'Rejected' && st !== 'Cancelled') return false;
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
        const dateStr = dateObj.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
        const timeStr = dateObj.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
        const vipDays = data.vipDaysRequested || (data.wantsVip ? 30 : 0);
        const creditsReq = data.creditsRequested !== undefined ? data.creditsRequested : (data.creditsAdded || 0);
        const status = data.status || 'Pending';
        const isGift = status === 'Gift / Bonus';

        let statusBadge = '';
        if (isGift) {
            statusBadge = `<span class="bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-gift mr-1"></i>Gift / Bonus</span>`;
        } else if (status.includes('Ticket')) {
            statusBadge = `<span class="bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse"><i class="fa-solid fa-ticket mr-1"></i>Ticket Raised</span>`;
        } else if (status === 'Pending') {
            statusBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse"><i class="fa-solid fa-clock mr-1"></i>Pending</span>`;
        } else if (status === 'Approved' || status === 'Auto-Approved') {
            statusBadge = `<span class="bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-check-circle mr-1"></i>Approved</span>`;
        } else if (status === 'Cancelled') {
            statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-ban mr-1"></i>Cancelled</span>`;
        } else {
            statusBadge = `<span class="bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-circle-xmark mr-1"></i>Rejected</span>`;
        }

        let actionHtml = '';
        if (status === 'Pending' || status.includes('Ticket')) {
            actionHtml = `
                <div class="flex items-center justify-end gap-1.5">
                    <button onclick="window.approvePayment('${data.id}', '${data.userId}', ${creditsReq}, ${vipDays}, false)" class="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1"><i class="fa-solid fa-check"></i> Approve</button>
                    <button onclick="window.rejectPayment('${data.id}')" class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 px-2 py-1.5 rounded-lg text-xs font-bold transition" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
        } else if (status === 'Rejected' || status === 'Cancelled') {
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

        const amtDisplay = isGift 
            ? `<span class="bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded text-xs border border-purple-200">🎁 FREE (₹0)</span>` 
            : `<span class="font-black text-dark-900 text-sm">₹${data.amountPaid || 0}</span>`;

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
                <td class="p-3 whitespace-nowrap">
                    ${amtDisplay}
                </td>
                <td class="p-3">
                    <div class="flex flex-col gap-0.5">
                        ${creditsReq > 0 ? `<span class="font-black text-royal-600">+${creditsReq} Cr</span>` : ''}
                        ${vipDays > 0 ? `<span class="bg-amber-400 text-dark-950 px-1.5 py-0.2 rounded text-[9px] font-black inline-block w-max">👑 +${vipDays}d VIP</span>` : ''}
                        ${data.note ? `<span class="text-[10px] text-purple-700 font-black flex items-center gap-1"><i class="fa-solid fa-gift text-purple-500"></i> ${data.note}</span>` : ''}
                    </div>
                </td>
                <td class="p-3 whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                        <span class="font-mono font-bold text-slate-700 text-[11px]">${data.utrNumber || 'ONLINE_UPI'}</span>
                        ${data.utrNumber ? `<button onclick="window.copyUtrText('${data.utrNumber}', this)" class="text-slate-400 hover:text-slate-700 p-1" title="Copy UTR"><i class="fa-regular fa-copy text-xs"></i></button>` : ''}
                    </div>
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="p-3 text-right whitespace-nowrap">
                    ${actionHtml}
                </td>
            </tr>`;
    });
};

window.approvePayment = async function(paymentDocId, userId, creditsToAdd, vipDaysToAdd, isResolution = false) {
    const titleText = isResolution ? `Resolve & Approve Payment:` : `Approve Payment:`;
    const confirmMsg = vipDaysToAdd > 0 ? `${titleText}\n• Add +${creditsToAdd} Credits\n• Add +${vipDaysToAdd} Days VIP Access\n\nक्या आप कन्फर्म हैं?` : `${titleText}\n• Add +${creditsToAdd} Credits to this user?\n\nक्या आप कन्फर्म हैं?`;
    if (!confirm(confirmMsg)) return;

    try {
        const userRef = doc(db, "users", userId); const userSnap = await getDoc(userRef); let currentCredits = 0, currentExpiry = 0;
        if (userSnap.exists()) { const uData = userSnap.data(); currentCredits = uData.credits || 0; currentExpiry = uData.vipExpiry || 0; }
        const newCredits = currentCredits + creditsToAdd; const updatePayload = { credits: newCredits };
        if (vipDaysToAdd > 0) { const now = Date.now(); const baseTime = (currentExpiry > now) ? currentExpiry : now; updatePayload.isVip = true; updatePayload.vipExpiry = baseTime + (vipDaysToAdd * MS_PER_DAY); }
        await updateDoc(userRef, updatePayload); await updateDoc(doc(db, "payments", paymentDocId), { status: "Approved", resolvedAt: new Date() });
        alert(vipDaysToAdd > 0 ? `सफलतापूर्वक अप्रूव हो गया! +${creditsToAdd} Credits और +${vipDaysToAdd} Days VIP वैलिडिटी जोड़ दी गई है!` : `सफलतापूर्वक अप्रूव हो गया! +${creditsToAdd} Credits यूज़र के वॉलेट में जोड़ दिए गए हैं।`);
        await window.loadAllUsersForDropdown(); window.loadAllPayments();
    } catch (err) { alert('Error: ' + err.message); }
};
window.rejectPayment = async function(paymentDocId) { if (!confirm(`क्या आप इस पेमेंट को REJECT करना चाहते हैं?\n(यह आपकी Rejected History में सेव रहेगा)`)) return; try { await updateDoc(doc(db, "payments", paymentDocId), { status: "Rejected" }); window.loadAllPayments(); } catch (err) {} };
window.deletePaymentRecord = async function(paymentDocId) { if (!confirm(`क्या आप इस पेमेंट हिस्ट्री रिकॉर्ड को हमेशा के लिए डिलीट करना चाहते हैं?`)) return; try { await deleteDoc(doc(db, "payments", paymentDocId)); window.loadAllPayments(); } catch (err) {} };

// ================= HISTORY, STAMP & CERTIFICATE CHECKBOX LOGIC =================
window.adminHistoryLastVisibleDoc = null;
window.adminHistoryHasMore = true;
window.adminHistoryIsLoading = false;
window.adminHistoryBatchSize = 20;
window.adminHistoryObserver = null;

window.loadAdminHistory = async function(isReset = true) {
    const container = document.getElementById('adminHistoryListContainer');
    const btn = document.getElementById('btnLoadMoreHistory');

    if (isReset) {
        window.adminAllHistoryData = [];
        window.adminHistoryLastVisibleDoc = null;
        window.adminHistoryHasMore = true;
        if (container) {
            container.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-100"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>ताज़ा 20 रिकॉर्ड्स लोड हो रहे हैं...</div>`;
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
            historyQuery = query(
                historyCol,
                orderBy("timestamp", "desc"),
                startAfter(window.adminHistoryLastVisibleDoc),
                limit(window.adminHistoryBatchSize)
            );
        } else {
            historyQuery = query(
                historyCol,
                orderBy("timestamp", "desc"),
                limit(window.adminHistoryBatchSize)
            );
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
            let certEnabled = rec.certificateFileId ? (rec.isCertificateAttached !== false) : false;
            if (rec.certificateFileId && !window.certificateSelectionMap[idx]) {
                window.certificateSelectionMap[idx] = { enabled: certEnabled, certificateFileId: rec.certificateFileId };
            }
        });

        window.renderAdminHistory();
        window.setupAdminHistoryInfiniteScroll();

    } catch (err) {
        if (container && isReset) {
            container.innerHTML = `<div class="p-6 text-center text-red-500 font-bold bg-white rounded-2xl">एरर: ${err.message}</div>`;
        }
    } finally {
        window.adminHistoryIsLoading = false;
        if (btn) {
            btn.disabled = !window.adminHistoryHasMore;
            btn.innerHTML = window.adminHistoryHasMore 
                ? '<i class="fa-solid fa-angles-down mr-1"></i> और 20 रिकॉर्ड्स लोड करें (Load More)' 
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

    if (window.adminHistoryObserver) {
        window.adminHistoryObserver.disconnect();
    }

    window.adminHistoryObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && window.adminHistoryHasMore && !window.adminHistoryIsLoading) {
            window.loadNextAdminHistoryBatch();
        }
    }, { rootMargin: '200px' });

    window.adminHistoryObserver.observe(sentinel);
};

window.deductAnnexureAddonFee = async function(record, addonType) {
    if (!record || !String(record.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_')) {
        return { ok: true, chargedNow: false };
    }

    const isStamp = (addonType === 'stamp');
    const flagField = isStamp ? 'adminStampCharged' : 'adminCertCharged';
    const feeField = isStamp ? 'adminStampFee' : 'adminCertFee';
    const timeField = isStamp ? 'adminStampChargedAt' : 'adminCertChargedAt';
    const fee = isStamp ? (window.ANNEXURE_STAMP_FEE || 20) : (window.ANNEXURE_CERT_FEE || 20);
    const labelHi = isStamp ? 'स्टैम्प (Stamp)' : 'सर्टिफिकेट (Certificate)';

    if (record[flagField]) {
        return { ok: true, chargedNow: false };
    }

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
        await updateDoc(doc(db, "history", record.id), {
            [flagField]: true,
            [feeField]: fee,
            [timeField]: new Date()
        });

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
        return { ok: true, chargedNow: true, fee: fee, newCredits: newCredits, userEmail: uData.email || 'User' };
    } catch (err) {
        return { ok: true, chargedNow: false };
    }
};

window.toggleRowStampCheckbox = async function(origIndex, isChecked) {
    const record = window.adminAllHistoryData[origIndex]; if (!record) return;
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
        record.withStamp = true; record.stampFile = chosenObj.name; record.stampCity = selectedCity;
        try { await updateDoc(doc(db, "history", record.id), { withStamp: true, stampFile: chosenObj.name, stampCity: selectedCity, stampedAt: new Date() }); } catch (e) {}
        if (feeRes.chargedNow) {
            alert(`✅ स्टैम्प लगा दिया गया है और यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं!\nबचे हुए क्रेडिट्स: ${feeRes.newCredits} Cr`);
        }
    } else {
        window.stampSelectionMap[origIndex] = { enabled: false, stampFile: '', stampSrc: '', stampCity: '' }; record.withStamp = false; record.stampFile = ''; record.stampCity = '';
        try { await updateDoc(doc(db, "history", record.id), { withStamp: false, stampFile: '', stampCity: '' }); } catch (e) {}
    }
    window.renderAdminHistory();
};

window.changeRowStampCity = async function(origIndex, cityId) {
    const record = window.adminAllHistoryData[origIndex]; if (!record) return;
    if (!cityId) return;
    if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
    const chosenObj = window.getStampObjForCity(cityId);
    window.stampSelectionMap[origIndex] = { enabled: true, stampFile: chosenObj.name, stampSrc: chosenObj.dataUrl, stampCity: cityId };
    record.withStamp = true; record.stampFile = chosenObj.name; record.stampCity = cityId;
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
    const fData = record?.formData || {}; if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id;
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
    const months = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
    };

    if (fData.day && fData.monthYear) {
        let dStr = fData.day.replace(/\D/g, ''); 
        let d = parseInt(dStr) || 1;
        let dayNum = d < 10 ? '0' + d : '' + d;

        let parts = fData.monthYear.trim().split(/\s+/);
        let mStr = (parts[0] || 'JAN').substring(0, 3).toUpperCase();
        let monthNum = months[mStr] || '01';
        let yearNum = parts[1] || new Date().getFullYear();

        return `${dayNum}/${monthNum}/${yearNum}`; 
    } else if (fData.date) {
        let dStr = fData.date; 
        if (dStr.includes('-')) {
            let parts = dStr.split('-');
            if (parts.length === 3 && parts[0].length === 4) { 
                return `${parts[2]}/${parts[1]}/${parts[0]}`; 
            }
        } else if (dStr.includes('/')) {
            let parts = dStr.split('/');
            if (parts.length === 3 && parts[2].length === 4) { 
                return dStr; 
            }
            else if (parts.length === 3 && parts[0].length === 4) { 
                return `${parts[2]}/${parts[1]}/${parts[0]}`; 
            }
        }
    }
    
    let now = new Date();
    let dd = String(now.getDate()).padStart(2, '0');
    let mm = String(now.getMonth() + 1).padStart(2, '0');
    let yyyy = now.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

window.toggleCertificateCheckbox = async function(origIndex, isChecked) {
    const record = window.adminAllHistoryData[origIndex]; if (!record) return;
    const checkboxEl = document.getElementById(`certChk-${origIndex}`); if (checkboxEl) checkboxEl.disabled = true;

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
            const candidateName = fData.applicantName || fData.parentName || fData.childName || fData.newName || 'CUSTOMER';
            const rawRel = fData.rel || 'S/o';
            const relationCode = window.formatRelationCodeForScript(rawRel);
            const fatherName = fData.relativeName || '';
            const docDate = window.formatDateForCertificate(fData); 

            const payload = {
                candidateName: candidateName,
                relationCode: relationCode,
                fatherName: fatherName,
                date: docDate
            };

            const targetUrl = window.API_URLS["certificate"];
            if (!targetUrl || targetUrl.includes('यहाँ_अपना_सर्टिफिकेट')) {
                alert('कृपया पहले config-templates.js में सर्टिफिकेट जनरेटर का सही Web App URL (API_URLS.certificate) दर्ज करें!');
                if (checkboxEl) { checkboxEl.checked = false; checkboxEl.disabled = false; } return;
            }

            const response = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
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
                alert(`✅ सर्टिफिकेट सफलतापूर्वक जनरेट होकर एनेक्सर के साथ अटैच हो गया है!${feeRes.chargedNow ? `\n\n💰 यूज़र (${feeRes.userEmail}) के वॉलेट से ${feeRes.fee} Credits (₹${feeRes.fee}) काट लिए गए हैं (बचे हुए: ${feeRes.newCredits} Cr)।` : ''}`);
            } else { throw new Error(resData.error || 'सर्टिफिकेट जनरेशन फेल हो गया'); }
        } catch (err) {
            alert('सर्टिफिकेट जोड़ने में समस्या आई: ' + err.message); if (checkboxEl) checkboxEl.checked = false;
        }
    } else {
        window.certificateSelectionMap[origIndex] = { enabled: false, certificateFileId: record.certificateFileId };
        record.isCertificateAttached = false;
        try { await updateDoc(doc(db, "history", record.id), { isCertificateAttached: false }); } catch(e){}
    }

    if (checkboxEl) checkboxEl.disabled = false; window.renderAdminHistory();
};

window.renderAdminHistory = function() {
    const container = document.getElementById('adminHistoryListContainer');
    const fUser = document.getElementById('filterUser')?.value || 'ALL'; 
    const fType = document.getElementById('filterType')?.value || 'ALL';
    const fDate = document.getElementById('filterDate')?.value || '';
    const fSearch = (document.getElementById('adminHistorySearchInput')?.value || '').trim().toLowerCase();
    const indexedData = window.adminAllHistoryData.map((item, idx) => ({ ...item, _origIndex: idx }));
    let filteredData = indexedData;
    if (fUser !== 'ALL') filteredData = filteredData.filter(item => item.userId === fUser);
    if (fType !== 'ALL') filteredData = filteredData.filter(item => item.serviceType === fType);
    if (fSearch) {
        filteredData = filteredData.filter(item => {
            const fName = (item.fileName || '').toLowerCase();
            const fData = item.formData || {};
            const appName = (fData.applicantName || fData.parentName || fData.childName || fData.NAME || '').toLowerCase();
            const email = (window.allUsersMap[item.userId] || '').toLowerCase();
            return fName.includes(fSearch) || appName.includes(fSearch) || email.includes(fSearch);
        });
    }
    if (fDate) {
        filteredData = filteredData.filter(item => {
            const sec = item.timestamp?.seconds || (item.timestamp ? Math.floor(new Date(item.timestamp).getTime() / 1000) : 0);
            if (!sec) return false;
            const d = new Date(sec * 1000);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}` === fDate;
        });
    }

    document.getElementById('historyCount').innerText = `दिख रहे हैं: ${filteredData.length} फाइल्स ${window.adminHistoryHasMore ? '(नीचे स्क्रॉल करके और देखें)' : '(सभी लोडेड)'}`; container.innerHTML = '';
    if (filteredData.length === 0) { container.innerHTML = `<div class="p-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-100"><i class="fa-regular fa-folder-open text-4xl mb-2 text-slate-300"></i><br>कोई फाइल नहीं मिली।</div>`; return; }

    filteredData.forEach(data => {
        const sec = data.timestamp?.seconds || Math.floor(Date.now() / 1000); const dateObj = new Date(sec * 1000);
        const dateStr = dateObj.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}); const timeStr = dateObj.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
        const userBadge = (data.userId === window.currentUserData.uid) ? '<span class="text-royal-700 font-black bg-royal-100 px-2 py-0.5 rounded text-[10px] border border-royal-200">👑 Admin</span>' : `<span class="font-bold text-slate-600 text-xs">${window.allUsersMap[data.userId] || 'User'}</span>`;
        const safeFileName = String(data.fileName || 'Document.pdf').replace(/'/g, "\\'");
        
        const isLocalDoc = String(data.fileId || '').startsWith('LOCAL_HTML_');
        const isAutoStampedCert = (data.fileId === 'LOCAL_HTML_CASTE' || data.fileId === 'LOCAL_HTML_DOMICILE');
        const isAnnexure = String(data.fileId || '').startsWith('LOCAL_HTML_ANNEXURE_');
        const stampState = window.stampSelectionMap[data._origIndex]; const isStampChecked = isAutoStampedCert ? true : !!(stampState && stampState.enabled);
        
        const certState = window.certificateSelectionMap[data._origIndex] || { enabled: false, certificateFileId: data.certificateFileId || '' }; 
        const isCertChecked = !!certState.enabled;

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
            <div class="inline-flex items-center gap-1.5 ${isStampChecked ? 'bg-green-100 text-green-950 border-green-400' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'} border px-2.5 py-1.5 rounded-xl text-xs font-black shadow-sm">
                <label class="inline-flex items-center gap-1 cursor-pointer select-none">
                    <input type="checkbox" id="stampChk-${data._origIndex}" ${isStampChecked ? 'checked' : ''} onchange="window.toggleRowStampCheckbox(${data._origIndex}, this.checked)" class="w-4 h-4 accent-green-600 rounded cursor-pointer">
                    <span><i class="fa-solid fa-stamp ${isStampChecked ? 'text-green-700' : 'text-amber-600'} mr-0.5"></i> ${isStampChecked ? 'Stamped' : 'Stamp'}</span>
                </label>
                <select id="stampCitySelect-${data._origIndex}" onchange="window.changeRowStampCity(${data._origIndex}, this.value)" class="p-1 border border-slate-300 rounded-lg text-[10px] font-black bg-white text-slate-800 outline-none cursor-pointer">
                    <option value="baraut" ${currentStampCity==='baraut'?'selected':''}>Baraut (बड़ौत)</option>
                    <option value="baghpat" ${currentStampCity==='baghpat'?'selected':''}>Baghpat (बागपत)</option>
                    <option value="kairana" ${currentStampCity==='kairana'?'selected':''}>Kairana (कैराना)</option>
                    <option value="shamli" ${currentStampCity==='shamli'?'selected':''}>Shamli (शामली)</option>
                    <option value="ghaziabad" ${currentStampCity==='ghaziabad'?'selected':''}>Ghaziabad (गाजियाबाद)</option>
                    <option value="muzaffarnagar" ${currentStampCity==='muzaffarnagar'?'selected':''}>Muzaffarnagar (मुजफ्फरनगर)</option>
                    <option value="saharanpur" ${currentStampCity==='saharanpur'?'selected':''}>Saharanpur (सहारनपुर)</option>
                    <option value="meerut" ${currentStampCity==='meerut'?'selected':''}>Meerut (मेरठ)</option>
                </select>
            </div>
        ` : '');

        const canAdminEditDoc = isLocalDoc || (data.formData && Object.keys(data.formData).length > 0);
        const editAnnexureBtnHtml = canAdminEditDoc ? `
            <a href="/portal?editAnnexure=${data.id}" target="_blank" class="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-500 hover:text-white px-2.5 py-2 rounded-xl text-xs font-black transition shadow-sm" title="डॉक्यूमेंट एडिट करें (केवल एडमिन)"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
        ` : '';

        const isDobPrint = (data.fileId === 'SERVER_API_DOB_PRINT' || data.serviceType === 'DOB Print');
        const isAlreadyRefunded = Boolean(data.isRefunded || data.formData?.REFUNDED);
        const refundBtnHtml = (isDobPrint && !isAlreadyRefunded) ? `
            <button onclick="window.refundDobOrderByAdmin('${data.id}', '${data.userId}', ${Number(data.formData?.CREDITS_DEDUCTED || 140)})" class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-600 hover:text-white px-2.5 py-2 rounded-xl text-xs font-black transition shadow-sm" title="यूज़र के क्रेडिट्स रिफंड करें"><i class="fa-solid fa-rotate-left"></i> Refund Cr</button>
        ` : (isAlreadyRefunded ? `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1.5 rounded-xl text-[10px] font-black"><i class="fa-solid fa-check-circle mr-0.5"></i>Refunded</span>` : '');

        container.innerHTML += `
            <div class="bg-white p-3.5 md:p-4 rounded-2xl border ${isStampChecked || isCertChecked ? 'border-royal-300 bg-slate-50/50' : 'border-slate-200'} shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 hover:border-royal-400 transition">
                <div class="space-y-1 overflow-hidden w-full">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">${data.serviceType}</span>
                        ${data.adminStampCharged ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black"><i class="fa-solid fa-stamp mr-0.5"></i>20 Cr Stamp</span>` : ""}
                        ${data.adminCertCharged ? `<span class="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-md text-[10px] font-black"><i class="fa-solid fa-certificate mr-0.5"></i>20 Cr Cert</span>` : ""}
                        ${userBadge}
                        <span class="text-[11px] text-slate-400 font-medium ml-auto xl:ml-0">${dateStr} • ${timeStr}</span>
                    </div>
                    <p class="font-black text-slate-800 text-xs md:text-sm truncate">${data.fileName}</p>
                </div>
                <div class="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end shrink-0 border-t xl:border-t-0 pt-2 xl:pt-0 border-slate-100">
                    ${certificateCheckboxHtml}
                    ${stampCheckboxHtml}
                    ${refundBtnHtml}
                    ${editAnnexureBtnHtml}
                    <button onclick="window.openPdfViewer('${data.fileId}', '${safeFileName}', ${data._origIndex})" class="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 bg-royal-50 text-royal-700 px-3 py-2 rounded-xl text-xs font-black hover:bg-royal-500 hover:text-white transition border border-royal-200"><i class="fa-solid fa-eye"></i> Preview</button>
                    <button onclick="window.triggerDirectPrintByIndex(${data._origIndex}, this)" class="inline-flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-dark-950 px-3 py-2 rounded-xl text-xs font-black transition shadow-sm"><i class="fa-solid fa-print"></i> Print</button>
                    <button onclick="window.deleteHistoryRecord('${data.id}')" class="w-9 h-9 inline-flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition border border-red-100"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.refundDobOrderByAdmin = async function(docId, targetUid, refundAmt = 140) {
    if (!docId || !targetUid) return;
    if (!confirm(`क्या आप इस DOB Original PDF ऑर्डर को कैंसिल करके यूज़र को +${refundAmt} Credits (₹${refundAmt}) रिफंड करना चाहते हैं?`)) return;
    try {
        const userRef = doc(db, "users", targetUid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return alert('यूज़र नहीं मिला!');
        const uData = userSnap.data();
        const curCredits = Number(uData.credits) || 0;
        const newCredits = curCredits + refundAmt;

        await updateDoc(userRef, { credits: newCredits });
        await updateDoc(doc(db, "history", docId), {
            isRefunded: true,
            refundAmount: refundAmt,
            refundReason: `Admin Refunded (+${refundAmt} Cr)`,
            refundedAt: new Date(),
            'formData.API_STATUS': 'cancelled',
            'formData.REFUNDED': true
        });
        await addDoc(collection(db, "payments"), {
            userId: targetUid,
            email: uData.email || '',
            amountPaid: 0,
            creditsRequested: refundAmt,
            wantsVip: false,
            vipDaysRequested: 0,
            vipPlanFee: 0,
            utrNumber: 'DOB_REFUND',
            status: 'Refunded',
            note: `DOB Original PDF Cancelled - Refund (+${refundAmt} Cr)`,
            timestamp: new Date()
        });

        if (window.usersDataList[targetUid]) window.usersDataList[targetUid].credits = newCredits;
        alert(`✅ +${refundAmt} Credits सफलतापूर्वक यूज़र (${uData.email}) को रिफंड कर दिए गए हैं और उसकी पासबुक में एंट्री जोड़ दी गई है!`);
        window.loadAdminHistory();
    } catch (err) {
        alert('Error refunding credits: ' + err.message);
    }
};

window.deleteHistoryRecord = async function(docId) { if (!confirm('क्या आप इस फाइल को हमेशा के लिए डिलीट करना चाहते हैं?')) return; try { await deleteDoc(doc(db, "history", docId)); window.loadAdminHistory(); } catch (err) {} };

window.bulkDeleteFilteredHistory = async function() {
    const fUser = document.getElementById('filterUser').value; const fType = document.getElementById('filterType').value;
    let filteredData = window.adminAllHistoryData;
    if (fUser !== 'ALL') filteredData = filteredData.filter(item => item.userId === fUser); if (fType !== 'ALL') filteredData = filteredData.filter(item => item.serviceType === fType);
    if (filteredData.length === 0) return alert('डिलीट करने के लिए कोई फाइल नहीं है!');
    if (!confirm(`चेतावनी!\nक्या आप वाकई इन ${filteredData.length} फाइलों को हमेशा के लिए डिलीट करना चाहते हैं?`)) return;
    const btn = document.getElementById('bulkDeleteBtn'); const origHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...'; btn.disabled = true;
    try { await Promise.all(filteredData.map(item => deleteDoc(doc(db, "history", item.id)))); alert(`Success! ${filteredData.length} फाइलें डिलीट कर दी गईं।`); window.loadAdminHistory(); } catch (err) {} finally { btn.innerHTML = origHTML; btn.disabled = false; }
};

window.triggerDirectPrintByIndex = async function(historyIndex, btnEl) {
    const record = window.adminAllHistoryData[historyIndex]; if (!record) return;
    const stampState = window.stampSelectionMap[historyIndex]; const withStamp = !!(stampState && stampState.enabled); let chosenSrc = stampState?.stampSrc || '';
    if (withStamp && !chosenSrc) {
        if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
        const chosenObj = window.pickRandomAvailableStampObj(); chosenSrc = chosenObj.dataUrl; window.stampSelectionMap[historyIndex] = { enabled: true, stampFile: chosenObj.name, stampSrc: chosenSrc };
    }
    const certState = window.certificateSelectionMap[historyIndex]; 
    const certFileId = (certState && certState.enabled) ? certState.certificateFileId : '';
    window.directPrintDocument(record.fileId, record.formData || {}, record.fileName || 'Document.pdf', withStamp, chosenSrc, certFileId);
};

window.toggleModalStampPreview = async function(isChecked) {
    const ctx = window.currentModalContext; if (!ctx || !String(ctx.fileId).startsWith('LOCAL_HTML_')) return;
    if (isChecked && ctx.historyIndex >= 0 && window.adminAllHistoryData[ctx.historyIndex]) {
        const feeRes = await window.deductAnnexureAddonFee(window.adminAllHistoryData[ctx.historyIndex], 'stamp');
        if (!feeRes.ok) {
            const modalChk = document.getElementById('modalStampCheckbox');
            if (modalChk) modalChk.checked = false;
            return;
        }
    }
    if (isChecked) { if (window.availableStampsList.length === 0) await window.preloadAllAvailableStamps(); const chosenObj = window.pickRandomAvailableStampObj(); ctx.withStamp = true; ctx.stampFile = chosenObj.name; ctx.stampSrc = chosenObj.dataUrl; } else { ctx.withStamp = false; ctx.stampFile = ''; ctx.stampSrc = ''; }
    if (ctx.historyIndex >= 0) { window.stampSelectionMap[ctx.historyIndex] = { enabled: ctx.withStamp, stampFile: ctx.stampFile, stampSrc: ctx.stampSrc }; const record = window.adminAllHistoryData[ctx.historyIndex]; if (record) { record.withStamp = ctx.withStamp; record.stampFile = ctx.stampFile; try { await updateDoc(doc(db, "history", record.id), { withStamp: ctx.withStamp, stampFile: ctx.stampFile || '', stampedAt: new Date() }); } catch (e) {} } window.renderAdminHistory(); }
    const record = window.adminAllHistoryData[ctx.historyIndex]; const fData = record?.formData || {}; if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id; const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    htmlPreviewContainer.innerHTML = window.buildLocalAffidavitHtml(ctx.fileId, fData, true, ctx.withStamp, ctx.stampSrc);
};

window.openPdfViewer = async function(fileId, fileName, historyIndex = -1) {
    document.getElementById('pdfViewerTitle').innerText = fileName;
    const iframe = document.getElementById('pdfIframe'); const htmlPreviewContainer = document.getElementById('htmlDocPreviewContainer');
    const spinner = document.getElementById('pdfLoadingSpinner'); const downloadBtn = document.getElementById('modalDownloadBtn');
    const printBtn = document.getElementById('modalPrintBtn'); const modalStampLabel = document.getElementById('modalStampToggleLabel');
    const modalStampCheckbox = document.getElementById('modalStampCheckbox'); const shareBtn = document.getElementById('modalShareBtn');

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
        initialWithStamp = !!(existingState && existingState.enabled); initialStampSrc = existingState?.stampSrc || ''; initialStampFile = existingState?.stampFile || '';
        
        const existingCert = window.certificateSelectionMap ? window.certificateSelectionMap[historyIndex] : null;
        initialCertFileId = (existingCert && existingCert.enabled) ? existingCert.certificateFileId : '';
    }

    if (initialWithStamp && !initialStampSrc && typeof window.preloadAllAvailableStamps === 'function') {
        if (window.availableStampsList && window.availableStampsList.length === 0) await window.preloadAllAvailableStamps();
        if(window.pickRandomAvailableStampObj){ const chosenObj = window.pickRandomAvailableStampObj(); initialStampSrc = chosenObj.dataUrl; initialStampFile = chosenObj.name; if (historyIndex >= 0 && window.stampSelectionMap) { window.stampSelectionMap[historyIndex] = { enabled: true, stampFile: initialStampFile, stampSrc: initialStampSrc }; } }
    }

    window.currentModalContext = { fileId: fileId, fileName: fileName, historyIndex: historyIndex, withStamp: initialWithStamp, stampFile: initialStampFile, stampSrc: initialStampSrc, certificateFileId: initialCertFileId };
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
        const fData = record?.formData || {}; if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id;
        
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
        
        htmlPreviewContainer.style.display = 'none'; htmlPreviewContainer.innerHTML = '';
        iframe.style.display = 'block'; iframe.style.flex = '1'; spinner.style.display = 'flex';
        iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
        
        if (downloadBtn) { downloadBtn.onclick = function() { window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, '_blank'); }; }
        if (printBtn) { printBtn.onclick = function() { window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank'); }; }
    }
    const modal = document.getElementById('pdfViewerModal'); if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); } document.body.style.overflow = 'hidden';
};

window.closePdfViewer = function() { const modal = document.getElementById('pdfViewerModal'); if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); } const iframe = document.getElementById('pdfIframe'); if (iframe) iframe.src = ''; const htmlContainer = document.getElementById('htmlDocPreviewContainer'); if (htmlContainer) htmlContainer.innerHTML = ''; document.body.style.overflow = 'auto'; };

window.switchAdminMainTab = function(tabName) {
    if (tabName === 'create_user' && window.currentUserData?.isSubAdmin) { alert('नया यूज़र बनाने का अधिकार केवल Super Admin के पास है!'); return; } 
    if (!tabName) tabName = "payments";
    sessionStorage.setItem("ojas_admin_active_tab", tabName);
    const tabs = ['payments', 'users', 'create_user', 'support', 'history', 'controls']; 
    tabs.forEach(t => { 
        const btn = document.getElementById(`tab-${t}`); 
        if (btn) btn.className = "bg-slate-50 text-slate-600 font-bold py-2.5 px-3 rounded-xl hover:bg-slate-100 transition border border-slate-200/80 text-xs flex justify-center items-center gap-1.5"; 
        const section = document.getElementById(`section-${t}`); 
        if (section) section.classList.add('hidden'); 
    }); 
    const activeBtn = document.getElementById(`tab-${tabName}`); 
    if (activeBtn) activeBtn.className = "bg-dark-950 text-royal-300 font-black py-2.5 px-3 rounded-xl shadow-glow transition text-xs flex justify-center items-center gap-1.5 border border-royal-500/50"; 
    const activeSection = document.getElementById(`section-${tabName}`); 
    if (activeSection) { 
        activeSection.removeAttribute('class'); 
        if (tabName === 'payments') activeSection.className = 'space-y-4'; 
        if (tabName === 'users') activeSection.className = 'space-y-4'; 
        if (tabName === 'create_user') activeSection.className = 'block'; 
        if (tabName === 'support') activeSection.className = 'space-y-4'; 
        if (tabName === 'history') activeSection.className = 'space-y-4'; 
        if (tabName === 'controls') activeSection.className = 'grid grid-cols-1 md:grid-cols-2 gap-4'; 
    } 
    if (tabName === 'payments') window.loadAllPayments(); 
    if (tabName === 'support') { window.populateSupportUserDropdown(); window.renderSupportChatSidebar(); if (!window.selectedChatTicketId && window.allSupportTickets.length > 0) window.selectSupportChatThread(window.allSupportTickets[0].id); } 
    if (tabName === 'history') window.loadAdminHistory(); 
    if (tabName === 'controls') window.loadPortalSettingsForAdmin(); 
};

window.loadAllUsersForDropdown = async function() { try { const querySnapshot = await getDocs(collection(db, "users")); window.usersDataList = {}; window.allUsersMap = {}; const selectDropdown = document.getElementById('userSelectDropdown'); if (selectDropdown) { selectDropdown.innerHTML = '<option value="">-- किसी यूज़र को चुनें --</option>'; } querySnapshot.forEach((docSnap) => { const data = docSnap.data(); window.usersDataList[docSnap.id] = data; window.allUsersMap[docSnap.id] = data.email || 'Unknown User'; if (selectDropdown && (data.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { selectDropdown.innerHTML += `<option value="${docSnap.id}">${data.email} (${data.userPhone || 'No Phone'})</option>`; } }); if (typeof window.populateSupportUserDropdown === 'function') { window.populateSupportUserDropdown(); } } catch (err) {} };

window.handleUserSelection = function() { 
    const uid = document.getElementById('userSelectDropdown').value; 
    if (!uid || !window.usersDataList[uid]) { 
        document.getElementById('currentUserCreditsDisplay').innerText = '--'; 
        document.getElementById('selectedUserVipBadge').innerText = '--'; 
        if(document.getElementById('selectedUserPhoneInput')) document.getElementById('selectedUserPhoneInput').value = ''; 
        if(document.getElementById('selectedUserSavedPass')) document.getElementById('selectedUserSavedPass').innerText = '--'; 
        return; 
    } 
    const uData = window.usersDataList[uid]; 
    document.getElementById('currentUserCreditsDisplay').innerText = uData.credits || 0; 
    document.getElementById('selectedUserVipBadge').innerText = 'Active Normal User'; 
    if(document.getElementById('selectedUserPhoneInput')) document.getElementById('selectedUserPhoneInput').value = uData.userPhone || ''; 
    if(document.getElementById('selectedUserSavedPass')) document.getElementById('selectedUserSavedPass').innerText = uData.userPass || 'Not Set'; 
    
    if(document.getElementById('userDomicileToggle')) document.getElementById('userDomicileToggle').checked = uData.allowDomicile !== false;
    if(document.getElementById('userCasteToggle')) document.getElementById('userCasteToggle').checked = uData.allowCaste !== false;
    if(document.getElementById('userEvoterToggle')) document.getElementById('userEvoterToggle').checked = uData.allowEvoter !== false;
    if(document.getElementById('userMinorToggle')) document.getElementById('userMinorToggle').checked = uData.allowMinor !== false; 
    if(document.getElementById('userDobDelhiToggle')) document.getElementById('userDobDelhiToggle').checked = (uData.allowDobDelhi !== false && uData.allowDobMinor !== false);
    if(document.getElementById('userDobMinorToggle')) document.getElementById('userDobMinorToggle').checked = (uData.allowDobDelhi !== false && uData.allowDobMinor !== false);
    if(document.getElementById('userDobPrintToggle')) document.getElementById('userDobPrintToggle').checked = uData.allowDobPrint !== false;
    if(document.getElementById('userPassportToggle')) document.getElementById('userPassportToggle').checked = uData.allowPassport !== false;
    if(document.getElementById('userGazetteToggle')) document.getElementById('userGazetteToggle').checked = uData.allowGazette !== false;
    if(document.getElementById('userAnnexuresToggle')) document.getElementById('userAnnexuresToggle').checked = uData.allowAnnexures !== false;

    const bannerChk = document.getElementById('chkUserBannerEnabled');
    if (bannerChk) bannerChk.checked = !!uData.personalBannerEnabled;
    if (document.getElementById('inpUserBannerBadge')) document.getElementById('inpUserBannerBadge').value = uData.personalBannerBadge || 'NOTICE';
    if (document.getElementById('inpUserBannerTitle')) document.getElementById('inpUserBannerTitle').value = uData.personalBannerTitle || '';
    if (document.getElementById('inpUserBannerMessage')) document.getElementById('inpUserBannerMessage').value = uData.personalBannerMessage || '';
    if (document.getElementById('inpUserBannerBtnText')) document.getElementById('inpUserBannerBtnText').value = uData.personalBannerBtnText || '';
    if (document.getElementById('inpUserBannerBtnLink')) document.getElementById('inpUserBannerBtnLink').value = uData.personalBannerBtnLink || '';
    if (typeof window.updateUserBannerPreview === 'function') window.updateUserBannerPreview();
};

window.updateUserBannerPreview = function() {
    const uid = document.getElementById('userSelectDropdown')?.value;
    const previewBox = document.getElementById('userBannerPreviewBox');
    if (!previewBox) return;
    if (!uid || !window.usersDataList[uid]) {
        previewBox.innerHTML = '<span class="text-xs text-slate-400 font-bold"><i class="fa-solid fa-arrow-up mr-1"></i> कृपया पहले ऊपर ड्रॉपडाउन से कोई यूज़र चुनें</span>';
        return;
    }
    const uData = window.usersDataList[uid];
    const isEnabled = document.getElementById('chkUserBannerEnabled')?.checked;
    const badge = document.getElementById('inpUserBannerBadge')?.value.trim() || 'NOTICE';
    const title = document.getElementById('inpUserBannerTitle')?.value.trim();
    const msg = document.getElementById('inpUserBannerMessage')?.value.trim();
    const btnText = document.getElementById('inpUserBannerBtnText')?.value.trim();
    const name = typeof window.extractUserDisplayName === 'function' 
        ? window.extractUserDisplayName(uData.email, uData.username) 
        : (uData.username || uData.email.split('@')[0]);

    if (!isEnabled) {
        previewBox.innerHTML = `
            <div class="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold text-center">
                <i class="fa-solid fa-eye-slash mr-1 text-slate-400"></i> इस यूज़र (${uData.email}) के लिए पर्सनल बैनर वर्तमान में <strong>बंद (OFF)</strong> है।
            </div>`;
        return;
    }

    const displayMsg = msg || 'यहाँ जो भी संदेश लिखेंगे, वह यूज़र को इस बॉक्स में दिखेगा...';
    const btnHtml = btnText ? `<span class="bg-amber-400 text-dark-950 font-black px-3 py-1 rounded-xl text-[10px] shrink-0 shadow-sm">${btnText}</span>` : '';

    previewBox.innerHTML = `
        <div class="p-3.5 md:p-4 rounded-2xl bg-gradient-to-r from-dark-950 via-slate-900 to-amber-950 text-white border-2 border-amber-400 shadow-lg relative overflow-hidden">
            <div class="relative z-10 space-y-1.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="bg-amber-400 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            <i class="fa-solid fa-user-tag mr-1"></i>${badge}
                        </span>
                        <h4 class="text-xs md:text-sm font-black text-amber-300 flex items-center gap-1.5">
                            <span>डियर ${name}</span>
                            ${title ? `<span class="text-slate-300 font-semibold">• ${title}</span>` : ''}
                        </h4>
                    </div>
                    ${btnHtml}
                </div>
                <p class="text-xs md:text-sm font-bold text-slate-100 whitespace-pre-line leading-relaxed pl-0.5">
                    ${displayMsg}
                </p>
            </div>
        </div>`;
};

window.saveSelectedUserBanner = async function(event) {
    if (event) event.preventDefault();
    const uid = document.getElementById('userSelectDropdown')?.value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से उस यूज़र को सेलेक्ट करें जिसके लिए बैनर सेट करना है!');
    const uData = window.usersDataList[uid];
    const btn = document.getElementById('btnSaveUserBanner');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...'; }

    const isEnabled = document.getElementById('chkUserBannerEnabled').checked;
    const badge = document.getElementById('inpUserBannerBadge').value.trim() || 'NOTICE';
    const title = document.getElementById('inpUserBannerTitle').value.trim();
    const message = document.getElementById('inpUserBannerMessage').value.trim();
    const btnText = document.getElementById('inpUserBannerBtnText').value.trim();
    const btnLink = document.getElementById('inpUserBannerBtnLink').value.trim();

    if (isEnabled && !message) {
        alert('कृपया यूज़र के लिए मैसेज भी लिखें, या फिर "Show to this User" टिक हटा दें!');
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        return;
    }

    try {
        const payload = {
            personalBannerEnabled: isEnabled,
            personalBannerBadge: badge,
            personalBannerTitle: title,
            personalBannerMessage: message,
            personalBannerBtnText: btnText,
            personalBannerBtnLink: btnLink,
            personalBannerUpdatedAt: new Date()
        };
        await updateDoc(doc(db, "users", uid), payload);
        
        Object.assign(window.usersDataList[uid], payload);
        window.updateUserBannerPreview();

        const name = typeof window.extractUserDisplayName === 'function' 
            ? window.extractUserDisplayName(uData.email, uData.username) 
            : (uData.username || uData.email.split('@')[0]);

        const alertMsg = document.getElementById('adminMsg');
        if (alertMsg) {
            alertMsg.className = "p-3.5 bg-green-50 text-green-900 rounded-2xl text-xs font-black border border-green-300 text-center shadow-sm";
            alertMsg.innerHTML = `<i class="fa-solid fa-circle-check text-green-600 mr-1"></i> यूज़र <strong>${uData.email} (डियर ${name})</strong> के लिए पर्सनल बैनर सफलतापूर्वक <strong>${isEnabled ? 'चालू (Saved & Active)' : 'बंद (Disabled)'}</strong> कर दिया गया है!`;
            alertMsg.classList.remove('hidden');
            setTimeout(() => alertMsg.classList.add('hidden'), 4000);
        }
        alert(`सफलतापूर्वक सेव हो गया!\n\nयह बैनर अब सिर्फ "डियर ${name}" (${uData.email}) के पोर्टल पर दिखेगा।`);
    } catch (err) {
        alert('Error saving personal banner: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
};

window.clearSelectedUserBanner = async function() {
    const uid = document.getElementById('userSelectDropdown')?.value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले किसी यूज़र को सेलेक्ट करें!');
    const uData = window.usersDataList[uid];
    if (!confirm(`क्या आप यूज़र "${uData.email}" का पर्सनल बैनर हटाना (Clear) चाहते हैं?`)) return;

    try {
        const payload = {
            personalBannerEnabled: false,
            personalBannerMessage: '',
            personalBannerTitle: '',
            personalBannerBtnText: '',
            personalBannerBtnLink: '',
            personalBannerUpdatedAt: new Date()
        };
        await updateDoc(doc(db, "users", uid), payload);
        Object.assign(window.usersDataList[uid], payload);

        document.getElementById('chkUserBannerEnabled').checked = false;
        document.getElementById('inpUserBannerTitle').value = '';
        document.getElementById('inpUserBannerMessage').value = '';
        document.getElementById('inpUserBannerBtnText').value = '';
        document.getElementById('inpUserBannerBtnLink').value = '';
        window.updateUserBannerPreview();

        alert('पर्सनल बैनर सफलतापूर्वक हटा दिया गया है!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.adminSetNewUserPassword = async function() { const uid = document.getElementById('userSelectDropdown').value; if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले यूज़र चुनें!'); const newPass = document.getElementById('adminNewResetPass').value.trim(); if (newPass.length < 6) return alert('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए!'); const btn = document.getElementById('btnAdminSetPass'); const orig = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { const uData = window.usersDataList[uid]; if (uData.userPass) { try { const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: uData.email, password: uData.userPass, returnSecureToken: true }) }); const signInData = await signInRes.json(); if (signInData.idToken) { await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: signInData.idToken, password: newPass, returnSecureToken: true }) }); } } catch (e) { } } await updateDoc(doc(db, "users", uid), { userPass: newPass, adminResetPass: newPass, passUpdatedAt: new Date() }); window.usersDataList[uid].userPass = newPass; document.getElementById('selectedUserSavedPass').innerText = newPass; document.getElementById('adminNewResetPass').value = ''; alert('पासवर्ड सफलतापूर्वक बदल दिया गया है!'); } catch (err) { alert('Error: ' + err.message); } finally { btn.innerHTML = orig; btn.disabled = false; } };

window.adjustCredits = async function(action) {
    if (window.currentUserData?.isSubAdmin) return alert('एक्स्ट्रा क्रेडिट्स मैन्युअली बढ़ाने या घटाने का अधिकार केवल Super Admin के पास है! आप केवल Payments टैब से पेमेंट रिक्वेस्ट Approve कर सकते हैं।');
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले यूज़र चुनें!');
    const amtVal = parseInt(document.getElementById('creditAdjustmentAmount').value);
    if (isNaN(amtVal) || amtVal <= 0) return alert('कृपया सही क्रेडिट वैल्यू डालें!');
    const uData = window.usersDataList[uid];
    let currentCredits = uData.credits || 0;
    let newCredits = action === 'add' ? currentCredits + amtVal : currentCredits - amtVal;
    if (newCredits < 0) newCredits = 0;

    const giftNote = document.getElementById('adminCreditGiftNote')?.value.trim() || (action === 'add' ? 'Admin Credit Gift / Bonus' : 'Admin Credit Deduction');

    try {
        await updateDoc(doc(db, "users", uid), { credits: newCredits });
        window.usersDataList[uid].credits = newCredits;

        await addDoc(collection(db, "payments"), {
            userId: uid,
            email: uData.email,
            amountPaid: 0,
            creditsRequested: amtVal,
            wantsVip: false,
            vipDaysRequested: 0,
            vipPlanFee: 0,
            utrNumber: action === 'add' ? "ADMIN_GIFT" : "ADMIN_DEDUCT",
            status: action === 'add' ? "Gift / Bonus" : "Admin Deducted",
            note: giftNote,
            timestamp: new Date()
        });
        if (document.getElementById('adminCreditGiftNote')) {
            document.getElementById('adminCreditGiftNote').value = '';
        }

        window.handleUserSelection();
        document.getElementById('creditAdjustmentAmount').value = '';
        alert(action === 'add' 
            ? `सफलतापूर्वक +${amtVal} क्रेडिट्स गिफ्ट/जोड़ दिए गए हैं और हिस्ट्री में रिकॉर्ड हो गया है!` 
            : `क्रेडिट्स सफलतापूर्वक घटा दिए गए हैं!`);
    } catch (err) { alert('Error: ' + err.message); }
};

window.createNewUserByAdmin = async function(e) { e.preventDefault(); const emailInp = document.getElementById('newAdminUserEmail').value.trim().toLowerCase(); const pass = document.getElementById('newAdminUserPass').value.trim(); const phone = document.getElementById('newAdminUserPhone').value.trim(); const credits = parseInt(document.getElementById('newAdminUserCredits').value) || 0; const vipDays = 0; const msg = document.getElementById('adminCreateMsg'); const email = emailInp.includes('@') ? emailInp : `${emailInp}@print.com`; if (pass.length < 6) return alert('पासवर्ड 6 अक्षरों का होना चाहिए!'); msg.className = "p-3 bg-blue-50 text-blue-800 rounded-xl text-xs font-bold text-center"; msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating user account...'; msg.classList.remove('hidden'); try { const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: pass, returnSecureToken: true }) }); const signUpData = await signUpRes.json(); if (signUpData.error) throw new Error(signUpData.error.message); const uid = signUpData.localId; const now = Date.now(); const isVip = vipDays > 0; const vipExpiry = isVip ? now + (vipDays * MS_PER_DAY) : 0; await setDoc(doc(db, "users", uid), { 
    email: email, 
    username: email.split('@')[0], 
    credits: credits, 
    isVip: isVip, 
    vipExpiry: vipExpiry, 
    allowEvoter: true,
    allowMinor: true, 
    allowDobDelhi: true, 
    allowDobMinor: true, 
    allowDomicile: true, 
    allowCaste: true, 
    allowDobPrint: true,
    allowPassport: true,
    allowGazette: true, 
    allowAnnexures: true, 
    userPass: pass, 
    adminResetPass: pass, 
    userPhone: phone, 
    createdAt: new Date() 
}); await window.loadAllUsersForDropdown(); msg.className = "p-3.5 bg-green-50 text-green-900 border border-green-300 rounded-xl text-xs font-black text-center"; msg.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> यूज़र <strong>${email}</strong> सफलतापूर्वक बन गया है!`; e.target.reset(); setTimeout(() => msg.classList.add('hidden'), 5000); } catch (err) { msg.className = "p-3 bg-red-50 text-red-800 border border-red-300 rounded-xl text-xs font-bold text-center"; msg.innerText = "Error: " + err.message; } };

window.loadDobPrintSecretApiConfig = async function() {
    try {
        const snap = await getDoc(doc(db, "adminSecrets", "dobPrintConfig"));
        if (snap.exists()) {
            const d = snap.data();
            if (document.getElementById('inpSecretDobApiUrl')) document.getElementById('inpSecretDobApiUrl').value = d.baseUrl || 'https://rtyu.run.place/api/v1/index.php';
            if (document.getElementById('inpSecretDobApiKey')) document.getElementById('inpSecretDobApiKey').value = d.apiKey || 'sk_2e7fc8baf4a1998c9382c1f961bdd64c';
            if (document.getElementById('inpSecretDobApplyService')) document.getElementById('inpSecretDobApplyService').value = d.applyService || 'b-number-pdf-apply';
            if (document.getElementById('inpSecretDobStatusService')) document.getElementById('inpSecretDobStatusService').value = d.statusService || 'b-number-pdf-status';
            if (document.getElementById('inpSecretDobCreditCost')) document.getElementById('inpSecretDobCreditCost').value = d.creditCost || 140;
        }
    } catch (e) {}
};

window.saveDobPrintSecretApiConfig = async function() {
    try {
        const payload = {
            baseUrl: document.getElementById('inpSecretDobApiUrl').value.trim(),
            apiKey: document.getElementById('inpSecretDobApiKey').value.trim(),
            applyService: document.getElementById('inpSecretDobApplyService').value.trim() || 'b-number-pdf-apply',
            statusService: document.getElementById('inpSecretDobStatusService').value.trim() || 'b-number-pdf-status',
            creditCost: parseInt(document.getElementById('inpSecretDobCreditCost').value) || 140,
            updatedAt: new Date()
        };
        await setDoc(doc(db, "adminSecrets", "dobPrintConfig"), payload, { merge: true });
        alert('✅ DOB Original PDF Secret API settings saved securely on the server!');
    } catch (err) {
        alert('Error saving secret API config: ' + err.message);
    }
};
