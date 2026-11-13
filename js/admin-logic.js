// ============================================================================
// FILE: js/admin-logic.js
// Admin Gateway Entry: Auth Guard, Separate /ovi Login, Stamps & Portal Settings
// ============================================================================

import "./config-templates.js?v=9.1";
import "./admin-users-chat.js?v=9.1";
import "./admin-payments-history.js?v=9.1";

const {
    auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
    doc, getDoc, setDoc
} = window.fb;

const ADMIN_EMAIL = window.ADMIN_EMAIL;

// ================= STAMP FILES AUTO-DETECT & CITY CONFIG =================
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

window.loadSingleStampFile = function(fileName) {
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

window.preloadAllAvailableStamps = async function() {
    if (window.availableStampsList.length > 0) return window.availableStampsList;
    const results = await Promise.all(CANDIDATE_STAMP_FILES.map(file => window.loadSingleStampFile(file)));
    window.availableStampsList = results.filter(item => item !== null);
    window.updateStampCountBadge();
    return window.availableStampsList;
};

window.updateStampCountBadge = function() {
    const badge = document.getElementById('activeStampsBadge');
    if (!badge) return;
    const count = window.availableStampsList.length;
    if (count > 0) {
        badge.className = "text-[10px] font-black bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 rounded-full";
        badge.innerHTML = `<i class="fa-solid fa-stamp mr-1"></i>${count} Stamps Active`;
        badge.title = `Loaded: ${window.availableStampsList.map(s => s.name).join(', ')}`;
    } else {
        badge.className = "text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full";
        badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i>No Stamp Uploaded`;
    }
};

window.pickRandomAvailableStampObj = function() {
    if (window.availableStampsList.length === 0) return { name: "stamp.png", dataUrl: "stamp.png" };
    return window.availableStampsList[Math.floor(Math.random() * window.availableStampsList.length)];
};
window.pickRandomAvailableStamp = function() { return window.pickRandomAvailableStampObj().dataUrl; };
window.getStampDataUrlByName = function(fileName) {
    if (!fileName) return window.pickRandomAvailableStamp();
    const found = window.availableStampsList.find(s => s.name === fileName);
    return found ? found.dataUrl : window.pickRandomAvailableStamp();
};

// ================= ADMIN AUTH & WORKSPACE UNLOCK =================
window.unlockAdminWorkspace = async function(user) {
    const emailLower = (user.email || '').trim().toLowerCase();
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
    const secretApiCard = document.getElementById('secretDobApiConfigCard');

    if (isSub && !isSuper) {
        if (headerTitleEl) headerTitleEl.innerHTML = `Sub-Admin <span class="text-royal-400">Prince</span>`;
        if (tabCreateUser) tabCreateUser.style.display = 'none';
        if (secCreateUser) secCreateUser.style.display = 'none';
        if (btnDeleteUser) btnDeleteUser.style.display = 'none';
        if (boxManualCredit) boxManualCredit.style.display = 'none';
        if (secretApiCard) secretApiCard.style.display = 'none';
        if (document.getElementById('inpSecretDobApiKey')) document.getElementById('inpSecretDobApiKey').value = '';
        if (navBar) navBar.className = "grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-2xl shadow-card border border-slate-200/80 sticky top-[52px] md:top-[68px] z-30";
    } else {
        if (headerTitleEl) headerTitleEl.innerHTML = `Admin <span class="text-royal-400">Harish Kumar</span>`;
        if (tabCreateUser) tabCreateUser.style.display = 'flex';
        if (btnDeleteUser) btnDeleteUser.style.display = 'flex';
        if (boxManualCredit) boxManualCredit.style.display = 'block';
        if (secretApiCard) secretApiCard.style.display = 'block';
    }

    const loginSec = document.getElementById('adminLoginSection');
    if (loginSec) loginSec.style.display = 'none';
    const loadingEl = document.getElementById('loadingScreen');
    if (loadingEl) loadingEl.classList.add('hidden');
    const panelEl = document.getElementById('adminPanelContent');
    if (panelEl) panelEl.classList.remove('hidden');

    if (window.history && window.history.replaceState) {
        try { window.history.replaceState(null, document.title, '/ovi'); } catch (e) {}
    }
    await window.preloadAllHtmlTemplates();
    await window.preloadAutoMStamp();
    await window.preloadAllAvailableStamps();
    await window.loadAllUsersForDropdown();
    await window.loadPortalSettingsForAdmin();
    window.startLiveSupportListener();
    let savedTab = sessionStorage.getItem('ojas_admin_active_tab') || 'payments';
    if (isSub && !isSuper && savedTab === 'create_user') savedTab = 'payments';
    window.switchAdminMainTab(savedTab);
};

// Separate Admin Gateway Login Handler (/ovi)
window.handleSeparateAdminLogin = async function(event) {
    if (event) event.preventDefault();
    const emailInput = (document.getElementById('secAdminEmail')?.value || '').trim().toLowerCase();
    const passInput = (document.getElementById('secAdminPass')?.value || '').trim();
    const errBox = document.getElementById('secAdminLoginError');
    const btn = document.getElementById('btnSecAdminLogin');
    const origHtml = btn ? btn.innerHTML : '';

    if (errBox) errBox.style.display = 'none';
    if (!emailInput || !passInput) {
        if (errBox) { errBox.innerText = 'कृपया Admin ID और Password दोनों दर्ज करें!'; errBox.style.display = 'block'; }
        return;
    }

    const email = emailInput.includes('@') ? emailInput : `${emailInput}@print.com`;
    const isAllowed = window.isAnyAdminEmail
        ? window.isAnyAdminEmail(email)
        : (email === ADMIN_EMAIL.toLowerCase() || email === 'ovi@print.com' || email === 'prince@gmail.com' || email === 'prince@print.com');

    if (!isAllowed) {
        if (errBox) { errBox.innerText = '⛔ यह एडमिन अकाउंट अधिकृत (Authorized) नहीं है!'; errBox.style.display = 'block'; }
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Verifying...'; }

    try {
        const cred = await signInWithEmailAndPassword(auth, email, passInput);
        sessionStorage.setItem('ojas_separate_admin_verified', 'true');
        await window.unlockAdminWorkspace(cred.user);
    } catch (err) {
        if (errBox) {
            errBox.innerText = '❌ गलत Admin ID या Password! (' + (err.code || err.message) + ')';
            errBox.style.display = 'block';
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
};

onAuthStateChanged(auth, async (user) => {
    const emailLower = user?.email ? user.email.trim().toLowerCase() : '';
    const isAllowedAdmin = window.isAnyAdminEmail
        ? window.isAnyAdminEmail(emailLower)
        : (emailLower === ADMIN_EMAIL.toLowerCase() || emailLower === 'ovi@print.com' || emailLower === 'prince@gmail.com' || emailLower === 'prince@print.com');

    if (user && isAllowedAdmin) {
        await window.unlockAdminWorkspace(user);
    } else {
        sessionStorage.removeItem('ojas_separate_admin_verified');
        const loadingEl = document.getElementById('loadingScreen');
        if (loadingEl) loadingEl.classList.add('hidden');
        const panelEl = document.getElementById('adminPanelContent');
        if (panelEl) panelEl.classList.add('hidden');
        const loginSec = document.getElementById('adminLoginSection');
        if (loginSec) {
            loginSec.style.display = 'flex';
        } else {
            window.location.replace('/portal');
        }
    }
});

window.handleLogout = async function() {
    sessionStorage.removeItem("ojas_separate_admin_verified");
    sessionStorage.removeItem("ojas_portal_access");
    await signOut(auth);
    window.location.replace("/portal");
};

// ================= ADMIN TAB SWITCHING =================
window.switchAdminMainTab = function(tabName) {
    if (tabName === 'create_user' && window.currentUserData?.isSubAdmin && !window.currentUserData?.isSuperAdmin) {
        alert('नया यूज़र बनाने का अधिकार केवल Super Admin के पास है!');
        return;
    }
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
        if (tabName === 'payments' || tabName === 'users' || tabName === 'support' || tabName === 'history') activeSection.className = 'space-y-4';
        if (tabName === 'create_user') activeSection.className = 'block';
        if (tabName === 'controls') activeSection.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    }
    if (tabName === 'payments') window.loadAllPayments();
    if (tabName === 'support') {
        window.populateSupportUserDropdown();
        window.renderSupportChatSidebar();
        if (!window.selectedChatTicketId && window.allSupportTickets.length > 0) window.selectSupportChatThread(window.allSupportTickets[0].id);
    }
    if (tabName === 'history') window.loadAdminHistory();
    if (tabName === 'controls') window.loadPortalSettingsForAdmin();
};

// ================= PORTAL SETTINGS & SECRET DOB API CONFIG =================
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
        if (snap.exists()) cfg = { ...cfg, ...snap.data() };

        if (document.getElementById('chkShowDomicile')) document.getElementById('chkShowDomicile').checked = cfg.showDomicile !== false;
        if (document.getElementById('chkShowCaste')) document.getElementById('chkShowCaste').checked = cfg.showCaste !== false;
        if (document.getElementById('chkShowEvoter')) document.getElementById('chkShowEvoter').checked = cfg.showEvoter !== false;
        if (document.getElementById('chkShowMinor')) document.getElementById('chkShowMinor').checked = cfg.showMinor !== false;
        if (document.getElementById('chkShowDobMinor')) document.getElementById('chkShowDobMinor').checked = cfg.showDobMinor !== false;
        if (document.getElementById('chkShowDobPrint')) document.getElementById('chkShowDobPrint').checked = cfg.showDobPrint !== false;
        if (document.getElementById('chkShowPassport')) document.getElementById('chkShowPassport').checked = cfg.showPassport !== false;
        if (document.getElementById('chkShowGazette')) document.getElementById('chkShowGazette').checked = cfg.showGazette !== false;
        if (document.getElementById('chkShowAnnexures')) document.getElementById('chkShowAnnexures').checked = cfg.showAnnexures !== false;

        if (document.getElementById('chkBannerEnabled')) document.getElementById('chkBannerEnabled').checked = !!cfg.bannerEnabled;
        if (document.getElementById('inpBannerBadge')) document.getElementById('inpBannerBadge').value = cfg.bannerBadge || 'UPDATE';
        if (document.getElementById('inpBannerTitle')) document.getElementById('inpBannerTitle').value = cfg.bannerTitle || '';
        if (document.getElementById('inpBannerMessage')) document.getElementById('inpBannerMessage').value = cfg.bannerMessage || '';
        if (document.getElementById('inpBannerBtnText')) document.getElementById('inpBannerBtnText').value = cfg.bannerBtnText || '';
        if (document.getElementById('inpBannerBtnLink')) document.getElementById('inpBannerBtnLink').value = cfg.bannerBtnLink || '';

        if (document.getElementById('chkBanner2Enabled')) document.getElementById('chkBanner2Enabled').checked = !!cfg.banner2Enabled;
        if (document.getElementById('inpBanner2Badge')) document.getElementById('inpBanner2Badge').value = cfg.banner2Badge || 'NOTICE';
        if (document.getElementById('inpBanner2Title')) document.getElementById('inpBanner2Title').value = cfg.banner2Title || '';
        if (document.getElementById('inpBanner2Message')) document.getElementById('inpBanner2Message').value = cfg.banner2Message || '';
        if (document.getElementById('inpBanner2BtnText')) document.getElementById('inpBanner2BtnText').value = cfg.banner2BtnText || '';
        if (document.getElementById('inpBanner2BtnLink')) document.getElementById('inpBanner2BtnLink').value = cfg.banner2BtnLink || '';

        const supWaEl = document.getElementById('inpSupportWhatsapp');
        if (supWaEl) supWaEl.value = cfg.supportWhatsapp || '919306437623';
        window.adminSupportWhatsapp = cfg.supportWhatsapp || '919306437623';
        window.updateStealthStatusPill();
        if (typeof window.loadDobPrintSecretApiConfig === 'function') window.loadDobPrintSecretApiConfig();
    } catch (err) {}
};

window.updateStealthStatusPill = function() {
    const d = document.getElementById('chkShowDomicile')?.checked;
    const c = document.getElementById('chkShowCaste')?.checked;
    const b = document.getElementById('chkShowEvoter')?.checked;
    const m = document.getElementById('chkShowDobMinor')?.checked;
    const pill = document.getElementById('stealthStatusBadge');
    if (!pill) return;
    if (!d && !c && !b && !m) {
        pill.className = "bg-red-100 text-red-700 border border-red-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase";
        pill.innerHTML = `<i class="fa-solid fa-eye-slash mr-1"></i>Stealth Active`;
    } else if (d && c && b && m) {
        pill.className = "bg-green-100 text-green-800 border border-green-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase";
        pill.innerHTML = `<i class="fa-solid fa-eye mr-1"></i>All Visible`;
    } else {
        pill.className = "bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase";
        pill.innerHTML = `<i class="fa-solid fa-sliders mr-1"></i>Custom Mode`;
    }
};

window.quickToggleAllCerts = async function(makeVisible) {
    if (document.getElementById('chkShowDomicile')) document.getElementById('chkShowDomicile').checked = makeVisible;
    if (document.getElementById('chkShowCaste')) document.getElementById('chkShowCaste').checked = makeVisible;
    if (document.getElementById('chkShowEvoter')) document.getElementById('chkShowEvoter').checked = makeVisible;
    if (document.getElementById('chkShowMinor')) document.getElementById('chkShowMinor').checked = makeVisible;
    if (document.getElementById('chkShowDobPrint')) document.getElementById('chkShowDobPrint').checked = makeVisible;
    if (document.getElementById('chkShowGazette')) document.getElementById('chkShowGazette').checked = makeVisible;
    if (document.getElementById('chkShowDobMinor')) document.getElementById('chkShowDobMinor').checked = makeVisible;
    if (document.getElementById('chkShowPassport')) document.getElementById('chkShowPassport').checked = makeVisible;
    if (document.getElementById('chkShowAnnexures')) document.getElementById('chkShowAnnexures').checked = makeVisible;
    await window.savePortalSettings();
};

window.savePortalSettings = async function(event) {
    if (event) event.preventDefault();
    const btn = document.getElementById('btnSavePortalConfig');
    const msg = document.getElementById('portalConfigMsg');
    const origText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...'; }

    const rawSupWa = document.getElementById('inpSupportWhatsapp')?.value.trim() || '919306437623';
    const cleanSupWa = window.formatCleanPhone(rawSupWa) || '919306437623';

    const payload = {
        showDomicile: document.getElementById('chkShowDomicile')?.checked !== false,
        showCaste: document.getElementById('chkShowCaste')?.checked !== false,
        showEvoter: document.getElementById('chkShowEvoter') ? document.getElementById('chkShowEvoter').checked : true,
        showMinor: document.getElementById('chkShowMinor') ? document.getElementById('chkShowMinor').checked : true,
        showDobMinor: document.getElementById('chkShowDobMinor') ? document.getElementById('chkShowDobMinor').checked : true,
        showDobDelhi: document.getElementById('chkShowDobMinor') ? document.getElementById('chkShowDobMinor').checked : true,
        showDobPrint: document.getElementById('chkShowDobPrint') ? document.getElementById('chkShowDobPrint').checked : true,
        showPassport: document.getElementById('chkShowPassport') ? document.getElementById('chkShowPassport').checked : true,
        showGazette: document.getElementById('chkShowGazette') ? document.getElementById('chkShowGazette').checked : true,
        showAnnexures: document.getElementById('chkShowAnnexures') ? document.getElementById('chkShowAnnexures').checked : true,

        bannerEnabled: !!document.getElementById('chkBannerEnabled')?.checked,
        bannerBadge: document.getElementById('inpBannerBadge')?.value.trim() || 'UPDATE',
        bannerTitle: document.getElementById('inpBannerTitle')?.value.trim() || '',
        bannerMessage: document.getElementById('inpBannerMessage')?.value.trim() || '',
        bannerBtnText: document.getElementById('inpBannerBtnText')?.value.trim() || '',
        bannerBtnLink: document.getElementById('inpBannerBtnLink')?.value.trim() || '',

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
        window.updateStealthStatusPill();
        if (typeof window.loadDobPrintSecretApiConfig === 'function') window.loadDobPrintSecretApiConfig();
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

window.loadDobPrintSecretApiConfig = async function() {
    if (window.currentUserData?.isSubAdmin && !window.currentUserData?.isSuperAdmin) return;
    try {
        const snap = await getDoc(doc(db, "adminSecrets", "dobPrintConfig"));
        if (snap.exists()) {
            const d = snap.data();
            if (document.getElementById('inpSecretDobApiUrl')) document.getElementById('inpSecretDobApiUrl').value = d.baseUrl || '';
            if (document.getElementById('inpSecretDobApiKey')) document.getElementById('inpSecretDobApiKey').value = d.apiKey || '';
            if (document.getElementById('inpSecretDobApplyService')) document.getElementById('inpSecretDobApplyService').value = d.applyService || 'b-number-pdf-apply';
            if (document.getElementById('inpSecretDobStatusService')) document.getElementById('inpSecretDobStatusService').value = d.statusService || 'b-number-pdf-status';
            if (document.getElementById('inpSecretDobCreditCost')) document.getElementById('inpSecretDobCreditCost').value = d.creditCost || 140;
        }
    } catch (e) {}
};

window.saveDobPrintSecretApiConfig = async function() {
    if (window.currentUserData?.isSubAdmin && !window.currentUserData?.isSuperAdmin) return alert('⛔ केवल Super Admin ही API सेटिंग्स देख या बदल सकते हैं।');
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
