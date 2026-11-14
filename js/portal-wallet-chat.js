// === THEME MANAGER (DARK / LIGHT MODE) ===
window.initTheme = function() {
    const saved = localStorage.getItem('ojas_theme');
    const isDark = saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
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
            ? '<i class="fa-solid fa-sun text-amber-400 text-sm md:text-base"></i>'
            : '<i class="fa-solid fa-moon text-royal-300 text-sm md:text-base"></i>';
        btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.initTheme);
else window.initTheme();

// ============================================================================
// FILE: js/portal-wallet-chat.js (Portal Entry: Auth, Dashboard, Visibility & Tab Router)
// ============================================================================

import "./config-templates.js?v=9.1";
import "./portal-forms.js?v=9.1";
import "./portal-wallet-payments.js?v=9.1";
import "./portal-chat-history.js?v=9.1";

const {
    auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    doc, getDoc, setDoc, updateDoc, onSnapshot
} = window.fb;

window.currentUserData = null;
window.historyData = [];
window.userPaymentsData = [];
window.userPassbookEntries = [];
window.currentPassbookFilter = 'ALL';
window.currentActiveTab = 'domicile';
window.vipCountdownInterval = null;
window.portalSettingsUnsubscribe = null;
window.userProfileUnsubscribe = null;
window.userChatUnsubscribe = null;
window.activePaymentUnsubscribe = null;
window.currentActiveOrderId = null;
window.currentRzpOrderData = null;
window.isCreditingInProgress = false;
window.currentUserChatData = { messages: [], unreadByUser: false };

window.portalConfigState = {
    showDomicile: true, showCaste: true, showEvoter: true, showMinor: true,
    showDobMinor: true, showDobDelhi: true, showDobPrint: true, showPassport: true,
    showGazette: true, showAnnexures: true,
    bannerEnabled: false, bannerBadge: "UPDATE", bannerTitle: "",
    bannerMessage: "", bannerBtnText: "", bannerBtnLink: "",
    banner2Enabled: false, banner2Badge: "NOTICE", banner2Title: "",
    banner2Message: "", banner2BtnText: "", banner2BtnLink: ""
};

window.currentRechargeCredits = 0;
window.currentTotalPayable = 0;
window.currentWantsVip = false;
window.currentVipDays = 0;
window.currentVipPlanFee = 0;

window.canCurrentUserSeeService = function(srv) {
    const cfg = window.portalConfigState || {};
    const u = window.currentUserData;
    if (!u) return false;

    if (srv === 'domicile') return cfg.showDomicile !== false && u.allowDomicile !== false;
    if (srv === 'caste') return cfg.showCaste !== false && u.allowCaste !== false;
    if (srv === 'evoter' || srv === 'e-voter') return cfg.showEvoter !== false && u.allowEvoter !== false;
    if (srv === 'dob18' || srv === 'dob_meerut') return false;
    if (srv === 'dob_minor' || srv === 'dob_delhi') return cfg.showDobMinor !== false && (cfg.showDobDelhi !== false) && u.allowDobMinor !== false && (u.allowDobDelhi !== false);
    if (srv === 'passport') return cfg.showPassport !== false && u.allowPassport !== false;
    if (srv === 'gazette') return cfg.showGazette !== false && u.allowGazette !== false;
    if (srv === 'dob_print') return cfg.showDobPrint !== false && u.allowDobPrint !== false;
    if (srv === 'annexures' || srv.startsWith('annexure')) return cfg.showAnnexures !== false && u.allowAnnexures !== false;
    if (srv === 'minor' || srv === 'dob') return cfg.showMinor !== false && u.allowMinor !== false;

    return true;
};

window.getFirstAllowedTab = function() {
    return 'home';
};
window.getFirstAllowedServiceTab = function() {
    if (window.canCurrentUserSeeService('domicile')) return 'domicile';
    if (window.canCurrentUserSeeService('caste')) return 'caste';
    if (window.canCurrentUserSeeService('evoter')) return 'evoter';
    if (window.canCurrentUserSeeService('minor')) return 'minor';
    if (window.canCurrentUserSeeService('dob_delhi')) return 'dob_delhi';
    if (window.canCurrentUserSeeService('dob_print')) return 'dob_print';
    if (window.canCurrentUserSeeService('passport')) return 'passport';
    if (window.canCurrentUserSeeService('gazette')) return 'gazette';
    if (window.canCurrentUserSeeService('annexures')) return 'annexure1';
    return 'history';
};

window.notifyAdminSecurely = async function(payload) {
    try {
        await fetch('/api/notify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {}
};

window.syncUserProfileHeaderUI = function(u) {
    if (!u) return;
    const nameEl = document.getElementById('displayUser');
    const emailEl = document.getElementById('gearUserEmail');
    const avatarEl = document.getElementById('gearUserAvatar');
    if (nameEl) nameEl.innerText = u.fullName ? u.fullName : (u.username || 'User').toUpperCase();
    if (emailEl) emailEl.innerText = u.contactEmail || u.email || '';
    if (avatarEl) avatarEl.src = u.profilePhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
};

function startUserProfileListener(uid) {
    if (window.userProfileUnsubscribe) window.userProfileUnsubscribe();
    window.userProfileUnsubscribe = onSnapshot(doc(db, "users", uid), (snap) => {
        if (!snap.exists() || !window.currentUserData) return;
        const data = snap.data();
        window.currentUserData.credits = data.credits || 0;
        window.currentUserData.fullName = data.fullName || data.name || window.currentUserData.fullName || '';
        window.currentUserData.contactEmail = data.contactEmail || data.email || window.currentUserData.contactEmail || '';
        window.currentUserData.profilePhoto = data.profilePhoto || data.photoURL || window.currentUserData.profilePhoto || '';
        window.currentUserData.phone = data.phone || data.mobile || data.phoneNumber || window.currentUserData.phone || '';
        window.syncUserProfileHeaderUI(window.currentUserData);

        window.currentUserData.allowEvoter = data.allowEvoter !== false;
        window.currentUserData.allowMinor = data.allowMinor !== false;
        window.currentUserData.allowDomicile = data.allowDomicile !== false;
        window.currentUserData.allowCaste = data.allowCaste !== false;
        window.currentUserData.allowDobMinor = data.allowDobMinor !== false;
        window.currentUserData.allowDobDelhi = data.allowDobDelhi !== false;
        window.currentUserData.allowPassport = data.allowPassport !== false;
        window.currentUserData.allowGazette = data.allowGazette !== false;
        window.currentUserData.allowDobPrint = data.allowDobPrint !== false;
        window.currentUserData.allowAnnexures = data.allowAnnexures !== false;

        window.currentUserData.personalBannerEnabled = !!data.personalBannerEnabled;
        window.currentUserData.personalBannerBadge = data.personalBannerBadge || "NOTICE";
        window.currentUserData.personalBannerTitle = data.personalBannerTitle || "";
        window.currentUserData.personalBannerMessage = data.personalBannerMessage || "";
        window.currentUserData.personalBannerBtnText = data.personalBannerBtnText || "";
        window.currentUserData.personalBannerBtnLink = data.personalBannerBtnLink || "";

        const creditEl = document.getElementById('displayCredits');
        if (creditEl) creditEl.innerText = window.currentUserData.credits;
        const sumBalEl = document.getElementById('sumCurrentBalance');
        if (sumBalEl) sumBalEl.innerText = `${window.currentUserData.credits} Cr`;

        const now = Date.now();
        const isNowVip = window.currentUserData.hasFreeAccess || (data.isVip && (!data.vipExpiry || data.vipExpiry > now));
        const vipChanged = window.currentUserData.isVip !== isNowVip;
        window.currentUserData.isVip = isNowVip;
        window.currentUserData.vipExpiry = window.currentUserData.hasFreeAccess ? 0 : (data.vipExpiry || 0);
        if (vipChanged) setupDashboard(window.currentUserData);
        else window.applyLivePortalControls();
    });
}

function startPortalSettingsListener() {
    if (window.portalSettingsUnsubscribe) window.portalSettingsUnsubscribe();
    window.portalSettingsUnsubscribe = onSnapshot(doc(db, "settings", "portalConfig"), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            window.portalConfigState = {
                showDomicile: data.showDomicile !== false, showCaste: data.showCaste !== false,
                showEvoter: data.showEvoter !== false, showMinor: data.showMinor !== false,
                showDobMinor: data.showDobMinor !== false, showDobDelhi: data.showDobDelhi !== false,
                showPassport: data.showPassport !== false, showGazette: data.showGazette !== false,
                showDobPrint: data.showDobPrint !== false, showAnnexures: data.showAnnexures !== false,
                bannerEnabled: !!data.bannerEnabled, bannerBadge: data.bannerBadge || "UPDATE",
                bannerTitle: data.bannerTitle || "", bannerMessage: data.bannerMessage || "",
                bannerBtnText: data.bannerBtnText || "", bannerBtnLink: data.bannerBtnLink || "",
                banner2Enabled: !!data.banner2Enabled, banner2Badge: data.banner2Badge || "NOTICE",
                banner2Title: data.banner2Title || "", banner2Message: data.banner2Message || "",
                banner2BtnText: data.banner2BtnText || "", banner2BtnLink: data.banner2BtnLink || ""
            };
        }
        window.applyLivePortalControls();
    });
}

