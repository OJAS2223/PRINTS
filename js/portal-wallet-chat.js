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
            ? '<i class="fa-solid fa-sun text-amber-400 text-sm md:text-base"></i>' 
            : '<i class="fa-solid fa-moon text-royal-300 text-sm md:text-base"></i>';
        btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTheme);
} else {
    window.initTheme();
}

// ============================================================================
// FILE 3: js/portal-wallet-chat.js (UPDATED COMPLETE)
// (Auth, Wallet, Chat, User Preview, Adv Password Reset, History, Global Stealth & TAB PERSISTENCE)
// ============================================================================

import "./config-templates.js?v=5.1";
import "./portal-forms.js?v=5.1";

const {
    auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, onSnapshot
} = window.fb;

window.currentUserData = null;
window.historyData = [];
window.userPaymentsData = [];
window.currentActiveTab = 'domicile';
window.vipCountdownInterval = null;
window.portalSettingsUnsubscribe = null;
window.userProfileUnsubscribe = null;
window.userChatUnsubscribe = null;
window.activePaymentUnsubscribe = null;
window.currentActiveOrderId = null;
window.currentUserChatData = { messages: [], unreadByUser: false };

window.portalConfigState = {
    showDomicile: true, showCaste: true, showDob18: true, showDobMinor: true,
    showDobDelhi: true, showPassport: true, showAnnexures: true,
    bannerEnabled: false, bannerBadge: "UPDATE", bannerTitle: "",
    bannerMessage: "", bannerBtnText: "", bannerBtnLink: "",
    banner2Enabled: false, banner2Badge: "NOTICE", banner2Title: "",
    banner2Message: "", banner2BtnText: "", banner2BtnLink: ""
};

window.currentRechargeCredits = 0; window.currentTotalPayable = 0; window.currentWantsVip = false; window.currentVipDays = 0; window.currentVipPlanFee = 0;

// === PER-USER & GLOBAL VISIBILITY CHECKER ===
window.canCurrentUserSeeService = function(srv) {
    const cfg = window.portalConfigState || {};
    const u = window.currentUserData;
    if (!u) return false;
    
    // Check Global Stealth + Per-User Stealth
    if (srv === 'domicile') return cfg.showDomicile !== false && u.allowDomicile !== false;
    if (srv === 'caste') return cfg.showCaste !== false && u.allowCaste !== false;
    if (srv === 'evoter' || srv === 'e-voter') return cfg.showEvoter !== false && u.allowEvoter !== false;
    if (srv === 'dob18' || srv === 'dob_meerut') return false;
    if (srv === 'dob_minor' || srv === 'dob_delhi') return cfg.showDobMinor !== false && (cfg.showDobDelhi !== false) && u.allowDobMinor !== false && (u.allowDobDelhi !== false);
    if (srv === 'passport') return cfg.showPassport !== false && u.allowPassport !== false;
    if (srv === 'gazette') return cfg.showGazette !== false && u.allowGazette !== false;
    if (srv === 'dob_print') return cfg.showDobPrint !== false && u.allowDobPrint !== false;
    if (srv === 'annexures' || srv.startsWith('annexure')) return cfg.showAnnexures !== false && u.allowAnnexures !== false;
    
    // MINOR SERVICE: Strictly accessible ONLY to users with Free Access (Admin, aadhaar@gmail.com, aadhaar@print.com, danish@print.com)
    if (srv === 'minor' || srv === 'dob') return cfg.showMinor !== false && u.allowMinor !== false;
    
    return true;
};

window.getFirstAllowedTab = function() { 
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

async function notifyAdminSecurely(payload) { try { await fetch('/api/notify-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) {} }

window.openForgotPasswordModal = function() { const modal = document.getElementById('forgotPasswordModal'); const idInp = document.getElementById('forgotUserIdInput'); const phoneInp = document.getElementById('forgotUserPhoneInput'); const noteInp = document.getElementById('forgotUserNoteInput'); const resBox = document.getElementById('forgotResultBox'); if (!modal) return; resBox.style.display = 'none'; idInp.value = document.getElementById('loginUsername')?.value.trim() || ''; phoneInp.value = ''; noteInp.value = ''; modal.style.display = 'flex'; };
window.closeForgotPasswordModal = function() { const modal = document.getElementById('forgotPasswordModal'); if (modal) modal.style.display = 'none'; };
window.submitForgotPasswordTicket = async function(event) { event.preventDefault(); const userIdText = document.getElementById('forgotUserIdInput').value.trim(); const userPhoneText = document.getElementById('forgotUserPhoneInput').value.trim(); const userNoteText = document.getElementById('forgotUserNoteInput').value.trim(); const btn = document.getElementById('btnSubmitForgotTicket'); const resBox = document.getElementById('forgotResultBox'); if (!userIdText || !userPhoneText) return alert("कृपया अपनी User ID और मोबाइल/WhatsApp नंबर ज़रूर भरें!"); const origHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Raising Ticket...'; const finalMessage = userNoteText || "मैं अपना पासवर्ड भूल गया हूँ, कृपया नया पासवर्ड जारी करें।"; try { await addDoc(collection(db, "supportTickets"), { type: "FORGOT_PASSWORD", userIdentifier: userIdText, userPhone: userPhoneText, message: `🔑 Forgot Password Request: ${finalMessage} (WhatsApp: ${userPhoneText})`, messages: [{ sender: 'user', text: `🔑 [FORGOT PASSWORD TICKET]\nUser ID: ${userIdText}\nWhatsApp: ${userPhoneText}\nNote: ${finalMessage}`, time: Date.now() }], status: "Open", unreadByAdmin: true, unreadByUser: false, timestamp: new Date(), updatedAtMs: Date.now() }); try { await addDoc(collection(db, "forgotTickets"), { userIdentifier: userIdText, userPhone: userPhoneText, note: finalMessage, status: "Pending", timestamp: new Date() }); } catch (e) {} notifyAdminSecurely({ type: "FORGOT_PASSWORD", userId: userIdText, phone: userPhoneText, message: finalMessage }); resBox.className = "p-3.5 rounded-2xl bg-green-50 border border-green-300 text-green-900 text-xs font-bold text-center space-y-1"; resBox.innerHTML = `<div><i class="fa-solid fa-circle-check text-green-600 text-base mr-1"></i> आपका टिकट सफलतापूर्वक रेज़ हो गया है!</div><p class="text-[11px] text-green-700">एडमिन को सूचना भेज दी गई है। जल्द ही आपके नंबर (${userPhoneText}) पर नया पासवर्ड भेज दिया जाएगा।</p>`; resBox.style.display = 'block'; event.target.reset(); } catch (err) { alert("टिकट भेजने में समस्या आई: " + err.message); } finally { btn.disabled = false; btn.innerHTML = origHtml; } };

function startUserSupportChatListener(uid) { if (window.userChatUnsubscribe) window.userChatUnsubscribe(); window.userChatUnsubscribe = onSnapshot(doc(db, "supportTickets", uid), async (snap) => { if (snap.exists()) { window.currentUserChatData = snap.data(); } else { window.currentUserChatData = { messages: [], unreadByUser: false }; } const isUnread = window.currentUserChatData.unreadByUser === true; const headerBadge = document.getElementById('headerSupportUnreadBadge'); const gearBadge = document.getElementById('gearSupportUnreadBadge'); if (window.currentActiveTab === 'support_chat') { if (isUnread) { try { await updateDoc(doc(db, "supportTickets", uid), { unreadByUser: false }); } catch (e) {} } if (headerBadge) headerBadge.style.display = 'none'; if (gearBadge) gearBadge.style.display = 'none'; window.renderUserLiveChatMessages(); } else { if (headerBadge) { headerBadge.innerText = '1'; headerBadge.style.display = isUnread ? 'inline-flex' : 'none'; } if (gearBadge) { gearBadge.innerText = 'New'; gearBadge.style.display = isUnread ? 'inline-block' : 'none'; } } }); }
window.renderUserLiveChatMessages = function() { const box = document.getElementById('userLiveChatMessagesBox'); if (!box) return; let msgs = Array.isArray(window.currentUserChatData?.messages) ? [...window.currentUserChatData.messages] : []; if (msgs.length === 0 && window.currentUserChatData?.message) msgs.push({ sender: 'user', text: window.currentUserChatData.message, time: Date.now() }); if (msgs.length === 0) { box.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400"><div class="w-12 h-12 rounded-full bg-royal-50 text-royal-500 flex items-center justify-center text-xl mb-2 border border-royal-200"><i class="fa-solid fa-comments"></i></div><p class="text-xs font-black text-slate-600">Ojas Live Support Chat</p><p class="text-[11px] text-slate-400 mt-0.5">कोई भी समस्या या सवाल नीचे लिखकर भेजें। एडमिन का रिप्लाई यहीं इसी चैट में लाइव दिखेगा।</p></div>`; return; } box.innerHTML = msgs.map(m => { const isMe = m.sender === 'user'; const tStr = m.time ? new Date(m.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : ''; const safeText = String(m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); if (isMe) { return `<div class="flex justify-end"><div class="max-w-[80%] bg-dark-900 text-white px-3.5 py-2.5 rounded-2xl rounded-br-none shadow-sm"><p class="text-xs font-semibold whitespace-pre-line leading-relaxed">${safeText}</p><span class="block text-[9px] text-royal-300 text-right mt-1 opacity-80">${tStr} • You</span></div></div>`; } else { return `<div class="flex justify-start"><div class="max-w-[80%] bg-amber-50 border border-amber-300 text-slate-900 px-3.5 py-2.5 rounded-2xl rounded-bl-none shadow-sm"><span class="text-[10px] font-black text-amber-800 uppercase block mb-0.5"><i class="fa-solid fa-crown text-amber-500 mr-1"></i>Admin Support</span><p class="text-xs font-bold whitespace-pre-line leading-relaxed">${safeText}</p><span class="block text-[9px] text-slate-400 text-right mt-1">${tStr}</span></div></div>`; } }).join(''); box.scrollTop = box.scrollHeight; };
window.sendUserSupportMessage = async function(event) { event.preventDefault(); if (!window.currentUserData) return; const inp = document.getElementById('userSupportChatInput'); const btn = document.getElementById('btnSendUserChat'); const text = inp.value.trim(); if (!text) return; inp.value = ''; btn.disabled = true; const uid = window.currentUserData.uid; try { const existingMsgs = Array.isArray(window.currentUserChatData?.messages) ? [...window.currentUserChatData.messages] : []; existingMsgs.push({ sender: 'user', text: text, time: Date.now() }); await setDoc(doc(db, "supportTickets", uid), { type: 'USER_SUPPORT_CHAT', userId: uid, userIdentifier: window.currentUserData.email, username: window.currentUserData.username, message: text, status: 'Open', unreadByAdmin: true, unreadByUser: false, timestamp: new Date(), updatedAtMs: Date.now(), messages: existingMsgs }, { merge: true }); } catch (err) { alert("मैसेज भेजने में समस्या आई: " + err.message); } finally { btn.disabled = false; inp.focus(); } };

function startUserProfileListener(uid) { 
    if (window.userProfileUnsubscribe) window.userProfileUnsubscribe(); 
    window.userProfileUnsubscribe = onSnapshot(doc(db, "users", uid), (snap) => { 
        if (!snap.exists() || !window.currentUserData) return; 
        const data = snap.data(); 
        window.currentUserData.credits = data.credits || 0; 
        
        // Sync stealth states
        window.currentUserData.allowEvoter = data.allowEvoter !== false;
        window.currentUserData.allowMinor = data.allowMinor !== false;
        window.currentUserData.allowDomicile = data.allowDomicile !== false;
        window.currentUserData.allowCaste = data.allowCaste !== false;
        window.currentUserData.allowDobMinor = data.allowDobMinor !== false;
        window.currentUserData.allowDobDelhi = data.allowDobDelhi !== false;
        window.currentUserData.allowPassport = data.allowPassport !== false;
                allowGazette = data.allowGazette !== false;
                allowDobPrint = data.allowDobPrint !== false;
        window.currentUserData.allowGazette = data.allowGazette !== false;
        window.currentUserData.allowDobPrint = data.allowDobPrint !== false;
        window.currentUserData.allowAnnexures = data.allowAnnexures !== false;

        // Sync Targeted Personal Banner State
        window.currentUserData.personalBannerEnabled = !!data.personalBannerEnabled;
        window.currentUserData.personalBannerBadge = data.personalBannerBadge || "NOTICE";
        window.currentUserData.personalBannerTitle = data.personalBannerTitle || "";
        window.currentUserData.personalBannerMessage = data.personalBannerMessage || "";
        window.currentUserData.personalBannerBtnText = data.personalBannerBtnText || "";
        window.currentUserData.personalBannerBtnLink = data.personalBannerBtnLink || "";

        const creditEl = document.getElementById('displayCredits'); if (creditEl) creditEl.innerText = window.currentUserData.credits; 
        const now = Date.now(); const isNowVip = window.currentUserData.hasFreeAccess || (data.isVip && (!data.vipExpiry || data.vipExpiry > now)); 
        const vipChanged = window.currentUserData.isVip !== isNowVip; 
        window.currentUserData.isVip = isNowVip; window.currentUserData.vipExpiry = window.currentUserData.hasFreeAccess ? 0 : (data.vipExpiry || 0); 
        if (vipChanged) setupDashboard(window.currentUserData); else window.applyLivePortalControls(); 
    }); 
}

function startPortalSettingsListener() { 
    if (window.portalSettingsUnsubscribe) window.portalSettingsUnsubscribe(); 
    window.portalSettingsUnsubscribe = onSnapshot(doc(db, "settings", "portalConfig"), (snap) => { 
        if (snap.exists()) { 
            const data = snap.data(); 
            window.portalConfigState = { 
                showDomicile: data.showDomicile !== false, 
                showCaste: data.showCaste !== false, 
                showEvoter: data.showEvoter !== false, 
                showDobMinor: data.showDobMinor !== false, 
                showDobDelhi: data.showDobDelhi !== false,
                showPassport: data.showPassport !== false,
            showGazette: data.showGazette !== false,
            showDobPrint: data.showDobPrint !== false,
                showAnnexures: data.showAnnexures !== false,
                bannerEnabled: !!data.bannerEnabled, 
                bannerBadge: data.bannerBadge || "UPDATE", 
                bannerTitle: data.bannerTitle || "", 
                bannerMessage: data.bannerMessage || "", 
                bannerBtnText: data.bannerBtnText || "", 
                bannerBtnLink: data.bannerBtnLink || "",
                banner2Enabled: !!data.banner2Enabled, 
                banner2Badge: data.banner2Badge || "NOTICE", 
                banner2Title: data.banner2Title || "", 
                banner2Message: data.banner2Message || "", 
                banner2BtnText: data.banner2BtnText || "", 
                banner2BtnLink: data.banner2BtnLink || ""
            }; 
        } 
        window.applyLivePortalControls(); 
    }); 
}

window.applyLivePortalControls = function() {
    const cfg = window.portalConfigState || {}; 
    
    // Check combined visibility
    const canDom = window.canCurrentUserSeeService('domicile');
    const canCas = window.canCurrentUserSeeService('caste');
    const canEvoter = window.canCurrentUserSeeService('evoter');
    const canDobDelhi = window.canCurrentUserSeeService('dob_delhi');
    const canPassport = window.canCurrentUserSeeService('passport');
    const canGazette = window.canCurrentUserSeeService('gazette');
    const canDobPrint = window.canCurrentUserSeeService('dob_print');
    const canAnnexures = window.canCurrentUserSeeService('annexures');
    const canMinor = window.canCurrentUserSeeService('minor');

    // Dual Banner & Targeted Personal User Banner Rendering
    const bannerBox = document.getElementById('liveUpdateBannerContainer');
    if (bannerBox) {
        let bannersHtml = '';

        // 1. TARGETED PERSONAL BANNER
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
                    <div class="absolute -right-3 -bottom-3 text-7xl text-amber-500/10 pointer-events-none select-none">
                        <i class="fa-solid fa-envelope-open-text"></i>
                    </div>
                    <div class="relative z-10 space-y-1.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="bg-amber-400 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                    <i class="fa-solid fa-user-tag mr-1"></i>${u.personalBannerBadge || 'PERSONAL NOTICE'}
                                </span>
                                <h4 class="text-xs md:text-sm font-black text-amber-300 flex items-center gap-1.5">
                                    <span>डियर ${displayName}</span>
                                    ${u.personalBannerTitle ? `<span class="text-slate-200 font-semibold">• ${u.personalBannerTitle}</span>` : ''}
                                </h4>
                            </div>
                            ${pBtnHtml}
                        </div>
                        <p class="text-xs md:text-sm font-bold text-slate-100 whitespace-pre-line leading-relaxed pl-0.5">
                            ${u.personalBannerMessage}
                        </p>
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
                            <span class="bg-royal-500 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0 mt-0.5 sm:mt-0"><i class="fa-solid fa-bullhorn mr-1"></i>${cfg.bannerBadge || 'UPDATE'}</span>
                            <div>
                                ${cfg.bannerTitle ? `<h4 class="text-xs md:text-sm font-black text-royal-300">${cfg.bannerTitle}</h4>` : ''}
                                ${cfg.bannerMessage ? `<p class="text-[11px] font-semibold text-slate-200 mt-0.5">${cfg.bannerMessage}</p>` : ''}
                            </div>
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
                            <span class="bg-emerald-400 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shrink-0 mt-0.5 sm:mt-0"><i class="fa-solid fa-bell mr-1"></i>${cfg.banner2Badge || 'NOTICE'}</span>
                            <div>
                                ${cfg.banner2Title ? `<h4 class="text-xs md:text-sm font-black text-emerald-300">${cfg.banner2Title}</h4>` : ''}
                                ${cfg.banner2Message ? `<p class="text-[11px] font-semibold text-slate-200 mt-0.5">${cfg.banner2Message}</p>` : ''}
                            </div>
                        </div>
                        ${btn2Html}
                    </div>
                </div>`;
        }
        if (bannersHtml) {
            bannerBox.style.display = 'block';
            bannerBox.innerHTML = bannersHtml;
        } else {
            bannerBox.style.display = 'none';
            bannerBox.innerHTML = '';
        }
    }
    
    const stdGrid = document.getElementById('standardServicesGrid'); 
    const btnDom = document.getElementById('btn-domicile'); 
    const btnCas = document.getElementById('btn-caste'); 
    const btnEvoter = document.getElementById('btn-evoter'); 
    const btnDobDelhi = document.getElementById('btn-dob_delhi') || document.getElementById('btn-dob_minor');
    const btnPassport = document.getElementById('btn-passport');
    const btnGazette = document.getElementById('btn-gazette');
    const btnDobPrint = document.getElementById('btn-dob_print');
    const btnAnnexures = document.getElementById('btn-annexures');
    const btnMinor = document.getElementById('btn-minor');
    const vipServicesBar = document.getElementById('vipServicesBar');
    const promoDesc = document.getElementById('normalPromoTextDesc'); 
    const vipHeaderLabel = document.getElementById('vipBarTitleLabel');
    
    if (btnDom) btnDom.style.setProperty('display', canDom ? 'flex' : 'none', 'important'); 
    if (btnCas) btnCas.style.setProperty('display', canCas ? 'flex' : 'none', 'important');
    if (btnEvoter) btnEvoter.style.setProperty('display', canEvoter ? 'flex' : 'none', 'important');
    if (btnDobDelhi) btnDobDelhi.style.setProperty('display', canDobDelhi ? 'flex' : 'none', 'important');
    if (btnPassport) btnPassport.style.setProperty('display', canPassport ? 'flex' : 'none', 'important');
    if (btnGazette) btnGazette.style.setProperty('display', canGazette ? 'flex' : 'none', 'important');
    if (btnDobPrint) btnDobPrint.style.setProperty('display', canDobPrint ? 'flex' : 'none', 'important');
    if (btnAnnexures) btnAnnexures.style.setProperty('display', canAnnexures ? 'flex' : 'none', 'important');
    
    if (btnMinor) btnMinor.style.setProperty('display', canMinor ? 'flex' : 'none', 'important');
    
    const btnEvoterMain = document.getElementById('btn-evoter-main');
    if (btnEvoterMain) btnEvoterMain.style.setProperty('display', canEvoter ? 'flex' : 'none', 'important');
    if (stdGrid) { 
        const visibleStdCount = (canDom ? 1 : 0) + (canCas ? 1 : 0) + (canEvoter ? 1 : 0);
        if (visibleStdCount === 0) { stdGrid.style.setProperty('display', 'none', 'important'); } 
        else if (visibleStdCount === 3) { stdGrid.style.setProperty('display', 'grid', 'important'); stdGrid.className = "grid grid-cols-3 gap-1.5 sm:gap-2.5 mb-2.5"; } 
        else if (visibleStdCount === 2) { stdGrid.style.setProperty('display', 'grid', 'important'); stdGrid.className = "grid grid-cols-2 gap-2.5 mb-3"; } 
        else { stdGrid.style.setProperty('display', 'grid', 'important'); stdGrid.className = "grid grid-cols-1 gap-2.5 mb-3"; } 
    }

    if (vipServicesBar) {
        const anyOtherAllowed = canMinor || canDobPrint || canDobDelhi || canPassport || canGazette || canAnnexures;
        vipServicesBar.style.setProperty('display', anyOtherAllowed ? 'block' : 'none', 'important');
    }
    
    if (promoDesc) promoDesc.innerHTML = `VIP लें: <strong>e-Voter ID, DOB (दिल्ली), पासपोर्ट & सारे Official Annexures</strong> अनलॉक करें (सभी डॉक्यूमेंट 10 Cr)!`;
    if (vipHeaderLabel) vipHeaderLabel.innerHTML = `<i class="fa-solid fa-layer-group text-royal-400"></i> Other Portal Services (DOB, Passport &amp; Annexures)`;
    
    // Auto-switch tab if current tab becomes hidden
    const cur = window.currentActiveTab;
    if ((cur === 'domicile' && !canDom) || (cur === 'caste' && !canCas) || 
        ((cur === 'evoter' || cur === 'e-voter') && !canEvoter) || 
        ((cur === 'dob_delhi' || cur === 'dob_minor') && !canDobDelhi) ||
        (cur === 'passport' && !canPassport) ||
        (cur === 'gazette' && !canGazette) ||
        (cur === 'dob_print' && !canDobPrint) ||
        (cur === 'minor' && !canMinor) ||
        (cur.startsWith('annexure') && !canAnnexures)) { 
        window.switchService(window.getFirstAllowedTab()); 
    }
};

document.addEventListener('click', (e) => { const menu = document.getElementById('gearDropdownMenu'); const btn = document.getElementById('gearMenuBtn'); if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden'); });
window.toggleGearMenu = function(e) { if (e) e.stopPropagation(); const menu = document.getElementById('gearDropdownMenu'); if (menu) menu.classList.toggle('hidden'); };
window.selectGearOption = function(serviceName) { const menu = document.getElementById('gearDropdownMenu'); if (menu) menu.classList.add('hidden'); window.switchService(serviceName); };

onAuthStateChanged(auth, async (user) => {
    const shield = document.getElementById('portalStealthShield');
    if (shield) shield.remove();
    document.body.style.display = 'flex';
    if (window.history && window.history.replaceState) {
        try { window.history.replaceState(null, document.title, '/portal'); } catch(e){}
    }
    const loadingScreen = document.getElementById('loadingScreen'); const loginSection = document.getElementById('loginSection'); const dashboardSection = document.getElementById('dashboardSection');
    if (user) {
        try {
            const emailLower = user.email.trim().toLowerCase(); 
            if (!window.isAllowedPortalEmail(emailLower)) { 
                await signOut(auth); 
                alert("अमान्य आईडी! पोर्टल पर केवल @print.com डोमेन वाली आईडी ही मान्य है।"); 
                loadingScreen.style.display = 'none';

            // Auto open Annexure for edit if URL parameter present
            const urlParams = new URLSearchParams(window.location.search);
            const editAnnexureParam = urlParams.get('editAnnexure');
            if (editAnnexureParam && window.currentUserData && window.currentUserData.isAdmin) {
                setTimeout(async () => {
                    if (window.historyData && window.historyData.length === 0) {
                        await window.loadUserHistory();
                    }
                    window.editAnnexureRecord(editAnnexureParam);
                }, 800);
            }
 
                return; 
            }
            try { 
                const cfgSnap = await getDoc(doc(db, "settings", "portalConfig")); 
                if (cfgSnap.exists()) { 
                    const d = cfgSnap.data(); 
                    window.portalConfigState = { 
                        showDomicile: d.showDomicile !== false, 
                        showCaste: d.showCaste !== false, 
                        showEvoter: d.showEvoter !== false, 
                        showDobMinor: d.showDobMinor !== false, 
                        showDobDelhi: d.showDobDelhi !== false,
                        showPassport: d.showPassport !== false,
                        showGazette: d.showGazette !== false,
                        showDobPrint: d.showDobPrint !== false,
                        showAnnexures: d.showAnnexures !== false,
                        bannerEnabled: !!d.bannerEnabled, 
                        bannerBadge: d.bannerBadge || "UPDATE", 
                        bannerTitle: d.bannerTitle || "", 
                        bannerMessage: d.bannerMessage || "", 
                        bannerBtnText: d.bannerBtnText || "", 
                        bannerBtnLink: d.bannerBtnLink || "",
                        banner2Enabled: !!d.banner2Enabled, 
                        banner2Badge: d.banner2Badge || "NOTICE", 
                        banner2Title: d.banner2Title || "", 
                        banner2Message: d.banner2Message || "", 
                        banner2BtnText: d.banner2BtnText || "", 
                        banner2BtnLink: d.banner2BtnLink || ""
                    }; 
                } 
            } catch (e) {}

            const userDocRef = doc(db, "users", user.uid); 
            const userDoc = await getDoc(userDocRef); 
            let userCredits = 0, isVip = false, vipExpiry = 0, allowEvoter = true, allowMinor = true, allowDomicile = true, allowCaste = true, allowDobMinor = true, allowDobDelhi = true, allowPassport = true, allowGazette = true, allowDobPrint = true, allowAnnexures = true, personalBannerEnabled = false, personalBannerBadge = 'NOTICE', personalBannerTitle = '', personalBannerMessage = '', personalBannerBtnText = '', personalBannerBtnLink = '';
            
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
            }

            const isSuperAdmin = window.isSuperAdminEmail ? window.isSuperAdminEmail(emailLower) : (emailLower === window.ADMIN_EMAIL.toLowerCase());
            const isSubAdmin = window.isSubAdminEmail ? window.isSubAdminEmail(emailLower) : (emailLower === 'prince@gmail.com' || emailLower === 'prince@print.com');
            const isAdmin = isSuperAdmin || isSubAdmin; 
            const isFreeVip = window.FREE_VIP_EMAILS.map(e => e.toLowerCase()).includes(emailLower); 
            const hasFreeAccess = isAdmin || isFreeVip; 
            const now = Date.now();

            if (!hasFreeAccess && isVip && vipExpiry > 0 && vipExpiry <= now) { 
                isVip = false; 
                vipExpiry = 0; 
                await updateDoc(userDocRef, { isVip: false, vipExpiry: 0 }); 
            }

            window.currentUserData = { 
                uid: user.uid, 
                email: user.email, 
                credits: userCredits, 
                isVip: isVip || hasFreeAccess, 
                vipExpiry: hasFreeAccess ? 0 : vipExpiry, 
                allowEvoter: allowEvoter,
                allowMinor: allowMinor, 
                allowDomicile: allowDomicile, 
                allowCaste: allowCaste, 
                allowDobMinor: allowDobMinor, 
                allowDobDelhi: allowDobDelhi, 
                allowPassport: allowPassport,
                allowGazette: allowGazette,
                allowDobPrint: allowDobPrint, 
                allowAnnexures: allowAnnexures, 
                personalBannerEnabled: personalBannerEnabled, 
                personalBannerBadge: personalBannerBadge, 
                personalBannerTitle: personalBannerTitle, 
                personalBannerMessage: personalBannerMessage, 
                personalBannerBtnText: personalBannerBtnText, 
                personalBannerBtnLink: personalBannerBtnLink, 
                isAdmin: isAdmin, 
                isFreeVip: isFreeVip, 
                hasFreeAccess: hasFreeAccess, 
                username: user.email.split('@')[0] 
            };

            setupDashboard(window.currentUserData); 
            startPortalSettingsListener(); 
            startUserProfileListener(user.uid); 
            startUserSupportChatListener(user.uid); 
            startVipCountdownLoop(); 
            loadingScreen.style.display = 'none';

            // Auto open Annexure for edit if URL parameter present
            const urlParams = new URLSearchParams(window.location.search);
            const editAnnexureParam = urlParams.get('editAnnexure');
            if (editAnnexureParam && window.currentUserData && window.currentUserData.isAdmin) {
                setTimeout(async () => {
                    if (window.historyData && window.historyData.length === 0) {
                        await window.loadUserHistory();
                    }
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
        
        window.currentUserData = null; 
        document.body.classList.remove('vip-body-bg'); 
        const _ca = document.getElementById('vipCornerAlert'); if (_ca) _ca.style.display = 'none';
        loginSection.style.display = 'flex'; 
        dashboardSection.style.display = 'none'; 
        loadingScreen.style.display = 'none';

            // Auto open Annexure for edit if URL parameter present
            const urlParams = new URLSearchParams(window.location.search);
            const editAnnexureParam = urlParams.get('editAnnexure');
            if (editAnnexureParam && window.currentUserData && window.currentUserData.isAdmin) {
                setTimeout(async () => {
                    if (window.historyData && window.historyData.length === 0) {
                        await window.loadUserHistory();
                    }
                    window.editAnnexureRecord(editAnnexureParam);
                }, 800);
            }

    }
});

window.handleLogin = async function(event) {
    event.preventDefault(); const emailInput = document.getElementById('loginUsername').value.trim().toLowerCase(); const passInput = document.getElementById('loginPassword').value.trim(); const errorDiv = document.getElementById('loginError'); const loginBtn = event.target.querySelector('button[type="submit"]');
    errorDiv.style.display = 'none'; const email = emailInput.includes('@') ? emailInput : `${emailInput}@print.com`;
    if (!window.isAllowedPortalEmail(email)) { errorDiv.innerHTML = '<i class="fa-solid fa-ban mr-1"></i> केवल <strong>@print.com</strong> डोमेन वाली User ID ही मान्य है!'; errorDiv.style.display = 'block'; return; }
    const originalBtnHtml = loginBtn.innerHTML; loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...'; loginBtn.disabled = true;
    try { 
        const userCred = await signInWithEmailAndPassword(auth, email, passInput); 
        sessionStorage.setItem('ojas_portal_access', 'allowed');
// Separate admin login required at /ovi
    } catch (error) { 
        errorDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1"></i> Your ID or Password are incorrect!'; 
        errorDiv.style.display = 'block'; 
        document.getElementById('loginPassword').value = ''; 
        loginBtn.innerHTML = originalBtnHtml; 
        loginBtn.disabled = false; 
    }
};

function startVipCountdownLoop() { if (window.vipCountdownInterval) clearInterval(window.vipCountdownInterval); updateVipTimerAndAlerts(); window.vipCountdownInterval = setInterval(updateVipTimerAndAlerts, 1000); }
async function updateVipTimerAndAlerts() {
    const userData = window.currentUserData; const gearVipDaysText = document.getElementById('gearVipDaysText'); const cornerAlert = document.getElementById('vipCornerAlert'); const cornerAlertDaysText = document.getElementById('cornerAlertDaysText');
    if (!userData || !userData.isVip || userData.hasFreeAccess) { if (cornerAlert) cornerAlert.style.display = 'none'; if (gearVipDaysText) gearVipDaysText.innerText = userData?.isAdmin ? '👑 Admin (Unlimited)' : (userData?.isFreeVip ? '👑 Permanent VIP (Free)' : 'Normal User (0 Days)'); return; }
    if (!userData.vipExpiry || userData.vipExpiry <= 0) { if (gearVipDaysText) gearVipDaysText.innerText = 'VIP Active'; if (cornerAlert) cornerAlert.style.display = 'none'; return; }
    const now = Date.now(); const diff = userData.vipExpiry - now;
    if (diff <= 0) { clearInterval(window.vipCountdownInterval); userData.isVip = false; userData.vipExpiry = 0; try { await updateDoc(doc(db, "users", userData.uid), { isVip: false, vipExpiry: 0 }); } catch (e) {} if (cornerAlert) cornerAlert.style.display = 'none'; setupDashboard(userData); alert('आपकी VIP वैलिडिटी समाप्त हो गई है।'); return; }
    const totalDaysCeil = Math.ceil(diff / window.MS_PER_DAY); const days = Math.floor(diff / window.MS_PER_DAY); const hours = Math.floor((diff % window.MS_PER_DAY) / (1000 * 60 * 60));
    if (gearVipDaysText) gearVipDaysText.innerText = `👑 VIP: ${totalDaysCeil} दिन बाकी (${days}d ${hours}h)`;
    if (totalDaysCeil <= 5 && totalDaysCeil >= 1) { if (!window.cornerAlertDismissed) { cornerAlert.style.display = 'block'; cornerAlertDaysText.innerHTML = `VIP खत्म होने में सिर्फ <strong class="text-red-600 underline">${totalDaysCeil} दिन</strong> बचे हैं!`; } } else { cornerAlert.style.display = 'none'; }
}
window.dismissCornerAlert = function() { window.cornerAlertDismissed = true; const _ca = document.getElementById('vipCornerAlert'); if (_ca) _ca.style.display = 'none'; };

function setupDashboard(userData) {
    document.getElementById('displayUser').innerText = userData.username.toUpperCase();
    const adminLink = document.getElementById('adminPanelLink');
    const gearAdminLink = document.getElementById('gearAdminPanelLink');
    if (adminLink) adminLink.style.display = userData.isAdmin ? 'inline-flex' : 'none';
    if (gearAdminLink) gearAdminLink.style.display = userData.isAdmin ? 'flex' : 'none';
    if (userData.isAdmin) sessionStorage.setItem('ojas_separate_admin_verified', 'true');
    const creditDisplayBox = document.getElementById('creditDisplayBox');
    const vipServicesBar = document.getElementById('vipServicesBar');
    const portalTitle = document.getElementById('portalHeaderTitle');
    const portalIcon = document.getElementById('portalHeaderIcon');
    const mainFormCard = document.getElementById('mainFormCard');

    if (creditDisplayBox) {
        creditDisplayBox.style.display = 'flex';
        document.getElementById('displayCredits').innerText = userData.credits || 0;
    }
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

    const savedTab = sessionStorage.getItem('ojas_active_tab');
    if (savedTab && window.canCurrentUserSeeService(savedTab)) {
        window.switchService(savedTab);
    } else {
        window.switchService(window.getFirstAllowedTab());
    }
}
window.handleLogout = async function() { sessionStorage.removeItem("ojas_portal_access"); await signOut(auth); window.location.replace("/"); };

window.togglePassVisibility = function(inputId, btnEl) {
    const inp = document.getElementById(inputId);
    const icon = btnEl.querySelector('i');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        icon.classList.add('text-royal-600');
    } else {
        inp.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.remove('text-royal-600');
        icon.classList.add('fa-eye');
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
        
        await updateDoc(doc(db, "users", user.uid), { 
            userPass: newPass, 
            passUpdatedAt: new Date() 
        });
        
        msgBox.className = "text-xs font-bold p-3.5 rounded-xl border text-center bg-green-50 text-green-700 border-green-200 mt-4";
        msgBox.innerHTML = "<i class='fa-solid fa-check-circle mr-1 text-base'></i> पासवर्ड सफलतापूर्वक बदल दिया गया है!";
        msgBox.style.display = 'block';
        event.target.reset();
        
        ['currentPassInput', 'newPassInput', 'confirmPassInput'].forEach(id => {
            const inp = document.getElementById(id);
            if (inp && inp.type === 'text') {
                inp.type = 'password';
                inp.nextElementSibling.querySelector('i').className = 'fa-solid fa-eye text-base';
            }
        });
        
    } catch (error) {
        msgBox.className = "text-xs font-bold p-3.5 rounded-xl border text-center bg-red-50 text-red-600 border-red-200 mt-4";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            msgBox.innerHTML = "<i class='fa-solid fa-circle-exclamation mr-1'></i> आपका पुराना पासवर्ड गलत है!";
        } else {
            msgBox.innerHTML = "<i class='fa-solid fa-circle-exclamation mr-1'></i> " + error.message;
        }
        msgBox.style.display = 'block';
    } finally {
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
};

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

window.generateQR = async function() {
    if (window.currentUserData?.hasFreeAccess) return; window.calculateCredits();
    if (!window.currentWantsVip && window.currentRechargeCredits < 100) return alert('पोर्टल पर कम से कम ₹100 के क्रेडिट रिचार्ज करना अनिवार्य है!');
    if (window.currentWantsVip && window.currentRechargeCredits > 0 && window.currentRechargeCredits < 100) return alert('क्रेडिट रिचार्ज की न्यूनतम वैल्यू ₹100 है!');
    if (window.currentTotalPayable < 100) return alert('न्यूनतम पेमेंट राशि ₹100 होनी चाहिए!');

    const btn = document.getElementById('btnGenerateQR'); const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> पेमेंट लिंक बन रहा है...'; }

    const queryParams = `pa=8279650137@amazonpay&pn=Ojas%20Print%20Service&am=${window.currentTotalPayable}&cu=INR&tn=${encodeURIComponent(window.currentWantsVip ? `Ojas VIP ${window.currentVipDays}d` : `Ojas Credits`)}`;
    let universalUpiUrl = `upi://pay?${queryParams}`; let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(universalUpiUrl)}`; window.currentActiveOrderId = null;

    try {
        const res = await fetch('/api/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: window.currentUserData.uid, email: window.currentUserData.email, username: window.currentUserData.username, totalPayable: window.currentTotalPayable, creditsRequested: window.currentRechargeCredits, wantsVip: window.currentWantsVip, vipDaysRequested: window.currentVipDays, vipPlanFee: window.currentVipPlanFee }) });
        const orderData = await res.json();
        if (orderData.status && orderData.orderId) {
            window.currentActiveOrderId = orderData.orderId;
            if (orderData.upi_string) { universalUpiUrl = orderData.upi_string; qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(universalUpiUrl)}`; }
            if (orderData.qr_code && orderData.qr_code.startsWith('http')) qrUrl = orderData.qr_code;

            if (window.activePaymentUnsubscribe) window.activePaymentUnsubscribe();
            window.activePaymentUnsubscribe = onSnapshot(doc(db, "payments", orderData.orderId), async (snap) => {
                if (snap.exists() && (snap.data().status === 'Auto-Approved' || snap.data().status === 'Approved')) {
                    if (window.activePaymentUnsubscribe) window.activePaymentUnsubscribe(); window.currentActiveOrderId = null;
                    const uSnap = await getDoc(doc(db, "users", window.currentUserData.uid));
                    if (uSnap.exists()) { const updatedUser = uSnap.data(); window.currentUserData.credits = updatedUser.credits || 0; window.currentUserData.isVip = updatedUser.isVip || window.currentUserData.hasFreeAccess; window.currentUserData.vipExpiry = updatedUser.vipExpiry || 0; const crEl = document.getElementById('displayCredits'); if (crEl) crEl.innerText = window.currentUserData.credits; }
                    document.getElementById('walletMainUI').innerHTML = `<div class="p-6 bg-green-50 rounded-2xl border-2 border-green-400 text-center space-y-2"><i class="fa-solid fa-circle-check text-5xl text-green-600 mb-2 animate-bounce"></i><h2 class="text-xl font-black text-green-900">पेमेंट सफल! (Auto-Verified)</h2><p class="text-xs font-bold text-green-700">आपका ₹${window.currentTotalPayable} का पेमेंट वेरीफाई हो गया है और आपके अकाउंट में तुरंत क्रेडिट्स/VIP जोड़ दिए गए हैं!</p><div class="pt-3"><button onclick="window.location.reload()" class="bg-green-600 hover:bg-green-700 text-white font-black py-2.5 px-6 rounded-xl text-xs shadow">डैशबोर्ड पर जाएँ</button></div></div>`;
                }
            });
        }
    } catch (err) { try { const fallbackDoc = await addDoc(collection(db, "payments"), { userId: window.currentUserData.uid, email: window.currentUserData.email, amountPaid: window.currentTotalPayable, creditsRequested: window.currentRechargeCredits, wantsVip: window.currentWantsVip, vipDaysRequested: window.currentVipDays, vipPlanFee: window.currentVipPlanFee, utrNumber: "ONLINE_UPI", timestamp: new Date(), status: "Pending" }); window.currentActiveOrderId = fallbackDoc.id; } catch (e) {} } finally { if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; } }

    window.currentUniversalUpiUrl = universalUpiUrl;
    document.getElementById('upiQRCode').src = qrUrl; 
    document.getElementById('qrPayableAmountText').innerText = `कुल पेमेंट: ₹${window.currentTotalPayable}`;
    const mainUpiBtn = document.getElementById('btnDirectUpiPay'); 
    if (mainUpiBtn) { 
        mainUpiBtn.href = universalUpiUrl; 
        mainUpiBtn.innerHTML = `<i class="fa-solid fa-bolt mr-1"></i> Any Other UPI App`; 
    }
    document.getElementById('paymentStep1').style.display = 'none'; 
    document.getElementById('qrSection').style.display = 'flex';
};

window.openUpiApp = function(app) {
    let upiUrl = window.currentUniversalUpiUrl || `upi://pay?pa=8279650137@amazonpay&pn=Ojas%20Print%20Service&am=${window.currentTotalPayable}&cu=INR&tn=${encodeURIComponent(window.currentWantsVip ? `Ojas VIP ${window.currentVipDays}d` : `Ojas Credits`)}`;
    const params = upiUrl.includes('?') ? upiUrl.substring(upiUrl.indexOf('?') + 1) : '';
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    let target = upiUrl;
    if (app === 'gpay') {
        if (isAndroid) {
            target = `intent://upi/pay?${params}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        } else if (isIOS) {
            target = `gpay://upi/pay?${params}`;
        }
    } else if (app === 'phonepe') {
        if (isAndroid) {
            target = `intent://upi/pay?${params}#Intent;scheme=upi;package=com.phonepe.app;end`;
        } else if (isIOS) {
            target = `phonepe://pay?${params}`;
        }
    } else if (app === 'paytm') {
        if (isAndroid) {
            target = `intent://upi/pay?${params}#Intent;scheme=upi;package=net.one97.paytm;end`;
        } else if (isIOS) {
            target = `paytmmp://pay?${params}`;
        }
    }
    window.location.href = target;
};

window.cancelAndBackToPaymentStep1 = async function() {
    if (window.activePaymentUnsubscribe) { window.activePaymentUnsubscribe(); window.activePaymentUnsubscribe = null; }
    if (window.currentActiveOrderId) { const orderIdToCancel = window.currentActiveOrderId; window.currentActiveOrderId = null; try { await updateDoc(doc(db, "payments", orderIdToCancel), { status: "Cancelled", cancelledBy: "User (Back without Payment)", cancelledAt: new Date() }); } catch (e) {} }
    document.getElementById('qrSection').style.display = 'none'; document.getElementById('paymentStep1').style.display = 'block'; alert("पेमेंट प्रोसेस कैंसिल कर दिया गया है (Payment Cancelled)।");
};

window.togglePaymentTicketBox = function() { const box = document.getElementById('paymentIssueTicketBox'); if (!box) return; box.style.display = box.style.display === 'none' ? 'block' : 'none'; };

window.submitPaymentIssueTicket = async function() {
    const rawUtr = document.getElementById('ticketUtrInput')?.value.trim() || ''; const utr = rawUtr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const resMsg = document.getElementById('paymentTicketResultMsg'); const btn = document.getElementById('btnRaisePaymentTicket');
    if (!utr || utr.length < 10) return alert("कृपया अपना 12-अंकों का सही UTR / Reference नंबर दर्ज करें!");
    const origHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> टिकट सबमिट हो रहा है...';

    const ticketMsgText = `💳 [PAYMENT UTR TICKET]\nAmount: ₹${window.currentTotalPayable}\nCredits: +${window.currentRechargeCredits} Cr${window.currentVipDays > 0 ? ` | VIP: +${window.currentVipDays}d` : ''}\nUTR No: ${utr}\nOrder ID: ${window.currentActiveOrderId || 'N/A'}\nNote: ऑनलाइन पेमेंट ऑटो-वेरीफाई नहीं हुआ, कृपया चेक करके क्रेडिट जोड़ें।`;
    try {
        if (window.currentActiveOrderId) { try { await updateDoc(doc(db, "payments", window.currentActiveOrderId), { utrNumber: utr, status: "Pending (Ticket Raised)", ticketRaisedAt: new Date() }); } catch (e) {} }
        const uid = window.currentUserData.uid; const chatRef = doc(db, "supportTickets", uid); const existingMsgs = Array.isArray(window.currentUserChatData?.messages) ? [...window.currentUserChatData.messages] : []; existingMsgs.push({ sender: 'user', text: ticketMsgText, time: Date.now() });
        await setDoc(chatRef, { type: 'PAYMENT_ISSUE_TICKET', userId: uid, userIdentifier: window.currentUserData.email, username: window.currentUserData.username, message: `💳 Payment UTR Ticket: ₹${window.currentTotalPayable} (UTR: ${utr})`, status: 'Open', unreadByAdmin: true, unreadByUser: false, timestamp: new Date(), updatedAtMs: Date.now(), messages: existingMsgs }, { merge: true });
        notifyAdminSecurely({ type: "PAYMENT_UTR_TICKET", user: window.currentUserData.email, amount: window.currentTotalPayable, utr: utr });
        resMsg.className = "p-3.5 rounded-xl bg-green-50 border border-green-300 text-green-900 text-xs font-bold text-center space-y-1 mt-2"; resMsg.innerHTML = `<div><i class="fa-solid fa-circle-check text-green-600 text-base mr-1"></i> आपका पेमेंट टिकट सफलतापूर्वक रेज़ हो गया है!</div><p class="text-[11px] text-green-800">आपका UTR नंबर (<strong>${utr}</strong>) दर्ज कर लिया गया है।</p>`; resMsg.style.display = 'block'; document.getElementById('ticketUtrInput').value = '';
    } catch (err) { alert("टिकट रेज़ करने में समस्या आई: " + err.message); } finally { btn.disabled = false; btn.innerHTML = origHtml; }
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
        const record = (window.historyData && window.historyData[historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[historyIndex]);
        if (record) {
            initialWithStamp = !!record.withStamp;
            initialStampFile = record.stampFile || 'stamp.png';
            initialCertFileId = (record.certificateFileId && record.isCertificateAttached !== false) ? record.certificateFileId : ''; 
        }
        if (initialWithStamp && !initialStampSrc && typeof window.getTransparentStampDataUrl === 'function') {
            initialStampSrc = await window.getTransparentStampDataUrl(initialStampFile);
        }
    }

    window.currentModalContext = { fileId: fileId, fileName: fileName, historyIndex: historyIndex, withStamp: initialWithStamp, stampFile: initialStampFile, stampSrc: initialStampSrc, certificateFileId: initialCertFileId };
    
    const previewParent = iframe.parentElement;
    previewParent.classList.add('flex', 'flex-col');
    if (shareBtn) shareBtn.style.display = 'none';

    if (isLocalDoc && historyIndex >= 0) {
        await window.preloadAllHtmlTemplates();
        if (shareBtn) shareBtn.style.display = 'flex';
        if (modalStampLabel) {
            if (isAnnexure) modalStampLabel.classList.remove('hidden');
            else modalStampLabel.classList.add('hidden');
        }
        if (modalStampCheckbox) modalStampCheckbox.checked = initialWithStamp;

        const record = (window.historyData && window.historyData[historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[historyIndex]);
        const fData = record?.formData || {}; if (record?.id && !fData.DOC_ID) fData.DOC_ID = record.id;
        spinner.style.display = 'none';
        
        if (initialCertFileId) {
            iframe.style.display = 'block'; iframe.style.flex = '1'; iframe.style.minHeight = '350px'; iframe.style.borderBottom = '4px solid #cbd5e1';
            iframe.src = `https://drive.google.com/file/d/${initialCertFileId}/preview`;
            
            htmlPreviewContainer.style.display = 'flex'; htmlPreviewContainer.style.flex = '1'; htmlPreviewContainer.style.minHeight = '350px';
            htmlPreviewContainer.innerHTML = window.buildLocalAffidavitHtml(fileId, fData, true, initialWithStamp, initialStampSrc);
        } else {
            iframe.style.display = 'none';
            htmlPreviewContainer.style.display = 'flex'; htmlPreviewContainer.style.flex = '1';
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

window.loadUserHistory = async function() {
    const historyContainer = document.getElementById('historyTableBody'); if (!historyContainer) return;
    historyContainer.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400 font-bold text-xs"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>Loading records...</td></tr>`;
    try {
        const q = query(collection(db, "history"), where("userId", "==", window.currentUserData.uid));
        const querySnapshot = await getDocs(q); window.historyData = [];
        querySnapshot.forEach((docSnap) => { window.historyData.push({ id: docSnap.id, ...docSnap.data() }); });
        window.historyData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); window.renderHistory('ALL');
    } catch (err) { historyContainer.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 text-xs">Failed to load history.</td></tr>`; }
};

window.handleUserHistoryFilterChange = function() {
    const type = document.getElementById('userHistoryTypeFilter')?.value || 'ALL';
    const date = document.getElementById('userHistoryDateFilter')?.value || '';
    const search = (document.getElementById('userHistorySearchInput')?.value || '').trim().toLowerCase();
    window.renderHistory(type, date, search);
};

window.editAnnexureRecord = async function(docId) {
    if (!docId) return;
    if (!window.currentUserData || !window.currentUserData.isAdmin) {
        alert('केवल एडमिन के पास ही एनेक्सर एडिट करने की अनुमति है!');
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
    if (!record) {
        alert('डॉक्यूमेंट रिकॉर्ड नहीं मिला!');
        return;
    }
    const sType = record.serviceType;
    const adminEditTabMap = {
        'Domicile': 'domicile',
        'Caste': 'caste',
        'e-Voter ID': 'evoter',
        'DOB Delhi': 'dob_delhi',
        'DOB Minor': 'dob_delhi',
        'Minor': 'minor',
        'DOB': 'minor',
        'Passport': 'passport',
        'Passport Services': 'passport',
        ...(window.ANNEXURE_SERVICE_TO_TAB || {})
    };
    const tabName = adminEditTabMap[sType] || '';
    if (!tabName) {
        alert('इस डॉक्यूमेंट का फॉर्म एडिट के लिए उपलब्ध नहीं है!');
        return;
    }

    window.currentEditingAnnexure = {
        docId: docId,
        serviceType: sType,
        fileId: record.fileId,
        fileName: record.fileName,
        formData: record.formData || {}
    };

    await window.switchService(tabName);
    setTimeout(() => {
        if (typeof window.populateAnnexureFormForEdit === 'function') {
            window.populateAnnexureFormForEdit(record.formData || {});
        }
    }, 150);
};

window.renderHistory = function(filterType = 'ALL', filterDate = '', filterSearch = '') {
    const historyContainer = document.getElementById('historyTableBody'); if (!historyContainer) return; historyContainer.innerHTML = '';
    const indexedData = window.historyData.map((item, idx) => ({ ...item, _origIndex: idx }));
    let filteredData = filterType === 'ALL' ? indexedData : indexedData.filter(item => item.serviceType === filterType);
    
    if (filterDate) {
        filteredData = filteredData.filter(item => {
            const sec = item.timestamp?.seconds || (item.timestamp ? Math.floor(new Date(item.timestamp).getTime() / 1000) : 0);
            if (!sec) return false;
            const d = new Date(sec * 1000);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}` === filterDate;
        });
    }

    if (filterSearch) {
        filteredData = filteredData.filter(item => {
            const fName = (item.fileName || '').toLowerCase();
            const fData = item.formData || {};
            const appName = (fData.applicantName || fData.parentName || fData.childName || fData.NAME || fData.newName || '').toLowerCase();
            return fName.includes(filterSearch) || appName.includes(filterSearch);
        });
    }

    document.getElementById('userHistoryCount').innerText = `Total Files: ${filteredData.length}`;

    if (filteredData.length === 0) { historyContainer.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 text-xs"><i class="fa-regular fa-folder-open text-3xl mb-2 text-slate-300"></i><br>No records found.</td></tr>`; return; }

    filteredData.forEach((data) => {
        const sec = data.timestamp?.seconds || Math.floor(Date.now() / 1000); const dateObj = new Date(sec * 1000);
        const dateStr = dateObj.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}); const timeStr = dateObj.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
        
        let badgesHtml = '';
        if (data.certificateFileId && data.isCertificateAttached !== false) { badgesHtml += `<span class="bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5"><i class="fa-solid fa-certificate mr-0.5"></i>Cert</span>`; }
        if (data.withStamp) { badgesHtml += `<span class="bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5"><i class="fa-solid fa-stamp mr-0.5"></i>Stamped</span>`; }
        if (data.adminStampCharged) { badgesHtml += `<span class="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5">+20 Cr Stamp</span>`; }
        if (data.adminCertCharged) { badgesHtml += `<span class="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-black ml-1.5">+20 Cr Cert</span>`; }
        
        historyContainer.innerHTML += `
            <tr class="border-b border-slate-100 text-xs hover:bg-slate-50 transition">
                <td class="p-3 font-bold text-slate-800">${data.fileName}${badgesHtml}</td>
                <td class="p-3"><span class="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">${data.serviceType}</span></td>
                <td class="p-3 text-slate-500 text-[11px] font-medium">${dateStr} <br> ${timeStr}</td>
                <td class="p-3 text-right whitespace-nowrap">
                    <button onclick="window.openPdfViewer('${data.fileId}', '${data.fileName}', ${data._origIndex})" class="inline-flex items-center gap-1 bg-royal-50 text-royal-700 border border-royal-200 hover:bg-royal-600 hover:text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition shadow-sm"><i class="fa-solid fa-print"></i> Preview / Print</button>
                </td>
            </tr>
        `;
    });
};

window.switchService = async function(serviceName) {
    if (!serviceName) serviceName = window.getFirstAllowedTab();

    if (window.currentUserData?.hasFreeAccess && (serviceName === 'add_credit' || serviceName === 'payments_history')) serviceName = window.getFirstAllowedTab();
    
    // Validate Document Tab Access
    if (serviceName === 'domicile' && !window.canCurrentUserSeeService('domicile')) serviceName = window.getFirstAllowedTab(); 
    else if (serviceName === 'caste' && !window.canCurrentUserSeeService('caste')) serviceName = window.getFirstAllowedTab(); 
    else if ((serviceName === 'evoter' || serviceName === 'e-voter') && !window.canCurrentUserSeeService('evoter')) serviceName = window.getFirstAllowedTab();
    else if (serviceName === 'dob_minor' && !window.canCurrentUserSeeService('dob_minor')) serviceName = window.getFirstAllowedTab();
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

    window.applyLivePortalControls(); const container = document.getElementById('formContainer'); if (!container) return;
    const submitBtnText = window.currentUserData && window.currentUserData.hasFreeAccess ? 'Generate Document (VIP Free) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>' : 'Generate Document (10 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';
    const statusTagHtml = window.currentUserData && window.currentUserData.hasFreeAccess ? '<span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] font-black border border-green-300 uppercase"><i class="fa-solid fa-crown mr-1"></i>Lifetime VIP Free</span>' : (window.currentUserData && window.currentUserData.isVip ? '<span class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-[10px] font-black border border-amber-300 uppercase"><i class="fa-solid fa-crown mr-1"></i>10 Credits</span>' : '<span class="bg-royal-100 text-royal-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-royal-300 uppercase">10 Credits</span>');

    if (serviceName === 'password') {
        container.innerHTML = `
        <div class="max-w-md mx-auto space-y-4 pt-2">
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-key text-royal-500 mr-1.5"></i> Change Portal Password</h3>
            </div>
            <form onsubmit="window.changeUserPassword(event)" class="bg-slate-50 p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Current Password (पुराना पासवर्ड)</label>
                    <div class="relative">
                        <input type="password" id="currentPassInput" required class="w-full p-3.5 pr-12 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-royal-500 bg-white">
                        <button type="button" onclick="window.togglePassVisibility('currentPassInput', this)" class="absolute right-4 top-3.5 text-slate-400 hover:text-royal-600 transition"><i class="fa-solid fa-eye text-base"></i></button>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">New Password (नया पासवर्ड)</label>
                    <div class="relative">
                        <input type="password" id="newPassInput" required minlength="6" placeholder="कम से कम 6 अक्षर का होना चाहिए" class="w-full p-3.5 pr-12 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-royal-500 bg-white">
                        <button type="button" onclick="window.togglePassVisibility('newPassInput', this)" class="absolute right-4 top-3.5 text-slate-400 hover:text-royal-600 transition"><i class="fa-solid fa-eye text-base"></i></button>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password (कन्फर्म करें)</label>
                    <div class="relative">
                        <input type="password" id="confirmPassInput" required minlength="6" placeholder="नया पासवर्ड दोबारा लिखें" class="w-full p-3.5 pr-12 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-royal-500 bg-white">
                        <button type="button" onclick="window.togglePassVisibility('confirmPassInput', this)" class="absolute right-4 top-3.5 text-slate-400 hover:text-royal-600 transition"><i class="fa-solid fa-eye text-base"></i></button>
                    </div>
                </div>
                <div id="passChangeMsg" style="display:none;"></div>
                <button type="submit" id="btnChangePass" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-glow transition">Update Password</button>
            </form>
        </div>`;
        return;
    }

    if (serviceName === 'add_credit') {
        container.innerHTML = `
        <div id="walletMainUI" class="max-w-xl mx-auto space-y-4">
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-wallet text-royal-500 mr-1.5"></i> Add Portal Credits (वॉलेट रिचार्ज)</h3>
                <span class="bg-royal-100 text-royal-900 border border-royal-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">₹1 = 1 Credit</span>
            </div>
            <div id="paymentStep1" class="space-y-4">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <label class="block text-xs font-black text-slate-700 uppercase">Enter Recharge Amount (₹)</label>
                    <input type="number" id="rupeeAmount" min="100" value="100" placeholder="Minimum ₹100" oninput="window.calculateCredits()" class="w-full p-3.5 border border-slate-300 rounded-xl text-lg font-black outline-none focus:border-royal-500 bg-white">
                    <div class="grid grid-cols-4 gap-2 pt-1">
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=100;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹100</button>
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=200;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹200</button>
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=500;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹500</button>
                        <button type="button" onclick="document.getElementById('rupeeAmount').value=1000;window.calculateCredits();" class="bg-white hover:bg-royal-50 border border-slate-200 hover:border-royal-400 rounded-xl py-2 text-xs font-black text-slate-700 transition">+₹1000</button>
                    </div>
                </div>
                <div class="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-1.5 text-xs">
                    <div class="font-black text-indigo-950 uppercase text-[11px] mb-1"><i class="fa-solid fa-tags mr-1 text-royal-600"></i> पोर्टल सर्विस रेट लिस्ट (Service Rates):</div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• मूल निवास / जाति / ई-वोटर / दिल्ली DOB:</span><span class="font-black text-emerald-700">10 Credits (₹10)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• पासपोर्ट सर्विस (Passport):</span><span class="font-black text-sky-700">30 Credits (₹30)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• जन्म प्रमाण पत्र (DOB / DOB Print):</span><span class="font-black text-amber-800">50 Credits (₹50)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• गैजेट नोटिफिकेशन (Gazette Notification):</span><span class="font-black text-purple-800">100 Credits (₹100)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• एनेक्सर जनरेट (Annexure Generate):</span><span class="font-black text-emerald-700">10 Credits (₹10)</span></div>
                    <div class="flex justify-between font-bold text-slate-700"><span>• केवल स्टैम्प (+₹20) | सर्टिफिकेट (+₹20):</span><span class="font-black text-royal-700">₹30 (Stamp) / ₹50 (Complete)</span></div>
                </div>
                <div class="bg-dark-950 p-4 rounded-2xl text-white">
                    <div class="flex justify-between items-center mb-3 pb-3 border-b border-slate-800"><span class="text-xs font-bold text-slate-400">Credits You Get:</span><span id="calculatedCredits" class="text-lg font-black text-emerald-400">100 Cr</span></div>
                    <div class="flex justify-between items-center mb-4"><span class="text-sm font-black uppercase text-royal-300">Total Payable:</span><span id="totalPayableDisplay" class="text-2xl font-black text-white">₹100</span></div>
                    <button id="btnGenerateQR" onclick="window.generateQR()" class="w-full bg-royal-500 hover:bg-royal-400 text-white font-black py-3.5 rounded-xl shadow-glow transition">Proceed to Pay</button>
                </div>
            </div>
            <div id="qrSection" style="display:none;" class="flex-col items-center justify-center space-y-4">
                <div class="w-full max-w-sm mx-auto bg-amber-500/15 border-2 border-amber-500 rounded-2xl p-4 text-center shadow-lg animate-pulse">
                    <div class="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 font-black text-xs md:text-sm uppercase tracking-wide">
                        <i class="fa-solid fa-triangle-exclamation text-base text-amber-500"></i>
                        <span>कृपया पेज को बैक या रिफ्रेश न करें</span>
                    </div>
                    <p class="text-[11px] font-bold text-amber-950 dark:text-amber-200 mt-1.5 leading-relaxed">
                        ⚠️ <strong>Please DO NOT Refresh or Go Back!</strong><br>
                        QR कोड स्कैन करके पेमेंट करें। पेमेंट सफल होते ही यह स्क्रीन ऑटोमैटिक अपडेट होकर कन्फर्मेशन दिखा देगी।
                    </p>
                </div>

                <div class="bg-white dark:bg-dark-900 p-6 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 text-center w-full max-w-sm mx-auto">
                    <div class="flex items-center justify-center gap-2 mb-1">
                        <span class="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                        <h4 class="text-sm font-black text-dark-900 dark:text-white uppercase tracking-wider">Scan &amp; Pay (Auto-Verify)</h4>
                    </div>
                    <p id="qrPayableAmountText" class="text-sm font-black text-royal-600 dark:text-royal-400 mb-4">कुल पेमेंट: ₹0</p>
                    
                    <div class="bg-white p-3 rounded-2xl inline-block border-2 border-slate-300 dark:border-slate-600 shadow-inner mb-4">
                        <img id="upiQRCode" src="" alt="Payment QR Code" class="w-52 h-52 object-contain mx-auto">
                    </div>

                    <p class="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4">
                        Google Pay, PhonePe, Paytm या किसी भी UPI ऐप से यह QR कोड स्कैन करके पेमेंट पूरा करें।
                    </p>

                    <button type="button" onclick="window.cancelAndBackToPaymentStep1()" class="w-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 font-black py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm">
                        <i class="fa-solid fa-ban"></i> Cancel Payment &amp; Go Back
                    </button>
                </div>

                <div class="text-center">
                    <button type="button" onclick="window.togglePaymentTicketBox()" class="text-xs font-bold text-royal-600 dark:text-royal-400 hover:underline">
                        पेमेंट कट गया पर क्रेडिट नहीं मिला? यहाँ क्लिक करें
                    </button>
                </div>
                <div id="paymentIssueTicketBox" style="display:none;" class="bg-indigo-50 dark:bg-slate-800 p-4 rounded-2xl border border-indigo-200 dark:border-slate-700 w-full max-w-sm mx-auto">
                    <label class="block text-[11px] font-black text-indigo-900 dark:text-indigo-300 uppercase mb-2">12-Digit UTR / Ref Number</label>
                    <input type="text" id="ticketUtrInput" placeholder="e.g. 312345678901" class="w-full p-3 border border-indigo-300 dark:border-slate-600 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 mb-2 outline-none">
                    <button type="button" id="btnRaisePaymentTicket" onclick="window.submitPaymentIssueTicket()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition">Submit UTR</button>
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
        container.innerHTML = `<div class="space-y-4"><div id="userValidityInfoBox"></div><div class="grid grid-cols-3 gap-2 md:gap-4"><div class="p-3 rounded-xl bg-slate-50 border border-slate-200"><p class="text-[10px] font-bold text-slate-400 uppercase">कुल ट्रांजैक्शन</p><p id="sumTotalTxns" class="text-lg md:text-2xl font-black text-dark-900">0</p></div><div class="p-3 rounded-xl bg-green-50 border border-green-200"><p class="text-[10px] font-bold text-green-700 uppercase">सफल (Approved)</p><p id="sumApprovedAmt" class="text-lg md:text-2xl font-black text-green-700">₹0</p></div><div class="p-3 rounded-xl bg-amber-50 border border-amber-200"><p class="text-[10px] font-bold text-amber-800 uppercase">पेंडिंग (Pending)</p><p id="sumPendingAmt" class="text-lg md:text-2xl font-black text-amber-700">₹0 (0)</p></div></div><div><div class="flex justify-between items-center mb-2"><h4 class="text-sm md:text-base font-black text-dark-900"><i class="fa-solid fa-receipt text-royal-500 mr-1.5"></i> पेमेंट और VIP हिस्ट्री</h4><button onclick="window.loadUserPayments()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fa-solid fa-rotate-right mr-1"></i> Refresh</button></div><div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="w-full text-left border-collapse bg-white min-w-[520px]"><thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase"><tr><th class="p-3">तारीख (Date)</th><th class="p-3">राशि</th><th class="p-3">क्रेडिट्स / VIP</th><th class="p-3">UTR / Mode</th><th class="p-3 text-right">स्टेटस</th></tr></thead><tbody id="userPaymentsTableBody" class="text-xs text-slate-700"></tbody></table></div></div></div>`; 
        window.loadUserPayments(); 
        return; 
    }
    
    if (serviceName === 'history') { 
        const cfg = window.portalConfigState; 
        const domOpt = cfg.showDomicile !== false ? `<option value="Domicile">मूल निवास (Domicile)</option>` : ''; 
        const casOpt = cfg.showCaste !== false ? `<option value="Caste">जाति प्रमाण पत्र (Caste)</option>` : ''; 
        const evoterOpt = window.canCurrentUserSeeService('evoter') ? `<option value="e-Voter ID">e-Voter ID</option>` : ''; 
        const dobDelhiOpt = window.canCurrentUserSeeService('dob_delhi') ? `<option value="DOB Delhi">DOB Delhi (MCD)</option>` : '';
        const passportOpt = window.canCurrentUserSeeService('passport') ? `<option value="Passport">Passport</option>` : '';
        const minorOpt = window.canCurrentUserSeeService('minor') ? `<option value="Minor">DOB (Minor • ₹50)</option>` : '';
        const dobPrintOpt = window.canCurrentUserSeeService('dob_print') ? `<option value="DOB Print">DOB Print (₹50)</option>` : '';
        const gazetteOpt = window.canCurrentUserSeeService('gazette') ? `<option value="Gazette Notification">Gazette Notification (₹100)</option>` : '';
        const vipFilterOptions = `${evoterOpt}${dobDelhiOpt}${passportOpt}${minorOpt}${dobPrintOpt}${gazetteOpt}<option value="Annexure 1">Annexure 1</option><option value="Annexure 1A">Annexure 1A</option><option value="Annexure 3">Annexure 3</option><option value="Annexure 3A">Annexure 3A</option><option value="Annexure B">Annexure B</option><option value="Annexure C">Annexure C</option><option value="Annexure D">Annexure D</option><option value="Annexure E">Annexure E</option><option value="Annexure F">Annexure F</option>`; 
        
        container.innerHTML = `<div class="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3 mb-4">
            <div>
                <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-folder-open text-royal-500 mr-1.5"></i> Document History</h3>
                <p id="userHistoryCount" class="text-[11px] font-bold text-royal-600">Total Files: 0</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <div class="relative min-w-[170px]">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                    <input type="text" id="userHistorySearchInput" oninput="window.handleUserHistoryFilterChange()" placeholder="नाम या फ़ाइल से खोजें..." class="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-bold outline-none focus:bg-white focus:border-royal-400">
                </div>
                <select id="userHistoryTypeFilter" onchange="window.handleUserHistoryFilterChange()" class="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-semibold outline-none"><option value="ALL">All Documents</option>${domOpt}${casOpt}${vipFilterOptions}</select>
                <button onclick="window.loadUserHistory()" class="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-200"><i class="fa-solid fa-rotate-right"></i></button>
            </div>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="w-full text-left border-collapse bg-white min-w-[500px]"><thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase"><tr><th class="p-3">File Name</th><th class="p-3">Type</th><th class="p-3">Date & Time</th><th class="p-3 text-right">Action</th></tr></thead><tbody id="historyTableBody" class="text-xs text-slate-700"></tbody></table></div>`; 
        
        window.loadUserHistory(); 
    }
};

window.loadUserPayments = async function() {
    const tableBody = document.getElementById('userPaymentsTableBody'); if (!tableBody) return; tableBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 font-bold text-xs"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-royal-500"></i><br>Loading payment history...</td></tr>`;
    try { 
        const querySnapshot = await getDocs(query(collection(db, "payments"), where("userId", "==", window.currentUserData.uid))); 
        window.userPaymentsData = []; 
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
            window.userPaymentsData.push(item); 
        }); 
        window.userPaymentsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); 
        let sumApproved = 0, sumPending = 0, pendingCount = 0; 
        window.userPaymentsData.forEach(item => { 
            const amt = parseFloat(item.amountPaid) || 0; 
            if (item.status === 'Approved' || item.status === 'Auto-Approved') { 
                sumApproved += amt; 
            } else if (item.status === 'Pending' || (item.status || '').includes('Ticket')) { 
                sumPending += amt; 
                pendingCount++; 
            } 
        }); 
        document.getElementById('sumTotalTxns').innerText = window.userPaymentsData.length; 
        document.getElementById('sumApprovedAmt').innerText = `₹${sumApproved}`; 
        document.getElementById('sumPendingAmt').innerText = `₹${sumPending} (${pendingCount})`; 
        tableBody.innerHTML = ''; 
        if (window.userPaymentsData.length === 0) { 
            tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i><br>आपने अभी तक कोई पेमेंट नहीं किया है।</td></tr>`; 
            return; 
        } 
        window.userPaymentsData.forEach(data => { 
            const sec = data.timestamp?.seconds || Math.floor(Date.now() / 1000); 
            const dateObj = new Date(sec * 1000); 
            const dateStr = dateObj.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}); 
            const timeStr = dateObj.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}); 
            const isGift = (data.status === 'Gift / Bonus');
            let statusBadge = ''; 
            if (isGift) {
                statusBadge = `<span class="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-black"><i class="fa-solid fa-gift mr-1"></i>Gift / Bonus</span>`;
            } else if ((data.status || '').includes('Ticket')) { 
                statusBadge = `<span class="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-black"><i class="fa-solid fa-ticket mr-1"></i>Ticket Raised</span>`; 
            } else if (data.status === 'Pending') { 
                statusBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-black"><i class="fa-solid fa-clock mr-1"></i>Pending</span>`; 
            } else if (data.status === 'Approved' || data.status === 'Auto-Approved') { 
                statusBadge = `<span class="bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded text-[10px] font-black"><i class="fa-solid fa-check-circle mr-1"></i>Approved</span>`; 
            } else { 
                statusBadge = `<span class="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-black"><i class="fa-solid fa-circle-xmark mr-1"></i>${data.status}</span>`; 
            } 
            const vipDays = data.vipDaysRequested || (data.wantsVip ? 30 : 0); 
            const creds = data.creditsRequested !== undefined ? data.creditsRequested : (data.creditsAdded || 0); 

            const amountText = isGift 
                ? `<span class="text-purple-700 font-black text-xs bg-purple-50 px-2 py-0.5 rounded border border-purple-200">🎁 FREE</span>` 
                : `₹${data.amountPaid || 0}`;

            const utrText = isGift 
                ? `<span class="text-purple-700 font-bold"><i class="fa-solid fa-gift text-purple-500 mr-1"></i>Admin Gift</span>` 
                : (data.utrNumber || 'ONLINE_UPI');

            const noteLine = data.note ? `<span class="text-[10px] text-purple-700 font-black flex items-center gap-1"><i class="fa-solid fa-gift text-purple-500"></i> ${data.note}</span>` : '';

            tableBody.innerHTML += `<tr class="border-b border-slate-100 text-xs hover:bg-slate-50 transition">
                <td class="p-3 text-slate-500 font-medium whitespace-nowrap">${dateStr} <br> <span class="text-[10px] text-slate-400">${timeStr}</span></td>
                <td class="p-3 font-black text-slate-800 text-sm whitespace-nowrap">${amountText}</td>
                <td class="p-3">
                    <div class="flex flex-col gap-0.5">
                        ${creds > 0 ? `<span class="font-bold text-royal-600">+${creds} Cr</span>` : ''}
                        ${vipDays > 0 ? `<span class="bg-amber-400 text-dark-950 px-1.5 py-0.5 rounded text-[9px] font-black inline-block w-max">👑 +${vipDays}d VIP</span>` : ''}
                        ${noteLine}
                    </div>
                </td>
                <td class="p-3 font-mono font-bold text-slate-600 text-[11px] whitespace-nowrap">${utrText}</td>
                <td class="p-3 text-right whitespace-nowrap">${statusBadge}</td>
            </tr>`; 
        }); 
    } catch (err) { 
        tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 text-xs">Failed to load payment history.</td></tr>`; 
    }
};