// ================= CSC / e-MITRA STYLE SERVICE CARDS REGISTRY =================
// (Nayi service add karne ke liye bas is array mein 1 object jodein)
window.PORTAL_SERVICE_CARDS = [
    {
        id: 'domicile',
        title: 'Domicile Certificate',
        subtitle: 'मूल निवास प्रमाण पत्र',
        desc: 'UP e-District सामान्य निवास प्रमाण पत्र जनरेट करें',
        cost: '₹10',
        icon: 'fa-house-chimney',
        color: 'blue',
        check: () => window.canCurrentUserSeeService('domicile')
    },
    {
        id: 'caste',
        title: 'Caste Certificate',
        subtitle: 'जाति प्रमाण पत्र',
        desc: 'UP e-District पिछड़ी जाति प्रमाण पत्र जनरेट करें',
        cost: '₹10',
        icon: 'fa-users',
        color: 'indigo',
        check: () => window.canCurrentUserSeeService('caste')
    },
    {
        id: 'evoter',
        title: 'e-Voter ID Card',
        subtitle: 'ई-वोटर पहचान पत्र',
        desc: 'डिजिटल वोटर आईडी कार्ड तुरंत प्रिंट व डाउनलोड करें',
        cost: '₹10',
        icon: 'fa-id-card-clip',
        color: 'emerald',
        check: () => window.canCurrentUserSeeService('evoter')
    },
    {
        id: 'dob_hub',
        target: () => {
            if (window.canCurrentUserSeeService('minor')) return 'minor';
            if (window.canCurrentUserSeeService('dob_delhi')) return 'dob_delhi';
            if (window.canCurrentUserSeeService('dob_baraut')) return 'dob_baraut';
            return 'home';
        },
        title: 'Birth Certificate (DOB)',
        subtitle: 'जन्म प्रमाण पत्र (Minor / Delhi / Baraut)',
        desc: 'DOB Minor, DOB Delhi (MCD) और DOB Baraut एक साथ',
        cost: '₹50',
        icon: 'fa-cake-candles',
        color: 'amber',
        check: () => window.canCurrentUserSeeService('minor') || window.canCurrentUserSeeService('dob_delhi') || window.canCurrentUserSeeService('dob_baraut')
    },
    {
        id: 'dob_print',
        title: 'DOB Original PDF',
        subtitle: 'ओरिजिनल DOB सर्टिफिकेट (API)',
        desc: 'रजिस्ट्रेशन नंबर से डायरेक्ट ओरिजिनल जन्म प्रमाण पत्र PDF निकालें',
        cost: '₹140',
        icon: 'fa-file-pdf',
        color: 'teal',
        check: () => window.canCurrentUserSeeService('dob_print')
    },
    {
        id: 'passport',
        title: 'Passport Services',
        subtitle: 'पासपोर्ट प्रिंट सर्विस',
        desc: 'ऑटो MRZ व फोटो ब्लेंडिंग के साथ पासपोर्ट पेज तैयार करें',
        cost: '₹30',
        icon: 'fa-passport',
        color: 'sky',
        check: () => window.canCurrentUserSeeService('passport')
    },
    {
        id: 'gazette',
        title: 'Gazette Notification',
        subtitle: 'भारत का राजपत्र (Name Change)',
        desc: 'नाम परिवर्तन हेतु ऑफिशियल गैजेट नोटिफिकेशन तैयार करें',
        cost: '₹100',
        icon: 'fa-newspaper',
        color: 'purple',
        check: () => window.canCurrentUserSeeService('gazette')
    },
    {
        id: 'annexure1',
        title: 'Annexure I & IA',
        subtitle: 'जन्म तिथि सुधार (Adults / Children)',
        desc: 'DOB Update / Correction के लिए Annexure I व IA शपथ पत्र',
        cost: '₹10',
        icon: 'fa-file-signature',
        color: 'teal',
        check: () => window.canCurrentUserSeeService('annexures')
    },
    {
        id: 'annexure3',
        title: 'Annexure III & IIIA',
        subtitle: 'आधार रीएक्टिवेशन (Adults / Children)',
        desc: 'निष्क्रिय आधार चालू कराने हेतु Annexure III व IIIA फॉर्म',
        cost: '₹10',
        icon: 'fa-bolt',
        color: 'rose',
        check: () => window.canCurrentUserSeeService('annexures')
    },
    {
        id: 'annexureb',
        title: 'Annexure B, C & D',
        subtitle: 'नाम सुधार व विवाह पश्चात शपथ पत्र',
        desc: 'Adult, Child व Marriage Name Update हेतु Annexure B/C/D',
        cost: '₹10',
        icon: 'fa-file-contract',
        color: 'cyan',
        check: () => window.canCurrentUserSeeService('annexures')
    },
    {
        id: 'annexuree',
        title: 'Annexure E & F',
        subtitle: 'उर्फ / उपनाम हटाने का शपथ पत्र',
        desc: 'Adults (E) और Children (F) के Urf/Alias Removal फॉर्म',
        cost: '₹10',
        icon: 'fa-scissors',
        color: 'orange',
        check: () => window.canCurrentUserSeeService('annexures')
    },
    {
        id: 'tools_studio',
        externalUrl: '/tools',
        title: 'Tools Studio',
        subtitle: 'PDF & Photo Tools',
        desc: 'फोटो साइज़, मर्ज व PDF टूल्स स्टूडियो खोलें',
        cost: 'Free Tools',
        icon: 'fa-toolbox',
        color: 'sky',
        check: () => true
    }
];

window.filterPortalHomeCards = function(queryStr = '') {
    const q = String(queryStr || '').trim().toLowerCase();
    document.querySelectorAll('.portal-service-card').forEach(card => {
        const txt = (card.dataset.search || '').toLowerCase();
        card.style.display = (!q || txt.includes(q)) ? 'flex' : 'none';
    });
};

window.renderHomeDashboard = function() {
    const container = document.getElementById('formContainer');
    if (!container) return;
    const u = window.currentUserData || {};
    const colorMap = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200 hover:border-blue-500', badge: 'bg-blue-100 text-blue-800' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200 hover:border-indigo-500', badge: 'bg-indigo-100 text-indigo-800' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200 hover:border-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200 hover:border-amber-500', badge: 'bg-amber-100 text-amber-900' },
        sky: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200 hover:border-sky-500', badge: 'bg-sky-100 text-sky-800' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200 hover:border-purple-500', badge: 'bg-purple-100 text-purple-800' },
        teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200 hover:border-teal-500', badge: 'bg-teal-100 text-teal-800' },
        rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200 hover:border-rose-500', badge: 'bg-rose-100 text-rose-800' },
        cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200 hover:border-cyan-500', badge: 'bg-cyan-100 text-cyan-800' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200 hover:border-orange-500', badge: 'bg-orange-100 text-orange-800' }
    };

    const visibleServiceCards = window.PORTAL_SERVICE_CARDS.filter(c => c.check());
    const serviceCardsHtml = visibleServiceCards.map(card => {
        const cm = colorMap[card.color] || colorMap.blue;
        const targetService = typeof card.target === 'function' ? card.target() : card.id;
        const clickAction = card.externalUrl ? `window.open('${card.externalUrl}', '_blank')` : `window.switchService('${targetService}')`;
        return `
        <button type="button" onclick="${clickAction}" data-search="${card.title} ${card.subtitle} ${card.desc}"
            class="portal-service-card group relative bg-white hover:bg-slate-50/80 rounded-2xl border ${cm.border} p-2.5 pt-5 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left gap-1.5 sm:gap-3">
            <!-- Mobile: Top-right corner mini price badge -->
            <span class="sm:hidden absolute top-1.5 right-1.5 ${cm.badge} px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none shadow-sm">${card.cost}</span>
            <div class="flex items-center sm:items-start justify-center sm:justify-between gap-2 w-full">
                <div class="w-11 h-11 rounded-2xl sm:rounded-xl ${cm.bg} ${cm.text} flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition shadow-xs">
                    <i class="fa-solid ${card.icon}"></i>
                </div>
                <span class="hidden sm:inline-block ${cm.badge} px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">${card.cost}</span>
            </div>
            <div class="w-full">
                <h4 class="text-[11px] sm:text-sm font-black text-dark-900 group-hover:text-royal-700 transition leading-tight">${card.title}</h4>
                <p class="hidden sm:block text-[11px] font-bold text-slate-600 mt-0.5">${card.subtitle}</p>
                <p class="hidden sm:block text-[11px] text-slate-400 mt-1 line-clamp-2">${card.desc}</p>
            </div>
            <div class="hidden sm:flex pt-2 border-t border-slate-100 w-full items-center justify-between text-[11px] font-black text-royal-600">
                <span>Apply / Generate</span>
                <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition"></i>
            </div>
        </button>`;
    }).join('');

    container.innerHTML = `
        <div class="space-y-6">
            <!-- Compact Search Bar -->
            <div class="relative">
                <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                <input type="text" id="portalCardSearchInput" oninput="window.filterPortalHomeCards(this.value)" placeholder="सर्विस खोजें (Search Service)..." class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-dark-900 placeholder-slate-400 text-xs font-bold outline-none focus:bg-white focus:border-royal-500 transition">
            </div>

            <!-- Section 1: Certificate & Document Services -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-xs md:text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span class="w-2 h-5 bg-royal-500 rounded-full inline-block"></span>
                        Certificate &amp; Document Services (${visibleServiceCards.length})
                    </h4>
                </div>
                <div class="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                    ${serviceCardsHtml || '<div class="col-span-full p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-slate-200">कोई भी सर्विस वर्तमान में सक्रिय नहीं है।</div>'}
                </div>
            </div>

        </div>
    `;
};

window.applyLivePortalControls = function() {
    const cfg = window.portalConfigState || {};
    const canDom = window.canCurrentUserSeeService('domicile');
    const canCas = window.canCurrentUserSeeService('caste');
    const canEvoter = window.canCurrentUserSeeService('evoter');
    const canDobDelhi = window.canCurrentUserSeeService('dob_delhi');
    const canDobBaraut = window.canCurrentUserSeeService('dob_baraut');
    const canPassport = window.canCurrentUserSeeService('passport');
    const canGazette = window.canCurrentUserSeeService('gazette');
    const canDobPrint = window.canCurrentUserSeeService('dob_print');
    const canAnnexures = window.canCurrentUserSeeService('annexures');
    const canMinor = window.canCurrentUserSeeService('minor');

    const bannerBox = document.getElementById('liveUpdateBannerContainer');
    if (bannerBox) {
        let bannersHtml = '';
        const u = window.currentUserData;
        if (u && u.personalBannerEnabled && u.personalBannerMessage) {
            const displayName = typeof window.extractUserDisplayName === 'function'
                ? window.extractUserDisplayName(u.email, u.username)
                : (u.username || u.email.split('@')[0]);
            const pBtnHtml = (u.personalBannerBtnText && u.personalBannerBtnLink)
                ? `<a href="${u.personalBannerBtnLink}" target="_blank" class="bg-amber-400 hover:bg-amber-300 text-dark-950 font-black px-3.5 py-1.5 rounded-xl text-[11px] transition shrink-0 shadow-sm flex items-center gap-1">${u.personalBannerBtnText} <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i></a>`
                : '';
            bannersHtml += `
                <div class="p-3.5 md:p-4 rounded-2xl bg-gradient-to-r from-dark-950 via-slate-900 to-amber-950 text-white border-2 border-amber-400 shadow-xl mb-2.5 relative overflow-hidden">
                    <div class="relative z-10 space-y-1.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="bg-amber-400 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"><i class="fa-solid fa-user-tag mr-1"></i>${u.personalBannerBadge || 'PERSONAL NOTICE'}</span>
                                <h4 class="text-xs md:text-sm font-black text-amber-300 flex items-center gap-1.5"><span>डियर ${displayName}</span>${u.personalBannerTitle ? `<span class="text-slate-200 font-semibold">• ${u.personalBannerTitle}</span>` : ''}</h4>
                            </div>
                            ${pBtnHtml}
                        </div>
                        <p class="text-xs md:text-sm font-bold text-slate-100 whitespace-pre-line leading-relaxed pl-0.5">${u.personalBannerMessage}</p>
                    </div>
                </div>`;
        }
        if (cfg.bannerEnabled && (cfg.bannerTitle || cfg.bannerMessage)) {
            const btnHtml = (cfg.bannerBtnText && cfg.bannerBtnLink)
                ? `<a href="${cfg.bannerBtnLink}" target="_blank" class="bg-amber-400 hover:bg-amber-300 text-dark-950 font-black px-3.5 py-1.5 rounded-xl text-[11px] transition shrink-0 shadow-sm">${cfg.bannerBtnText} <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[9px]"></i></a>`
                : '';
            bannersHtml += `
                <div class="p-3.5 rounded-2xl bg-gradient-to-r from-dark-950 via-slate-900 to-indigo-950 text-white border border-royal-400/60 shadow-md mb-2">
                    <div class="flex flex-wrap items-center justify-between gap-2.5">
                        <div class="flex items-start sm:items-center gap-2.5">
                            <span class="bg-royal-500 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0"><i class="fa-solid fa-bullhorn mr-1"></i>${cfg.bannerBadge || 'UPDATE'}</span>
                            <div>${cfg.bannerTitle ? `<h4 class="text-xs md:text-sm font-black text-royal-300">${cfg.bannerTitle}</h4>` : ''}${cfg.bannerMessage ? `<p class="text-[11px] font-semibold text-slate-200 mt-0.5">${cfg.bannerMessage}</p>` : ''}</div>
                        </div>
                        ${btnHtml}
                    </div>
                </div>`;
        }
        if (cfg.banner2Enabled && (cfg.banner2Title || cfg.banner2Message)) {
            const btn2Html = (cfg.banner2BtnText && cfg.banner2BtnLink)
                ? `<a href="${cfg.banner2BtnLink}" target="_blank" class="bg-emerald-400 hover:bg-emerald-300 text-dark-950 font-black px-3.5 py-1.5 rounded-xl text-[11px] transition shrink-0 shadow-sm">${cfg.banner2BtnText} <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[9px]"></i></a>`
                : '';
            bannersHtml += `
                <div class="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 text-white border border-emerald-400/60 shadow-md">
                    <div class="flex flex-wrap items-center justify-between gap-2.5">
                        <div class="flex items-start sm:items-center gap-2.5">
                            <span class="bg-emerald-400 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0"><i class="fa-solid fa-bell mr-1"></i>${cfg.banner2Badge || 'NOTICE'}</span>
                            <div>${cfg.banner2Title ? `<h4 class="text-xs md:text-sm font-black text-emerald-300">${cfg.banner2Title}</h4>` : ''}${cfg.banner2Message ? `<p class="text-[11px] font-semibold text-slate-200 mt-0.5">${cfg.banner2Message}</p>` : ''}</div>
                        </div>
                        ${btn2Html}
                    </div>
                </div>`;
        }
        bannerBox.style.display = bannersHtml ? 'block' : 'none';
        bannerBox.innerHTML = bannersHtml;
    }

    const stdGrid = document.getElementById('standardServicesGrid');
    const btnDom = document.getElementById('btn-domicile');
    const btnCas = document.getElementById('btn-caste');
    const btnEvoter = document.getElementById('btn-evoter');
    const btnDobDelhi = document.getElementById('btn-dob_delhi') || document.getElementById('btn-dob_minor');
    const btnDobBaraut = document.getElementById('btn-dob_baraut');
    const btnPassport = document.getElementById('btn-passport');
    const btnGazette = document.getElementById('btn-gazette');
    const btnDobPrint = document.getElementById('btn-dob_print');
    const btnAnnexures = document.getElementById('btn-annexures');
    const btnMinor = document.getElementById('btn-minor');
    const vipServicesBar = document.getElementById('vipServicesBar');
    const vipHeaderLabel = document.getElementById('vipBarTitleLabel');

    if (btnDom) btnDom.style.setProperty('display', canDom ? 'flex' : 'none', 'important');
    if (btnCas) btnCas.style.setProperty('display', canCas ? 'flex' : 'none', 'important');
    if (btnEvoter) btnEvoter.style.setProperty('display', canEvoter ? 'flex' : 'none', 'important');
    if (btnDobDelhi) btnDobDelhi.style.setProperty('display', canDobDelhi ? 'flex' : 'none', 'important');
    if (btnDobBaraut) btnDobBaraut.style.setProperty('display', canDobBaraut ? 'flex' : 'none', 'important');
    if (btnPassport) btnPassport.style.setProperty('display', canPassport ? 'flex' : 'none', 'important');
    if (btnGazette) btnGazette.style.setProperty('display', canGazette ? 'flex' : 'none', 'important');
    if (btnDobPrint) btnDobPrint.style.setProperty('display', canDobPrint ? 'flex' : 'none', 'important');
    if (btnAnnexures) btnAnnexures.style.setProperty('display', canAnnexures ? 'flex' : 'none', 'important');
    if (btnMinor) btnMinor.style.setProperty('display', canMinor ? 'flex' : 'none', 'important');

    const btnEvoterMain = document.getElementById('btn-evoter-main');
    if (btnEvoterMain) btnEvoterMain.style.setProperty('display', canEvoter ? 'flex' : 'none', 'important');
    if (stdGrid) {
        const visibleStdCount = (canDom ? 1 : 0) + (canCas ? 1 : 0) + (canEvoter ? 1 : 0);
        if (visibleStdCount === 0) stdGrid.style.setProperty('display', 'none', 'important');
        else {
            stdGrid.style.setProperty('display', 'grid', 'important');
            stdGrid.className = visibleStdCount === 3 ? "grid grid-cols-3 gap-1.5 sm:gap-2.5 mb-2.5" : (visibleStdCount === 2 ? "grid grid-cols-2 gap-2.5 mb-3" : "grid grid-cols-1 gap-2.5 mb-3");
        }
    }

    if (vipServicesBar) {
        const anyOtherAllowed = canMinor || canDobPrint || canDobDelhi || canPassport || canGazette || canAnnexures;
        vipServicesBar.style.setProperty('display', anyOtherAllowed ? 'block' : 'none', 'important');
    }

    if (vipHeaderLabel) vipHeaderLabel.innerHTML = `<i class="fa-solid fa-layer-group text-royal-400"></i> Other Portal Services (DOB, DOB Original PDF, Gazette, Passport &amp; Annexures)`;

    const cur = window.currentActiveTab;
    if (cur === 'home') { window.renderHomeDashboard(); return; }
    if ((cur === 'domicile' && !canDom) || (cur === 'caste' && !canCas) ||
        ((cur === 'evoter' || cur === 'e-voter') && !canEvoter) ||
        ((cur === 'dob_delhi' || cur === 'dob_minor') && !canDobDelhi) ||
        (cur === 'dob_baraut' && !canDobBaraut) ||
        (cur === 'passport' && !canPassport) || (cur === 'gazette' && !canGazette) ||
        (cur === 'dob_print' && !canDobPrint) || (cur === 'minor' && !canMinor) ||
        (cur.startsWith('annexure') && !canAnnexures)) {
        window.switchService(window.getFirstAllowedTab());
    }
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('gearDropdownMenu');
    const btn = document.getElementById('gearMenuBtn');
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
});

window.toggleGearMenu = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('gearDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
};

window.selectGearOption = function(serviceName) {
    const menu = document.getElementById('gearDropdownMenu');
    if (menu) menu.classList.add('hidden');
    window.switchService(serviceName);
};

onAuthStateChanged(auth, async (user) => {
    const shield = document.getElementById('portalStealthShield');
    if (shield) shield.remove();
    document.body.style.display = 'flex';
    if (window.history && window.history.replaceState) {
        try { window.history.replaceState(null, document.title, '/portal'); } catch(e){}
    }
    const loadingScreen = document.getElementById('loadingScreen');
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    if (user) {
        try {
            const emailLower = user.email.trim().toLowerCase();
            if (!window.isAllowedPortalEmail(emailLower)) {
                await signOut(auth);
                if (loadingScreen) loadingScreen.style.display = 'none';
                alert("अमान्य आईडी! पोर्टल पर केवल @print.com डोमेन वाली आईडी ही मान्य है।");
                return;
            }
            try {
                const cfgSnap = await getDoc(doc(db, "settings", "portalConfig"));
                if (cfgSnap.exists()) {
                    const d = cfgSnap.data();
                    window.portalConfigState = {
                        showDomicile: d.showDomicile !== false, showCaste: d.showCaste !== false,
                        showEvoter: d.showEvoter !== false, showMinor: d.showMinor !== false,
                        showDobMinor: d.showDobMinor !== false, showDobDelhi: d.showDobDelhi !== false,
                        showPassport: d.showPassport !== false, showGazette: d.showGazette !== false,
                        showDobPrint: d.showDobPrint !== false, showAnnexures: d.showAnnexures !== false,
                        bannerEnabled: !!d.bannerEnabled, bannerBadge: d.bannerBadge || "UPDATE",
                        bannerTitle: d.bannerTitle || "", bannerMessage: d.bannerMessage || "",
                        bannerBtnText: d.bannerBtnText || "", bannerBtnLink: d.bannerBtnLink || "",
                        banner2Enabled: !!d.banner2Enabled, banner2Badge: d.banner2Badge || "NOTICE",
                        banner2Title: d.banner2Title || "", banner2Message: d.banner2Message || "",
                        banner2BtnText: d.banner2BtnText || "", banner2BtnLink: d.banner2BtnLink || ""
                    };
                }
            } catch (e) {}

            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            let userCredits = 0, isVip = false, vipExpiry = 0, allowEvoter = true, allowMinor = true, allowDomicile = true, allowCaste = true, allowDobMinor = true, allowDobDelhi = true, allowPassport = true, allowGazette = true, allowDobPrint = true, allowAnnexures = true, personalBannerEnabled = false, personalBannerBadge = 'NOTICE', personalBannerTitle = '', personalBannerMessage = '', personalBannerBtnText = '', personalBannerBtnLink = '', fullName = '', phone = '', contactEmail = '', profilePhoto = '';

            if (userDoc.exists()) {
                const data = userDoc.data();
                userCredits = data.credits || 0;
                isVip = data.isVip || false;
                vipExpiry = data.vipExpiry || 0;
                allowEvoter = data.allowEvoter !== false;
                allowMinor = data.allowMinor !== false;
                allowDomicile = data.allowDomicile !== false;
                allowCaste = data.allowCaste !== false;
                allowDobMinor = data.allowDobMinor !== false;
                allowDobDelhi = data.allowDobDelhi !== false;
                allowPassport = data.allowPassport !== false;
                allowGazette = data.allowGazette !== false;
                allowDobPrint = data.allowDobPrint !== false;
                allowAnnexures = data.allowAnnexures !== false;
                personalBannerEnabled = !!data.personalBannerEnabled;
                personalBannerBadge = data.personalBannerBadge || 'NOTICE';
                personalBannerTitle = data.personalBannerTitle || '';
                personalBannerMessage = data.personalBannerMessage || '';
                personalBannerBtnText = data.personalBannerBtnText || '';
                personalBannerBtnLink = data.personalBannerBtnLink || '';
                fullName = data.fullName || data.name || '';
                phone = data.phone || data.mobile || data.phoneNumber || '';
                contactEmail = data.contactEmail || data.email || user.email || '';
                profilePhoto = data.profilePhoto || data.photoURL || '';
            }

            const isSuperAdmin = window.isSuperAdminEmail ? window.isSuperAdminEmail(emailLower) : (emailLower === window.ADMIN_EMAIL.toLowerCase() || emailLower === 'ovi@print.com');
            const isSubAdmin = window.isSubAdminEmail ? window.isSubAdminEmail(emailLower) : (emailLower === 'prince@gmail.com' || emailLower === 'prince@print.com');
            const isAdmin = isSuperAdmin || isSubAdmin;
            const isFreeVip = window.FREE_VIP_EMAILS.map(e => e.toLowerCase()).includes(emailLower);
            const hasFreeAccess = isSuperAdmin;
            const now = Date.now();

            if (!hasFreeAccess && isVip && vipExpiry > 0 && vipExpiry <= now) {
                isVip = false;
                vipExpiry = 0;
                await updateDoc(userDocRef, { isVip: false, vipExpiry: 0 });
            }

            window.currentUserData = {
                uid: user.uid, email: user.email, credits: userCredits,
                isVip: isVip || hasFreeAccess, vipExpiry: hasFreeAccess ? 0 : vipExpiry,
                allowEvoter, allowMinor, allowDomicile, allowCaste, allowDobMinor, allowDobDelhi,
                allowPassport, allowGazette, allowDobPrint, allowAnnexures,
                personalBannerEnabled, personalBannerBadge, personalBannerTitle,
                personalBannerMessage, personalBannerBtnText, personalBannerBtnLink,
                isAdmin, isFreeVip, hasFreeAccess, username: user.email.split('@')[0],
                fullName, phone, contactEmail: contactEmail || user.email, profilePhoto
            };

            setupDashboard(window.currentUserData);
            startPortalSettingsListener();
            startUserProfileListener(user.uid);
            window.startUserSupportChatListener(user.uid);
            startVipCountdownLoop();
            if (loadingScreen) loadingScreen.style.display = 'none';

            const urlParams = new URLSearchParams(window.location.search);
            const editAnnexureParam = urlParams.get('editAnnexure');
            if (editAnnexureParam && window.currentUserData && window.currentUserData.isAdmin) {
                setTimeout(async () => {
                    if (window.historyData && window.historyData.length === 0) await window.loadUserHistory();
                    window.editAnnexureRecord(editAnnexureParam);
                }, 800);
            }
        } catch (err) {
            console.error('Portal auth init error:', err);
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (loginSection) loginSection.style.display = 'flex';
            await signOut(auth);
        }
    } else {
        if (window.vipCountdownInterval) clearInterval(window.vipCountdownInterval);
        if (window.portalSettingsUnsubscribe) window.portalSettingsUnsubscribe();
        if (window.userProfileUnsubscribe) window.userProfileUnsubscribe();
        if (window.userChatUnsubscribe) window.userChatUnsubscribe();
        if (window.activePaymentUnsubscribe) window.activePaymentUnsubscribe();

        sessionStorage.removeItem('ojas_separate_admin_verified');
        window.currentUserData = null;
        document.body.classList.remove('vip-body-bg');
        const _ca = document.getElementById('vipCornerAlert');
        if (_ca) _ca.style.display = 'none';
        if (loginSection) loginSection.style.display = 'flex';
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (loadingScreen) loadingScreen.style.display = 'none';
    }
});

window.handleLogin = async function(event) {
    event.preventDefault();
    const emailInput = document.getElementById('loginUsername').value.trim().toLowerCase();
    const passInput = document.getElementById('loginPassword').value.trim();
    const errorDiv = document.getElementById('loginError');
    const loginBtn = event.target.querySelector('button[type="submit"]');
    errorDiv.style.display = 'none';
    const email = emailInput.includes('@') ? emailInput : `${emailInput}@print.com`;
    if (!window.isAllowedPortalEmail(email)) {
        errorDiv.innerHTML = '<i class="fa-solid fa-ban mr-1"></i> केवल <strong>@print.com</strong> डोमेन वाली User ID ही मान्य है!';
        errorDiv.style.display = 'block';
        return;
    }
    const originalBtnHtml = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
    loginBtn.disabled = true;
    try {
        await signInWithEmailAndPassword(auth, email, passInput);
        sessionStorage.setItem('ojas_portal_access', 'allowed');
        if (window.isAnyAdminEmail && window.isAnyAdminEmail(email)) {
            sessionStorage.setItem('ojas_separate_admin_verified', 'true');
        } else {
            sessionStorage.removeItem('ojas_separate_admin_verified');
        }
    } catch (error) {
        errorDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1"></i> Your ID or Password are incorrect!';
        errorDiv.style.display = 'block';
        document.getElementById('loginPassword').value = '';
        loginBtn.innerHTML = originalBtnHtml;
        loginBtn.disabled = false;
    }
};

function startVipCountdownLoop() {
    if (window.vipCountdownInterval) clearInterval(window.vipCountdownInterval);
    updateVipTimerAndAlerts();
    window.vipCountdownInterval = setInterval(updateVipTimerAndAlerts, 1000);
}

async function updateVipTimerAndAlerts() {
    const userData = window.currentUserData;
    const gearVipDaysText = document.getElementById('gearVipDaysText');
    const cornerAlert = document.getElementById('vipCornerAlert');
    const cornerAlertDaysText = document.getElementById('cornerAlertDaysText');
    if (!userData || !userData.isVip || userData.hasFreeAccess) {
        if (cornerAlert) cornerAlert.style.display = 'none';
        if (gearVipDaysText) gearVipDaysText.innerText = userData?.isAdmin ? '👑 Admin (Unlimited)' : (userData?.isFreeVip ? '👑 Permanent VIP (Free)' : 'Normal User (0 Days)');
        return;
    }
    if (!userData.vipExpiry || userData.vipExpiry <= 0) {
        if (gearVipDaysText) gearVipDaysText.innerText = 'VIP Active';
        if (cornerAlert) cornerAlert.style.display = 'none';
        return;
    }
    const now = Date.now();
    const diff = userData.vipExpiry - now;
    if (diff <= 0) {
        clearInterval(window.vipCountdownInterval);
        userData.isVip = false;
        userData.vipExpiry = 0;
        try { await updateDoc(doc(db, "users", userData.uid), { isVip: false, vipExpiry: 0 }); } catch (e) {}
        if (cornerAlert) cornerAlert.style.display = 'none';
        setupDashboard(userData);
        alert('आपकी VIP वैलिडिटी समाप्त हो गई है।');
        return;
    }
    const totalDaysCeil = Math.ceil(diff / window.MS_PER_DAY);
    const days = Math.floor(diff / window.MS_PER_DAY);
    const hours = Math.floor((diff % window.MS_PER_DAY) / (1000 * 60 * 60));
    if (gearVipDaysText) gearVipDaysText.innerText = `👑 VIP: ${totalDaysCeil} दिन बाकी (${days}d ${hours}h)`;
    if (totalDaysCeil <= 5 && totalDaysCeil >= 1) {
        if (!window.cornerAlertDismissed && cornerAlert && cornerAlertDaysText) {
            cornerAlert.style.display = 'block';
            cornerAlertDaysText.innerHTML = `VIP खत्म होने में सिर्फ <strong class="text-red-600 underline">${totalDaysCeil} दिन</strong> बचे हैं!`;
        }
    } else if (cornerAlert) {
        cornerAlert.style.display = 'none';
    }
}

window.dismissCornerAlert = function() {
    window.cornerAlertDismissed = true;
    const _ca = document.getElementById('vipCornerAlert');
    if (_ca) _ca.style.display = 'none';
};

function setupDashboard(userData) {
    window.syncUserProfileHeaderUI(userData);
    const adminLink = document.getElementById('adminPanelLink');
    const gearAdminLink = document.getElementById('gearAdminPanelLink');

    if (userData.isAdmin) {
        sessionStorage.setItem('ojas_separate_admin_verified', 'true');
        if (adminLink) adminLink.style.display = 'inline-flex';
        if (gearAdminLink) gearAdminLink.style.display = 'flex';
    } else {
        sessionStorage.removeItem('ojas_separate_admin_verified');
        if (adminLink) adminLink.style.display = 'none';
        if (gearAdminLink) gearAdminLink.style.display = 'none';
    }

    const creditDisplayBox = document.getElementById('creditDisplayBox');
    const vipServicesBar = document.getElementById('vipServicesBar');
    const portalTitle = document.getElementById('portalHeaderTitle');
    const portalIcon = document.getElementById('portalHeaderIcon');
    const mainFormCard = document.getElementById('mainFormCard');

    const gearCreditRow = document.getElementById('gearCreditRow');
    const gearBtnAddCredit = document.getElementById('gearBtnAddCredit');
    const gearBtnPaymentHistory = document.getElementById('gearBtnPaymentHistory');
    if (gearCreditRow) gearCreditRow.style.display = userData.hasFreeAccess ? 'none' : 'flex';
    if (gearBtnAddCredit) gearBtnAddCredit.style.display = userData.hasFreeAccess ? 'none' : 'flex';
    if (gearBtnPaymentHistory) gearBtnPaymentHistory.style.display = userData.hasFreeAccess ? 'none' : 'flex';
    const dispCredits = document.getElementById('displayCredits');
    if (dispCredits) dispCredits.innerText = userData.credits || 0;
    if (portalTitle) portalTitle.innerHTML = `Ojas <span class="text-royal-400">Portal</span>`;
    if (portalIcon) {
        portalIcon.innerHTML = `<img src="/images/logo.png" alt="Logo" class="w-full h-full object-contain" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1211/1211833.png'">`;
        portalIcon.className = "w-7 h-7 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden p-1 border border-slate-200 shrink-0";
    }
    if (vipServicesBar) vipServicesBar.style.display = 'block';
    if (mainFormCard) mainFormCard.className = "bg-white text-slate-800 rounded-2xl md:rounded-3xl shadow-card border border-slate-200 p-4 md:p-7";

    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'flex';
    window.applyLivePortalControls();

    const savedTab = sessionStorage.getItem('ojas_active_tab') || 'home';
    if (savedTab && window.canCurrentUserSeeService(savedTab)) {
        window.switchService(savedTab);
    } else {
        window.switchService('home');
    }
}

window.handleLogout = async function() {
    sessionStorage.removeItem("ojas_separate_admin_verified");
    sessionStorage.removeItem("ojas_portal_access");
    await signOut(auth);
    window.location.replace("/portal");
};

window.togglePassVisibility = function(inputId, btnEl) {
    const inp = document.getElementById(inputId);
    const icon = btnEl.querySelector('i');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash', 'text-royal-600');
    } else {
        inp.type = 'password';
        icon.classList.remove('fa-eye-slash', 'text-royal-600');
        icon.classList.add('fa-eye');
    }
};

window.handleProfilePhotoSelect = function(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 200;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const prev = document.getElementById('profilePhotoPreview');
            const hiddenInp = document.getElementById('profilePhotoDataInput');
            if (prev) prev.src = dataUrl;
            if (hiddenInp) hiddenInp.value = dataUrl;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.saveUserProfile = async function(event) {
    event.preventDefault();
    const u = window.currentUserData;
    if (!u) return;
    const fullNameVal = document.getElementById('profileFullNameInput').value.trim();
    const emailVal = document.getElementById('profileEmailInput').value.trim();
    const photoVal = document.getElementById('profilePhotoDataInput').value;
    const msgBox = document.getElementById('profileSaveMsg');
    const btn = document.getElementById('btnSaveProfile');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
    try {
        const payload = { email: u.email, fullName: fullNameVal, contactEmail: emailVal, updatedAt: new Date() };
        if (photoVal) payload.profilePhoto = photoVal;
        await setDoc(doc(db, "users", u.uid), payload, { merge: true });
        u.fullName = fullNameVal;
        u.contactEmail = emailVal;
        if (photoVal) u.profilePhoto = photoVal;
        window.syncUserProfileHeaderUI(u);
        msgBox.className = "text-xs font-bold p-3 rounded-xl border text-center bg-green-50 text-green-700 border-green-200";
        msgBox.innerHTML = "<i class='fa-solid fa-check-circle mr-1'></i> प्रोफाइल सफलतापूर्वक अपडेट हो गई!";
        msgBox.style.display = 'block';
    } catch (err) {
        msgBox.className = "text-xs font-bold p-3 rounded-xl border text-center bg-red-50 text-red-600 border-red-200";
        msgBox.innerHTML = "<i class='fa-solid fa-circle-exclamation mr-1'></i> " + err.message;
        msgBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

window.changeUserPassword = async function(event) {
    event.preventDefault();
    const currPass = document.getElementById('currentPassInput').value;
    const newPass = document.getElementById('newPassInput').value;
    const confirmPass = document.getElementById('confirmPassInput').value;
    const msgBox = document.getElementById('passChangeMsg');
    const btn = document.getElementById('btnChangePass');

    if (newPass.length < 6) {
        msgBox.className = "text-xs font-bold p-3.5 rounded-xl border text-center bg-red-50 text-red-600 border-red-200 mt-4";
        msgBox.innerHTML = "<i class='fa-solid fa-circle-exclamation mr-1'></i> नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए!";
        msgBox.style.display = 'block';
        return;
    }

    if (newPass !== confirmPass) {
        msgBox.className = "text-xs font-bold p-3.5 rounded-xl border text-center bg-red-50 text-red-600 border-red-200 mt-4";
        msgBox.innerHTML = "<i class='fa-solid fa-circle-exclamation mr-1'></i> नया पासवर्ड और कन्फर्म पासवर्ड मैच नहीं हो रहे हैं!";
        msgBox.style.display = 'block';
        return;
    }

    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Updating Password...';
    btn.disabled = true;
    msgBox.style.display = 'none';

    try {
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, currPass);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPass);
        await updateDoc(doc(db, "users", user.uid), { userPass: newPass, passUpdatedAt: new Date() });

        msgBox.className = "text-xs font-bold p-3.5 rounded-xl border text-center bg-green-50 text-green-700 border-green-200 mt-4";
        msgBox.innerHTML = "<i class='fa-solid fa-check-circle mr-1 text-base'></i> पासवर्ड सफलतापूर्वक बदल दिया गया है!";
        msgBox.style.display = 'block';
        event.target.reset();
    } catch (error) {
        msgBox.className = "text-xs font-bold p-3.5 rounded-xl border text-center bg-red-50 text-red-600 border-red-200 mt-4";
        msgBox.innerHTML = (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password')
            ? "<i class='fa-solid fa-circle-exclamation mr-1'></i> आपका पुराना पासवर्ड गलत है!"
            : "<i class='fa-solid fa-circle-exclamation mr-1'></i> " + error.message;
        msgBox.style.display = 'block';
    } finally {
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
};

window.switchService = async function(serviceName) {
    if (!serviceName) serviceName = window.getFirstAllowedTab();

    if (window.currentUserData?.hasFreeAccess && (serviceName === 'add_credit' || serviceName === 'payments_history')) serviceName = window.getFirstAllowedTab();

    if (serviceName === 'domicile' && !window.canCurrentUserSeeService('domicile')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'caste' && !window.canCurrentUserSeeService('caste')) serviceName = window.getFirstAllowedTab();
    else if ((serviceName === 'evoter' || serviceName === 'e-voter') && !window.canCurrentUserSeeService('evoter')) serviceName = window.getFirstAllowedTab();
    else if ((serviceName === 'dob_minor' || serviceName === 'dob_delhi') && !window.canCurrentUserSeeService('dob_delhi')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'dob_baraut' && !window.canCurrentUserSeeService('dob_baraut')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'dob_print' && !window.canCurrentUserSeeService('dob_print')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'passport' && !window.canCurrentUserSeeService('passport')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'gazette' && !window.canCurrentUserSeeService('gazette')) serviceName = window.getFirstAllowedTab();
    else if (serviceName.startsWith('annexure') && !window.canCurrentUserSeeService('annexures')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'minor' && !window.canCurrentUserSeeService('minor')) serviceName = window.getFirstAllowedTab();

    window.currentActiveTab = serviceName;
    sessionStorage.setItem('ojas_active_tab', serviceName);

    document.querySelectorAll('.service-tab').forEach(btn => { btn.className = "service-tab bg-dark-900 text-royal-300 font-bold py-2.5 px-3 rounded-xl hover:bg-dark-800 transition shadow-sm border border-slate-700 text-xs md:text-sm flex-1 flex justify-center items-center gap-1.5"; });
    document.querySelectorAll('.vip-tab').forEach(btn => { btn.className = "vip-tab bg-dark-800 text-royal-300 border border-royal-500/30 font-bold py-2 px-2.5 rounded-xl hover:bg-dark-700 transition text-[11px] md:text-xs flex items-center justify-center gap-1 shadow-sm"; });

    let tabIdToHighlight = serviceName.startsWith('annexure') ? 'annexures' : serviceName;
    const activeBtn = document.getElementById('btn-' + tabIdToHighlight);
    const activeEvoterMain = document.getElementById('btn-evoter-main');
    if (activeEvoterMain && (serviceName === 'evoter' || serviceName === 'e-voter')) {
        activeEvoterMain.className = "service-tab bg-white text-dark-950 font-black py-2.5 px-3 rounded-xl shadow-glow transition text-xs md:text-sm flex-1 flex justify-center items-center gap-1.5 border-2 border-royal-500";
    }
    if (activeBtn) {
        if (activeBtn.classList.contains('vip-tab')) {
            activeBtn.className = "vip-tab bg-white text-dark-950 font-black py-2 px-2.5 rounded-xl shadow-vip-glow transition text-[11px] md:text-xs flex items-center justify-center gap-1 border-2 border-royal-400";
        } else {
            activeBtn.className = "service-tab bg-white text-dark-950 font-black py-2.5 px-3 rounded-xl shadow-glow transition text-xs md:text-sm flex-1 flex justify-center items-center gap-1.5 border-2 border-royal-500";
        }
    }

    const backBar = document.getElementById('serviceBackBar');
    const breadcrumb = document.getElementById('activeServiceBreadcrumb');
    const titleLookup = {
        home: 'All Services', domicile: 'Domicile Certificate', caste: 'Caste Certificate',
        evoter: 'e-Voter ID', minor: 'DOB (Minor)', dob_delhi: 'DOB Delhi (MCD)',
        dob_print: 'DOB Original PDF', dob_baraut: 'DOB Baraut', passport: 'Passport Services',
        gazette: 'Gazette Notification', annexure1: 'Annexure I', annexure1a: 'Annexure IA',
        annexure3: 'Annexure III', annexure3a: 'Annexure IIIA', annexureb: 'Annexure B',
        annexurec: 'Annexure C', annexured: 'Annexure D', annexuree: 'Annexure E',
        annexuref: 'Annexure F', history: 'Document History', add_credit: 'Add Credits',
        payments_history: 'Wallet Passbook', support_chat: 'Live Support Chat', profile: 'My Profile', password: 'My Profile'
    };
    if (backBar) backBar.style.display = (serviceName === 'home') ? 'none' : 'flex';
    if (breadcrumb) breadcrumb.innerText = titleLookup[serviceName] || serviceName.toUpperCase();

    window.applyLivePortalControls();
    const container = document.getElementById('formContainer');
    if (!container) return;

    if (serviceName === 'home') {
        window.renderHomeDashboard();
        return;
    }

    const submitBtnText = window.currentUserData && window.currentUserData.hasFreeAccess ? 'Generate Document (VIP Free) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>' : 'Generate Document (10 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';
    const statusTagHtml = window.currentUserData && window.currentUserData.hasFreeAccess ? '<span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] font-black border border-green-300 uppercase"><i class="fa-solid fa-crown mr-1"></i>Lifetime VIP Free</span>' : (window.currentUserData && window.currentUserData.isVip ? '<span class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-[10px] font-black border border-amber-300 uppercase"><i class="fa-solid fa-crown mr-1"></i>10 Credits</span>' : '<span class="bg-royal-100 text-royal-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-royal-300 uppercase">10 Credits</span>');

    if (serviceName === 'profile' || serviceName === 'password') {
        const u = window.currentUserData || {};
        const avatarSrc = u.profilePhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        container.innerHTML = `
        <div class="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <!-- Profile Details Card -->
            <form onsubmit="window.saveUserProfile(event)" class="bg-slate-50 p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div class="border-b border-slate-200 pb-3">
                    <h3 class="text-base font-black text-dark-900"><i class="fa-solid fa-user-circle text-royal-500 mr-1.5"></i> My Profile (मेरी प्रोफाइल)</h3>
                    <p class="text-[11px] font-semibold text-slate-500">अपना नाम, फोटो और ईमेल अपडेट करें</p>
                </div>
                <div class="flex items-center gap-4">
                    <img id="profilePhotoPreview" src="${avatarSrc}" alt="Profile" class="w-16 h-16 rounded-full object-cover border-2 border-royal-400 shadow-sm bg-white shrink-0">
                    <div class="flex-1">
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Profile Photo</label>
                        <input type="file" id="profilePhotoInput" accept="image/*" onchange="window.handleProfilePhotoSelect(this)" class="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-800 cursor-pointer">
                        <input type="hidden" id="profilePhotoDataInput" value="${u.profilePhoto || ''}">
                    </div>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name (पूरा नाम)</label>
                    <input type="text" id="profileFullNameInput" value="${(u.fullName || u.username || '').replace(/"/g, '&quot;')}" placeholder="अपना पूरा नाम लिखें" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-royal-500 bg-white">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mobile Number (बदला नहीं जा सकता)</label>
                    <input type="text" id="profilePhoneInput" value="${u.phone || 'Not Registered'}" readonly disabled class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-200/70 text-slate-500 cursor-not-allowed outline-none">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Email ID (ईमेल)</label>
                    <input type="email" id="profileEmailInput" value="${(u.contactEmail || u.email || '').replace(/"/g, '&quot;')}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-royal-500 bg-white">
                </div>
                <div id="profileSaveMsg" style="display:none;"></div>
                <button type="submit" id="btnSaveProfile" class="w-full bg-royal-600 hover:bg-royal-700 text-white font-black py-3 rounded-xl shadow-sm transition text-sm">Save Profile</button>
            </form>

            <!-- Change Password Card inside Profile -->
            <form onsubmit="window.changeUserPassword(event)" class="bg-slate-50 p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div class="border-b border-slate-200 pb-3">
                    <h3 class="text-base font-black text-dark-900"><i class="fa-solid fa-key text-indigo-500 mr-1.5"></i> Change Password</h3>
                    <p class="text-[11px] font-semibold text-slate-500">सुरक्षा के लिए अपना पासवर्ड बदलें</p>
                </div>
                <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Current Password</label><div class="relative"><input type="password" id="currentPassInput" required class="w-full p-3 pr-12 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-royal-500 bg-white"><button type="button" onclick="window.togglePassVisibility('currentPassInput', this)" class="absolute right-4 top-3 text-slate-400 hover:text-royal-600 transition"><i class="fa-solid fa-eye text-base"></i></button></div></div>
                <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label><div class="relative"><input type="password" id="newPassInput" required minlength="6" placeholder="कम से कम 6 अक्षर" class="w-full p-3 pr-12 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-royal-500 bg-white"><button type="button" onclick="window.togglePassVisibility('newPassInput', this)" class="absolute right-4 top-3 text-slate-400 hover:text-royal-600 transition"><i class="fa-solid fa-eye text-base"></i></button></div></div>
                <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password</label><div class="relative"><input type="password" id="confirmPassInput" required minlength="6" placeholder="दोबारा लिखें" class="w-full p-3 pr-12 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-royal-500 bg-white"><button type="button" onclick="window.togglePassVisibility('confirmPassInput', this)" class="absolute right-4 top-3 text-slate-400 hover:text-royal-600 transition"><i class="fa-solid fa-eye text-base"></i></button></div></div>
                <div id="passChangeMsg" style="display:none;"></div>
                <button type="submit" id="btnChangePass" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3 rounded-xl shadow-glow transition text-sm">Update Password</button>
            </form>
        </div>`;
        return;
    }

    if (serviceName === 'add_credit') {
        container.innerHTML = `
        <div id="walletMainUI" class="max-w-xl mx-auto space-y-4">
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <div><h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-shield-halved text-royal-500 mr-1.5"></i> Instant Razorpay Wallet Recharge</h3><p class="text-[11px] font-bold text-slate-500">Razorpay QR / UPI / Card से पेमेंट करें • 100% ऑटोमैटिक वेरिफिकेशन</p></div>
                <span class="bg-royal-100 text-royal-900 border border-royal-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">₹1 = 1 Credit</span>
            </div>
            <div id="paymentStep1" class="space-y-4">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label class="block text-xs font-black text-slate-700 uppercase">Enter Recharge Amount (₹)</label>
                    <input type="number" id="rupeeAmount" min="1" value="100" placeholder="Enter Amount (e.g. ₹100)" oninput="window.calculateCredits()" class="w-full p-3.5 border border-slate-300 rounded-xl text-lg font-black outline-none focus:border-royal-500 bg-white">
                    <div class="grid grid-cols-4 gap-2 pt-1">
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=100;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹100</button>
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=200;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹200</button>
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=500;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹500</button>
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=1000;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹1000</button>
                    </div>
                </div>
                <div class="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-1.5 text-xs">
                    <div class="font-black text-indigo-950 uppercase text-[11px] mb-1"><i class="fa-solid fa-tags mr-1 text-royal-600"></i> पोर्टल सर्विस रेट लिस्ट (Service Rates):</div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• मूल निवास / जाति / ई-वोटर कार्ड:</span><span class="font-black text-emerald-700">10 Credits (₹10)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• पासपोर्ट सर्विस (Passport):</span><span class="font-black text-sky-700">30 Credits (₹30)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• जन्म प्रमाण पत्र (DOB / दिल्ली DOB):</span><span class="font-black text-amber-800">50 Credits (₹50)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• डेट ऑफ बर्थ PDF ओरिजिनल (DOB Original PDF):</span><span class="font-black text-teal-800">140 Credits (₹140)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• गैजेट नोटिफिकेशन (Gazette Notification):</span><span class="font-black text-purple-800">100 Credits (₹100)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• एनेक्सर जनरेट (Annexure Generate):</span><span class="font-black text-emerald-700">10 Credits (₹10)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• केवल स्टैम्प (+₹20) | सर्टिफिकेट (+₹20):</span><span class="font-black text-royal-700">₹30 (Stamp) / ₹50 (Complete)</span></div>
                </div>
                <div class="bg-dark-950 p-5 rounded-2xl text-white space-y-3 border border-royal-500/40 shadow-lg">
                    <div class="flex justify-between items-center pb-3 border-b border-slate-800"><span class="text-xs font-bold text-slate-400">Credits You Get:</span><span id="calculatedCredits" class="text-lg font-black text-emerald-400">100 Cr</span></div>
                    <div class="flex justify-between items-center"><span class="text-sm font-black uppercase text-royal-300">Total Payable:</span><span id="totalPayableDisplay" class="text-2xl font-black text-white">₹100</span></div>
                    <button id="btnGenerateQR" onclick="window.generateQR()" class="w-full bg-gradient-to-r from-indigo-600 via-royal-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-glow transition flex items-center justify-center gap-2 text-sm">
                        <i class="fa-solid fa-qrcode text-base"></i><span>Pay Now via Razorpay (QR / UPI / Card • Auto-Verify)</span>
                    </button>
                </div>
                <div id="rzpPaymentStatusBanner" style="display:none;"></div>
                <div class="w-full pt-2 text-center"><button type="button" onclick="window.togglePaymentTicketBox()" class="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-black text-amber-900 transition flex items-center justify-center gap-1.5 shadow-sm"><i class="fa-solid fa-ticket text-amber-600"></i> पेमेंट कट गया पर क्रेडिट नहीं मिला? Ticket जनरेट करें</button></div>
                <div id="paymentIssueTicketBox" style="display:none;" class="bg-indigo-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-indigo-300 dark:border-slate-700 w-full space-y-2.5">
                    <div class="flex items-center justify-between border-b border-indigo-200 pb-2"><span class="text-xs font-black text-indigo-950 uppercase"><i class="fa-solid fa-headset mr-1 text-indigo-600"></i> Raise Payment Ticket</span><span class="bg-amber-200 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded-full">24–48 Hours Resolution</span></div>
                    <div><label class="block text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase mb-1">12-Digit UTR / Razorpay Payment ID <span class="text-red-500">*</span></label><input type="text" id="ticketUtrInput" placeholder="e.g. pay_Pxyz123456 या 412345678901" class="w-full p-2.5 border border-indigo-300 dark:border-slate-600 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 outline-none"></div>
                    <div><label class="block text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase mb-1">समस्या का विवरण (Optional Note)</label><input type="text" id="ticketIssueNoteInput" placeholder="e.g. Razorpay से ₹100 कट गए हैं, कृपया अप्रूव करें" class="w-full p-2.5 border border-indigo-300 dark:border-slate-600 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 outline-none"></div>
                    <button type="button" id="btnRaisePaymentTicket" onclick="window.submitPaymentIssueTicket()" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3 rounded-xl text-xs shadow-glow transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-paper-plane"></i> Submit Ticket (24–48h Approval)</button>
                    <div id="paymentTicketResultMsg" style="display:none;"></div>
                </div>
            </div>
        </div>`;
        window.calculateCredits();
        return;
    }

    if (window.renderServiceFormHtml(serviceName, container, submitBtnText, statusTagHtml)) return;

    if (serviceName === 'support_chat') {
        container.innerHTML = `<div class="max-w-2xl mx-auto flex flex-col h-[460px] md:h-[520px] border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-inner"><div class="bg-dark-950 text-white px-4 py-3 flex justify-between items-center border-b border-royal-500"><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-xl bg-green-500/20 border border-green-400 text-green-400 flex items-center justify-center"><i class="fa-solid fa-headset text-sm"></i></div><div><h3 class="text-xs md:text-sm font-black text-white flex items-center gap-1.5">Live Admin Support Chat <span class="w-2 h-2 rounded-full bg-green-400 animate-ping"></span></h3><p class="text-[10px] text-slate-400 font-semibold">User ID: <span class="text-royal-300 font-bold">${window.currentUserData?.email || ''}</span></p></div></div><span class="text-[10px] bg-dark-800 text-royal-300 border border-slate-700 px-2.5 py-1 rounded-lg font-bold">2-Way Live</span></div><div id="userLiveChatMessagesBox" class="flex-1 p-3.5 md:p-4 overflow-y-auto space-y-3 bg-slate-100/80"></div><form onsubmit="window.sendUserSupportMessage(event)" class="p-3 bg-white border-t border-slate-200 flex gap-2"><input type="text" id="userSupportChatInput" required placeholder="यहाँ अपनी समस्या या मैसेज लिखें..." class="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs md:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-royal-500 outline-none"><button type="submit" id="btnSendUserChat" class="bg-dark-900 hover:bg-black text-royal-300 font-black px-5 py-2.5 rounded-xl text-xs md:text-sm shadow-glow transition flex items-center gap-1.5 shrink-0"><span>Send</span> <i class="fa-solid fa-paper-plane text-xs"></i></button></form></div>`;
        window.renderUserLiveChatMessages();
        if (window.currentUserData && window.currentUserChatData?.unreadByUser === true) {
            try { await updateDoc(doc(db, "supportTickets", window.currentUserData.uid), { unreadByUser: false }); } catch (e) {}
        }
        const headerBadge = document.getElementById('headerSupportUnreadBadge');
        const gearBadge = document.getElementById('gearSupportUnreadBadge');
        if (headerBadge) headerBadge.style.display = 'none';
        if (gearBadge) gearBadge.style.display = 'none';
        return;
    }

    if (serviceName === 'payments_history') {
        container.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
                <div><h3 class="text-base md:text-lg font-black text-dark-900 flex items-center gap-2"><i class="fa-solid fa-book-open-reader text-royal-500"></i> Wallet Passbook &amp; Credit History (वॉलेट पासबुक)</h3><p class="text-[11px] font-bold text-slate-500">आपके सभी रिचार्ज, हर कार्ड बनने पर कटे क्रेडिट्स, रिफंड और एडमिन गिफ्ट का पूरा हिसाब</p></div>
                <button onclick="window.loadUserPayments()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"><i class="fa-solid fa-rotate-right"></i> Refresh Passbook</button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div class="p-3 rounded-2xl bg-dark-950 text-white border border-royal-500/40 shadow-sm"><p class="text-[10px] font-bold text-royal-300 uppercase">वर्तमान बैलेंस (Wallet)</p><p id="sumCurrentBalance" class="text-lg md:text-xl font-black text-white mt-0.5">${window.currentUserData?.credits || 0} Cr</p></div>
                <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200"><p class="text-[10px] font-black text-emerald-800 uppercase">कुल रिचार्ज (Recharged)</p><p id="sumApprovedAmt" class="text-lg md:text-xl font-black text-emerald-700 mt-0.5">+0 Cr</p></div>
                <div class="p-3 rounded-2xl bg-rose-50 border border-rose-200"><p class="text-[10px] font-black text-rose-800 uppercase">कार्ड खर्च (Card Deduct)</p><p id="sumTotalDeducted" class="text-lg md:text-xl font-black text-rose-600 mt-0.5">-0 Cr</p></div>
                <div class="p-3 rounded-2xl bg-purple-50 border border-purple-200"><p class="text-[10px] font-black text-purple-800 uppercase">रिफंड + गिफ्ट (Refund/Gift)</p><p id="sumTotalRefundGift" class="text-lg md:text-xl font-black text-purple-700 mt-0.5">+0 Cr</p></div>
                <div class="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-amber-50 border border-amber-200"><p class="text-[10px] font-black text-amber-800 uppercase">पेंडिंग रिचार्ज (Pending)</p><p id="sumPendingAmt" class="text-lg md:text-xl font-black text-amber-700 mt-0.5">₹0 (0)</p></div>
            </div>
            <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    <button id="pbPill-ALL" onclick="window.setPassbookFilter('ALL')" class="px-3 py-2 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shadow-sm border border-royal-500/40 transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-list-ul"></i> <span>All (सभी)</span></button>
                    <button id="pbPill-RECHARGE" onclick="window.setPassbookFilter('RECHARGE')" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-wallet text-emerald-600"></i> <span>Recharges</span></button>
                    <button id="pbPill-DEDUCTION" onclick="window.setPassbookFilter('DEDUCTION')" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-file-invoice text-rose-600"></i> <span>Card Deductions</span></button>
                    <button id="pbPill-REFUND" onclick="window.setPassbookFilter('REFUND')" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-rotate-left text-teal-600"></i> <span>Refunds</span></button>
                    <button id="pbPill-GIFT" onclick="window.setPassbookFilter('GIFT')" class="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-gift text-purple-600"></i> <span>Admin Gifts</span></button>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="relative flex-1 min-w-[200px]"><i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i><input type="text" id="passbookSearchInput" oninput="window.renderUserPassbookLedger()" placeholder="नाम, कार्ड का प्रकार, BRN या UTR से खोजें..." class="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:border-royal-400"></div>
                    <span id="passbookCountLabel" class="text-[11px] font-black text-royal-600 px-2">Showing 0 Transactions</span>
                </div>
            </div>
            <div class="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm"><table class="w-full text-left border-collapse bg-white min-w-[660px]"><thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider"><tr><th class="p-3">तारीख व समय</th><th class="p-3">कैटेगरी</th><th class="p-3">विवरण</th><th class="p-3">क्रेडिट्स</th><th class="p-3">रेफरेंस</th><th class="p-3 text-right">स्टेटस</th></tr></thead><tbody id="userPaymentsTableBody" class="text-xs text-slate-700 divide-y divide-slate-100"></tbody></table></div>
        </div>`;
        window.currentPassbookFilter = 'ALL';
        window.loadUserPayments();
        return;
    }

    if (serviceName === 'history') {
        const cfg = window.portalConfigState;
        const domOpt = cfg.showDomicile !== false ? `<option value="Domicile">मूल निवास (Domicile)</option>` : '';
        const casOpt = cfg.showCaste !== false ? `<option value="Caste">जाति प्रमाण पत्र (Caste)</option>` : '';
        const evoterOpt = window.canCurrentUserSeeService('evoter') ? `<option value="e-Voter ID">e-Voter ID</option>` : '';
        const dobDelhiOpt = window.canCurrentUserSeeService('dob_delhi') ? `<option value="DOB Delhi">DOB Delhi (MCD)</option>` : '';
        const dobBarautOpt = window.canCurrentUserSeeService('dob_baraut') ? `<option value="DOB Baraut">DOB Baraut (₹50)</option>` : '';
        const passportOpt = window.canCurrentUserSeeService('passport') ? `<option value="Passport">Passport</option>` : '';
        const minorOpt = window.canCurrentUserSeeService('minor') ? `<option value="Minor">DOB (Minor • ₹50)</option>` : '';
        const dobPrintOpt = window.canCurrentUserSeeService('dob_print') ? `<option value="DOB Print">DOB Original PDF (₹140)</option>` : '';
        const gazetteOpt = window.canCurrentUserSeeService('gazette') ? `<option value="Gazette Notification">Gazette Notification (₹100)</option>` : '';
        const vipFilterOptions = `${evoterOpt}${dobDelhiOpt}${dobBarautOpt}${passportOpt}${minorOpt}${dobPrintOpt}${gazetteOpt}<option value="Annexure 1">Annexure 1</option><option value="Annexure 1A">Annexure 1A</option><option value="Annexure 3">Annexure 3</option><option value="Annexure 3A">Annexure 3A</option><option value="Annexure B">Annexure B</option><option value="Annexure C">Annexure C</option><option value="Annexure D">Annexure D</option><option value="Annexure E">Annexure E</option><option value="Annexure F">Annexure F</option>`;

        const isAdminUser = Boolean(window.currentUserData?.isAdmin);
        const adminToolbarHtml = isAdminUser ? `
        <div id="portalAdminHistoryToolbar" class="mb-4 p-3 rounded-2xl bg-amber-50/90 border border-amber-300 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
            <div class="flex items-center gap-2">
                <span class="bg-dark-900 text-royal-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide"><i class="fa-solid fa-crown text-amber-400 mr-1"></i>Admin Mode</span>
                <span class="text-xs font-black text-amber-950">सभी यूज़र्स की फाइल्स (यहीं से Edit व Stamp करें)</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <select id="userHistoryUserFilter" onchange="this.dataset.userSelected='1';window.loadUserHistory(true)" class="p-2 border border-amber-300 rounded-xl text-xs bg-white font-bold text-slate-800 outline-none min-w-[160px]">
                    <option value="${window.currentUserData?.uid || ''}">👑 Admin (${window.currentUserData?.email || 'My Files'})</option>
                    <option value="ALL">All Users (सभी यूज़र)</option>
                </select>
                <input type="date" id="userHistoryDateFilter" onchange="window.handleUserHistoryFilterChange()" class="p-1.5 border border-amber-300 rounded-xl text-xs bg-white font-bold text-slate-700 outline-none">
            </div>
        </div>` : '';

        container.innerHTML = `<div class="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3 mb-4">
            <div><h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-folder-open text-royal-500 mr-1.5"></i> Document History</h3><p id="userHistoryCount" class="text-[11px] font-bold text-royal-600">Total Files: 0</p></div>
            <div class="flex flex-wrap items-center gap-2">
                <div class="relative min-w-[170px]"><i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i><input type="text" id="userHistorySearchInput" oninput="window.handleUserHistoryFilterChange()" placeholder="नाम या फ़ाइल से खोजें..." class="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-bold outline-none focus:bg-white focus:border-royal-400"></div>
                <select id="userHistoryTypeFilter" onchange="window.handleUserHistoryFilterChange()" class="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-semibold outline-none"><option value="ALL">All Documents</option>${domOpt}${casOpt}${vipFilterOptions}</select>
                <button onclick="window.loadUserHistory()" class="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-200"><i class="fa-solid fa-rotate-right"></i></button>
            </div>
        </div>
        ${adminToolbarHtml}
        <div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="w-full text-left border-collapse bg-white min-w-[500px]"><thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase"><tr><th class="p-3">File Name</th><th class="p-3">Type</th><th class="p-3">Date & Time</th><th class="p-3 text-right">Action</th></tr></thead><tbody id="historyTableBody" class="text-xs text-slate-700"></tbody></table></div>
        <div id="userHistoryScrollSentinel" class="py-3 text-center">
            <button id="btnLoadMoreUserHistory" onclick="window.loadNextUserHistoryBatch()" class="bg-dark-900 hover:bg-black text-royal-300 font-black px-5 py-2 rounded-xl text-xs shadow-sm transition inline-flex items-center gap-2"><i class="fa-solid fa-angles-down"></i> और रिकॉर्ड्स लोड करें (Load More)</button>
        </div>`;

        window.loadUserHistory();
    }
};
