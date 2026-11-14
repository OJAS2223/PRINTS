// ============================================================================
// FILE: js/admin-users-chat.js
// User Management, Access Controls, Banners, Credits & Live 2-Way Support Chat
// ============================================================================

const {
    firebaseConfig, db, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, onSnapshot
} = window.fb;

const ADMIN_EMAIL = window.ADMIN_EMAIL;

window.loadAllUsersForDropdown = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        window.usersDataList = {};
        window.allUsersMap = {};
        const selectDropdown = document.getElementById('userSelectDropdown');
        if (selectDropdown) {
            selectDropdown.innerHTML = '<option value="">-- किसी यूज़र को चुनें --</option>';
        }
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            window.usersDataList[docSnap.id] = data;
            window.allUsersMap[docSnap.id] = data.email || 'Unknown User';
            if (selectDropdown && (data.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
                selectDropdown.innerHTML += `<option value="${docSnap.id}">${data.email} (${data.userPhone || 'No Phone'})</option>`;
            }
        });
        if (typeof window.populateSupportUserDropdown === 'function') {
            window.populateSupportUserDropdown();
        }
    } catch (err) {}
};

window.handleUserSelection = function() {
    const uid = document.getElementById('userSelectDropdown')?.value;
    if (!uid || !window.usersDataList[uid]) {
        if (document.getElementById('currentUserCreditsDisplay')) document.getElementById('currentUserCreditsDisplay').innerText = '--';
        if (document.getElementById('selectedUserVipBadge')) document.getElementById('selectedUserVipBadge').innerText = '--';
        if (document.getElementById('selectedUserPhoneInput')) document.getElementById('selectedUserPhoneInput').value = '';
        if (document.getElementById('selectedUserSavedPass')) document.getElementById('selectedUserSavedPass').innerText = '--';
        if (typeof window.updateUserBannerPreview === 'function') window.updateUserBannerPreview();
        return;
    }
    const uData = window.usersDataList[uid];
    if (document.getElementById('currentUserCreditsDisplay')) document.getElementById('currentUserCreditsDisplay').innerText = uData.credits || 0;
    if (document.getElementById('selectedUserVipBadge')) document.getElementById('selectedUserVipBadge').innerText = 'Active Normal User';
    if (document.getElementById('selectedUserPhoneInput')) document.getElementById('selectedUserPhoneInput').value = uData.userPhone || '';
    if (document.getElementById('selectedUserSavedPass')) document.getElementById('selectedUserSavedPass').innerText = uData.userPass || 'Not Set';

    if (document.getElementById('userDomicileToggle')) document.getElementById('userDomicileToggle').checked = uData.allowDomicile !== false;
    if (document.getElementById('userCasteToggle')) document.getElementById('userCasteToggle').checked = uData.allowCaste !== false;
    if (document.getElementById('userEvoterToggle')) document.getElementById('userEvoterToggle').checked = uData.allowEvoter !== false;
    if (document.getElementById('userMinorToggle')) document.getElementById('userMinorToggle').checked = uData.allowMinor !== false;
    if (document.getElementById('userDobDelhiToggle')) document.getElementById('userDobDelhiToggle').checked = (uData.allowDobDelhi !== false && uData.allowDobMinor !== false);
    if (document.getElementById('userDobPrintToggle')) document.getElementById('userDobPrintToggle').checked = uData.allowDobPrint !== false;
    if (document.getElementById('userPassportToggle')) document.getElementById('userPassportToggle').checked = uData.allowPassport !== false;
    if (document.getElementById('userGazetteToggle')) document.getElementById('userGazetteToggle').checked = uData.allowGazette !== false;
    if (document.getElementById('userAnnexuresToggle')) document.getElementById('userAnnexuresToggle').checked = uData.allowAnnexures !== false;
    if (document.getElementById('userPanFindToggle')) document.getElementById('userPanFindToggle').checked = uData.allowPanFind !== false;
    if (document.getElementById('userPanPrimeToggle')) document.getElementById('userPanPrimeToggle').checked = uData.allowPanPrime !== false;
    if (document.getElementById('userMobileToUanToggle')) document.getElementById('userMobileToUanToggle').checked = uData.allowMobileToUan !== false;
    if (document.getElementById('userInstantVoterLinkToggle')) document.getElementById('userInstantVoterLinkToggle').checked = uData.allowInstantVoterLink !== false;
    if (document.getElementById('userLlExamToggle')) document.getElementById('userLlExamToggle').checked = uData.allowLlExam !== false;
    if (document.getElementById('userDlPdfToggle')) document.getElementById('userDlPdfToggle').checked = uData.allowDlPdf !== false;
    if (document.getElementById('userEshramMobileToggle')) document.getElementById('userEshramMobileToggle').checked = uData.allowEshramMobile !== false;
    if (document.getElementById('userLlPdfToggle')) document.getElementById('userLlPdfToggle').checked = uData.allowLlPdf !== false;

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
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="bg-amber-400 text-dark-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">${badge}</span>
                        <span class="text-xs font-black text-amber-300">डियर ${name},</span>
                        ${title ? `<span class="text-xs font-black text-white">${title}</span>` : ''}
                    </div>
                    ${btnHtml}
                </div>
                <p class="text-xs font-semibold text-slate-200 leading-relaxed">${displayMsg}</p>
            </div>
        </div>
    `;
};

window.saveSelectedUserBanner = async function(event) {
    if (event) event.preventDefault();
    const uid = document.getElementById('userSelectDropdown')?.value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से यूज़र चुनें!');

    const btn = document.getElementById('btnSaveUserBanner');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...'; }

    const payload = {
        personalBannerEnabled: !!document.getElementById('chkUserBannerEnabled')?.checked,
        personalBannerBadge: document.getElementById('inpUserBannerBadge')?.value.trim() || 'NOTICE',
        personalBannerTitle: document.getElementById('inpUserBannerTitle')?.value.trim() || '',
        personalBannerMessage: document.getElementById('inpUserBannerMessage')?.value.trim() || '',
        personalBannerBtnText: document.getElementById('inpUserBannerBtnText')?.value.trim() || '',
        personalBannerBtnLink: document.getElementById('inpUserBannerBtnLink')?.value.trim() || '',
        personalBannerUpdatedAt: new Date()
    };

    try {
        await updateDoc(doc(db, "users", uid), payload);
        Object.assign(window.usersDataList[uid], payload);
        alert(`✅ यूज़र (${window.usersDataList[uid].email}) का पर्सनल बैनर सेव हो गया है!`);
    } catch (err) {
        alert('Error saving banner: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
};

window.clearSelectedUserBanner = async function() {
    const uid = document.getElementById('userSelectDropdown')?.value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से यूज़र चुनें!');
    if (!confirm('क्या आप इस यूज़र का पर्सनल बैनर हटाना चाहते हैं?')) return;

    const payload = {
        personalBannerEnabled: false,
        personalBannerBadge: 'NOTICE',
        personalBannerTitle: '',
        personalBannerMessage: '',
        personalBannerBtnText: '',
        personalBannerBtnLink: ''
    };
    try {
        await updateDoc(doc(db, "users", uid), payload);
        Object.assign(window.usersDataList[uid], payload);
        window.handleUserSelection();
        alert('✅ पर्सनल बैनर हटा दिया गया है!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.copyUtrText = function(utr, btnEl) {
    navigator.clipboard.writeText(utr);
    const orig = btnEl.innerHTML;
    btnEl.innerHTML = '<i class="fa-solid fa-check text-green-600"></i> Copied';
    setTimeout(() => { btnEl.innerHTML = orig; }, 1500);
};
window.getPortalLoginUrl = function() { return window.location.origin + '/portal'; };
window.formatCleanPhone = function(rawPhone = '') {
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    return digits;
};

window.buildUserCredentialsText = function(email, pass, credits) {
    return `🌟 Ojas Print Service - Login Details 🌟\n\n👤 User ID: ${email}\n🔑 Password: ${pass || 'Not Set'}\n💰 Credits Balance: ${(credits || 0)} Cr\n✨ Status: Active Portal Account (All Services Enabled)\n\n🌐 Login Portal Link:\n${window.getPortalLoginUrl()}`;
};

window.shareSelectedUserCredentials = async function(channel) {
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से यूज़र सेलेक्ट करें!');
    const uData = window.usersDataList[uid];
    const phoneInput = document.getElementById('selectedUserPhoneInput')?.value.trim() || '';
    if (phoneInput && phoneInput !== uData.userPhone) {
        try { await updateDoc(doc(db, "users", uid), { userPhone: phoneInput }); uData.userPhone = phoneInput; } catch (e) {}
    }
    const passToUse = uData.userPass || '[कृपया पहले नया पासवर्ड सेट करें]';
    const messageText = window.buildUserCredentialsText(uData.email, passToUse, uData.credits, uData.isVip, uData.vipExpiry);

    if (channel === 'copy') {
        navigator.clipboard.writeText(messageText);
        alert('यूज़र की ID और Password डिटेल्स कॉपी हो गई हैं!');
        return;
    }
    if (channel === 'whatsapp') {
        let targetPhone = window.formatCleanPhone(phoneInput || uData.userPhone || '');
        if (!targetPhone) {
            const askPhone = prompt("यूज़र का 10 अंकों का WhatsApp नंबर डालें (या बिना नंबर सीधे WhatsApp खोलने के लिए खाली छोड़कर OK दबाएं):", "");
            if (askPhone === null) return;
            if (askPhone.trim()) {
                targetPhone = window.formatCleanPhone(askPhone.trim());
                try {
                    await updateDoc(doc(db, "users", uid), { userPhone: askPhone.trim() });
                    uData.userPhone = askPhone.trim();
                    if (document.getElementById('selectedUserPhoneInput')) {
                        document.getElementById('selectedUserPhoneInput').value = askPhone.trim();
                    }
                } catch (e) {}
            }
        }
        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}` : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
    } else if (channel === 'email') {
        const targetEmail = uData.contactEmail || (uData.email.endsWith('@print.com') ? prompt("यूज़र का असली Email एड्रेस डालें:", "") : uData.email);
        if (!targetEmail) return;
        window.open(`mailto:${targetEmail}?subject=${encodeURIComponent("Ojas Print Service - Your Login ID & Password")}&body=${encodeURIComponent(messageText)}`, '_self');
    }
};

window.saveSelectedUserPhone = async function() {
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले यूज़र सेलेक्ट करें!');
    const phoneVal = document.getElementById('selectedUserPhoneInput').value.trim();
    try {
        await updateDoc(doc(db, "users", uid), { userPhone: phoneVal });
        window.usersDataList[uid].userPhone = phoneVal;
        alert('यूज़र का WhatsApp नंबर सेव हो गया!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
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
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.deleteSelectedUserAccount = async function() {
    if (window.currentUserData?.isSubAdmin && !window.currentUserData?.isSuperAdmin) {
        return alert('यूज़र अकाउंट डिलीट करने का अधिकार केवल Super Admin के पास है!');
    }
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले ड्रॉपडाउन से उस यूज़र को सेलेक्ट करें जिसे आप डिलीट करना चाहते हैं!');
    const uData = window.usersDataList[uid];
    if (window.isSuperAdminEmail && window.isSuperAdminEmail(uData.email || '')) {
        return alert('आप सुपर एडमिन अकाउंट को डिलीट नहीं कर सकते!');
    }
    if (!confirm(`⚠️ चेतावनी!\n\nक्या आप वाकई यूज़र "${uData.email}" का अकाउंट हमेशा के लिए डिलीट करना चाहते हैं?`)) return;
    const btn = document.getElementById('btnDeleteUserAccount');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Deleting User...'; }

    try {
        if (uData.userPass) {
            try {
                const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: uData.email, password: uData.userPass, returnSecureToken: true })
                });
                const signInData = await signInRes.json();
                if (signInData.idToken) {
                    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseConfig.apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: signInData.idToken })
                    });
                }
            } catch (e) {}
        }
        await deleteDoc(doc(db, "users", uid));
        try { await deleteDoc(doc(db, "supportTickets", uid)); } catch (e) {}
        delete window.usersDataList[uid];
        await window.loadAllUsersForDropdown();
        document.getElementById('userSelectDropdown').value = '';
        window.handleUserSelection();
        const msg = document.getElementById('adminMsg');
        if (msg) {
            msg.className = "p-3.5 bg-red-50 text-red-800 rounded-2xl text-xs font-black border border-red-300 text-center shadow-sm";
            msg.innerHTML = `<i class="fa-solid fa-trash-can mr-1"></i> यूज़र <strong>${uData.email}</strong> का अकाउंट हमेशा के लिए डिलीट कर दिया गया है!`;
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 4000);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
};

window.adminSetNewUserPassword = async function() {
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले यूज़र चुनें!');
    const newPass = document.getElementById('adminNewResetPass').value.trim();
    if (newPass.length < 6) return alert('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए!');
    const btn = document.getElementById('btnAdminSetPass');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try {
        const uData = window.usersDataList[uid];
        if (uData.userPass) {
            try {
                const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: uData.email, password: uData.userPass, returnSecureToken: true })
                });
                const signInData = await signInRes.json();
                if (signInData.idToken) {
                    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: signInData.idToken, password: newPass, returnSecureToken: true })
                    });
                }
            } catch (e) {}
        }
        await updateDoc(doc(db, "users", uid), { userPass: newPass, adminResetPass: newPass, passUpdatedAt: new Date() });
        window.usersDataList[uid].userPass = newPass;
        document.getElementById('selectedUserSavedPass').innerText = newPass;
        document.getElementById('adminNewResetPass').value = '';
        alert('पासवर्ड सफलतापूर्वक बदल दिया गया है!');
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};

window.adjustCredits = async function(action) {
    if (window.currentUserData?.isSubAdmin && !window.currentUserData?.isSuperAdmin) {
        return alert('एक्स्ट्रा क्रेडिट्स मैन्युअली बढ़ाने या घटाने का अधिकार केवल Super Admin के पास है!');
    }
    const uid = document.getElementById('userSelectDropdown').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया पहले यूज़र चुनें!');
    const amtVal = parseInt(document.getElementById('creditAdjustmentAmount').value);
    if (isNaN(amtVal) || amtVal <= 0) return alert('कृपया सही क्रेडिट वैल्यू डालें!');
    const uData = window.usersDataList[uid];
    let currentCredits = uData.credits || 0;
    let newCredits = action === 'add' ? currentCredits + amtVal : currentCredits - amtVal;
    if (newCredits < 0) newCredits = 0;

    const giftNote = document.getElementById('adminCreditGiftNote')?.value.trim() || (action === 'add' ? 'Admin Credit Gift / Bonus' : 'Admin Credit Adjustment');

    try {
        await updateDoc(doc(db, "users", uid), { credits: newCredits });
        window.usersDataList[uid].credits = newCredits;

        await addDoc(collection(db, "payments"), {
            userId: uid,
            email: uData.email,
            amountPaid: 0,
            creditsRequested: action === 'add' ? amtVal : -amtVal,
            wantsVip: false,
            vipDaysRequested: 0,
            vipPlanFee: 0,
            utrNumber: action === 'add' ? "ADMIN_GIFT" : "ADMIN_DEDUCT",
            status: action === 'add' ? "Gift / Bonus" : "Admin Deduction",
            note: giftNote,
            timestamp: new Date()
        });
        if (document.getElementById('adminCreditGiftNote')) {
            document.getElementById('adminCreditGiftNote').value = '';
        }

        window.handleUserSelection();
        document.getElementById('creditAdjustmentAmount').value = '';
        alert(action === 'add'
            ? `सफलतापूर्वक +${amtVal} क्रेडिट्स गिफ्ट/जोड़ दिए गए हैं और पासबुक हिस्ट्री में रिकॉर्ड हो गया है!`
            : `क्रेडिट्स सफलतापूर्वक घटा दिए गए हैं!`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.createNewUserByAdmin = async function(e) {
    e.preventDefault();
    const emailInp = document.getElementById('newAdminUserEmail').value.trim().toLowerCase();
    const pass = document.getElementById('newAdminUserPass').value.trim();
    const phone = document.getElementById('newAdminUserPhone').value.trim();
    const credits = parseInt(document.getElementById('newAdminUserCredits').value) || 0;
    const msg = document.getElementById('adminCreateMsg');
    const email = emailInp.includes('@') ? emailInp : `${emailInp}@print.com`;
    if (pass.length < 6) return alert('पासवर्ड 6 अक्षरों का होना चाहिए!');
    msg.className = "p-3 bg-blue-50 text-blue-800 rounded-xl text-xs font-bold text-center";
    msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating user account...';
    msg.classList.remove('hidden');
    try {
        const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pass, returnSecureToken: true })
        });
        const signUpData = await signUpRes.json();
        if (signUpData.error) throw new Error(signUpData.error.message);
        const uid = signUpData.localId;
        await setDoc(doc(db, "users", uid), {
            email: email,
            username: email.split('@')[0],
            credits: credits,
            isVip: false,
            vipExpiry: 0,
            allowEvoter: true,
            allowMinor: true,
            allowDobDelhi: true,
            allowDobMinor: true,
            allowDomicile: true,
            allowCaste: true,
            allowDobPrint: true,
            allowPassport: true,
            allowGazette: true,
            allowAnnexures: true, allowPanFind: true, allowPanPrime: true, allowMobileToUan: true, allowInstantVoterLink: true, allowLlExam: true, allowDlPdf: true, allowEshramMobile: true, allowLlPdf: true,
            userPass: pass,
            adminResetPass: pass,
            userPhone: phone,
            createdAt: new Date()
        });
        if (credits > 0) {
            await addDoc(collection(db, "payments"), {
                userId: uid,
                email: email,
                amountPaid: 0,
                creditsRequested: credits,
                wantsVip: false,
                vipDaysRequested: 0,
                vipPlanFee: 0,
                utrNumber: "ADMIN_GIFT",
                status: "Gift / Bonus",
                note: "Welcome Opening Credits",
                timestamp: new Date()
            });
        }
        await window.loadAllUsersForDropdown();
        msg.className = "p-3.5 bg-green-50 text-green-900 border border-green-300 rounded-xl text-xs font-black text-center";
        msg.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> यूज़र <strong>${email}</strong> सफलतापूर्वक बन गया है!`;
        e.target.reset();
        setTimeout(() => msg.classList.add('hidden'), 5000);
    } catch (err) {
        msg.className = "p-3 bg-red-50 text-red-800 border border-red-300 rounded-xl text-xs font-bold text-center";
        msg.innerText = "Error: " + err.message;
    }
};

// ================= LIVE 2-WAY SUPPORT CHAT =================
window.findUserUidByIdentifier = function(identifier = '') {
    const clean = String(identifier).trim().toLowerCase();
    if (!clean) return '';
    for (const [uid, uData] of Object.entries(window.usersDataList)) {
        const emailLower = (uData.email || '').toLowerCase();
        const unameLower = (uData.username || emailLower.split('@')[0]).toLowerCase();
        if (emailLower === clean || unameLower === clean || `${clean}@print.com` === emailLower) {
            return uid;
        }
    }
    return '';
};

window.getTicketMessagesArray = function(ticket) {
    let arr = Array.isArray(ticket.messages) ? [...ticket.messages] : [];
    if (arr.length === 0 && ticket.message) {
        const sec = ticket.timestamp?.seconds || Math.floor(Date.now() / 1000);
        arr.push({ sender: 'user', text: ticket.message, time: sec * 1000 });
    }
    return arr;
};

window.startLiveSupportListener = function() {
    if (window.supportUnsubscribe) window.supportUnsubscribe();
    window.supportUnsubscribe = onSnapshot(collection(db, "supportTickets"), (snap) => {
        window.allSupportTickets = [];
        snap.forEach(docSnap => { window.allSupportTickets.push({ id: docSnap.id, ...docSnap.data() }); });
        window.allSupportTickets.sort((a, b) => {
            const timeA = a.updatedAtMs || (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.updatedAtMs || (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
        });
        window.updateSupportNavBadge();
        window.renderSupportChatSidebar();
        if (window.selectedChatTicketId) {
            window.renderActiveChatConversation(window.selectedChatTicketId, false);
        }
    });
};

window.updateSupportNavBadge = function() {
    let unreadCount = 0;
    window.allSupportTickets.forEach(t => {
        if (t.unreadByAdmin === true || (t.unreadByAdmin === undefined && (t.status || 'Open') === 'Open')) unreadCount++;
    });
    const badge = document.getElementById('navSupportBadge');
    if (badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
    }
};

window.renderSupportChatSidebar = function() {
    const listEl = document.getElementById('supportChatThreadsList');
    if (!listEl) return;
    const searchVal = (document.getElementById('supportSearchInput')?.value || '').trim().toLowerCase();
    const filtered = window.allSupportTickets.filter(t => {
        if (!searchVal) return true;
        return (t.userIdentifier || '').toLowerCase().includes(searchVal) || (t.userPhone || '').toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="p-8 text-center text-slate-400 font-bold text-xs"><i class="fa-regular fa-comments text-3xl mb-2 text-slate-300"></i><br>अभी कोई यूज़र चैट या टिकट नहीं है।</div>`;
        return;
    }
    listEl.innerHTML = '';
    filtered.forEach(t => {
        const msgs = window.getTicketMessagesArray(t);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : { text: t.message || 'No message', sender: 'user' };
        const isSelected = window.selectedChatTicketId === t.id;
        const isUnread = t.unreadByAdmin === true || (t.unreadByAdmin === undefined && (t.status || 'Open') === 'Open');
        const isForgot = t.type === 'FORGOT_PASSWORD';
        const timeMs = t.updatedAtMs || (t.timestamp?.seconds ? t.timestamp.seconds * 1000 : Date.now());
        const timeStr = new Date(timeMs).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
    window.selectedChatTicketId = ticketId;
    window.renderSupportChatSidebar();
    window.renderActiveChatConversation(ticketId, true);
    const ticket = window.allSupportTickets.find(t => t.id === ticketId);
    if (ticket && (ticket.unreadByAdmin === true || ticket.unreadByAdmin === undefined)) {
        try { await updateDoc(doc(db, "supportTickets", ticketId), { unreadByAdmin: false }); } catch (e) {}
    }
};

window.renderActiveChatConversation = function(ticketId, scrollToBottom = true) {
    const emptyState = document.getElementById('chatWindowEmptyState');
    const activeBox = document.getElementById('chatWindowActiveBox');
    const ticket = window.allSupportTickets.find(t => t.id === ticketId);
    if (!ticket) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (activeBox) activeBox.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (activeBox) activeBox.classList.remove('hidden');
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier);
    const matchedUser = matchedUid ? window.usersDataList[matchedUid] : null;

    document.getElementById('chatHeaderUserTitle').innerText = ticket.userIdentifier || 'Unknown User';
    document.getElementById('chatHeaderUserPhone').innerText = (ticket.userPhone || matchedUser?.userPhone) ? `📱 WhatsApp: ${ticket.userPhone || matchedUser?.userPhone}` : 'No phone number saved';

    const passBadge = document.getElementById('chatHeaderSavedPassBadge');
    if (matchedUser) {
        passBadge.innerHTML = `Pass: <strong class="text-royal-300 font-mono">${matchedUser.userPass || 'Not Synced'}</strong> • Cr: <strong class="text-emerald-400">${matchedUser.credits || 0}</strong>`;
    } else {
        passBadge.innerHTML = `<span class="text-amber-300">Guest Ticket</span>`;
    }

    const msgContainer = document.getElementById('chatMessagesScrollBox');
    const msgs = window.getTicketMessagesArray(ticket);
    msgContainer.innerHTML = '';
    msgs.forEach(m => {
        const isAdmin = m.sender === 'admin';
        const tStr = m.time ? new Date(m.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        const safeText = String(m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        if (isAdmin) {
            msgContainer.innerHTML += `<div class="flex flex-col items-end"><div class="max-w-[80%] bg-dark-900 text-white px-4 py-2.5 rounded-2xl rounded-br-none shadow-sm border border-royal-500/40"><span class="text-[9px] font-black text-royal-400 uppercase block mb-0.5"><i class="fa-solid fa-crown mr-1"></i>Admin Support</span><div class="text-xs font-semibold leading-relaxed">${safeText}</div></div><span class="text-[9px] font-bold text-slate-400 mt-0.5">${tStr}</span></div>`;
        } else {
            msgContainer.innerHTML += `<div class="flex flex-col items-start"><div class="max-w-[80%] bg-white text-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-none shadow-sm border border-slate-200"><span class="text-[9px] font-black text-indigo-600 uppercase block mb-0.5"><i class="fa-solid fa-user mr-1"></i>${ticket.userIdentifier || 'User'}</span><div class="text-xs font-bold leading-relaxed">${safeText}</div></div><span class="text-[9px] font-bold text-slate-400 mt-0.5">${tStr}</span></div>`;
        }
    });
    if (scrollToBottom) {
        setTimeout(() => { msgContainer.scrollTop = msgContainer.scrollHeight; }, 50);
    }
};

window.sendAdminChatReply = async function(event) {
    if (event) event.preventDefault();
    const ticketId = window.selectedChatTicketId;
    if (!ticketId) return alert('कृपया पहले बाईं तरफ से किसी यूज़र की चैट पर क्लिक करें!');
    const inp = document.getElementById('adminChatReplyInput');
    const replyText = inp.value.trim();
    if (!replyText) return;
    const btn = document.getElementById('btnSendAdminChatReply');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const ticket = window.allSupportTickets.find(t => t.id === ticketId);
        const existingMsgs = window.getTicketMessagesArray(ticket);
        const newMsgObj = { sender: 'admin', text: replyText, time: Date.now() };
        existingMsgs.push(newMsgObj);
        await updateDoc(doc(db, "supportTickets", ticketId), {
            messages: existingMsgs,
            lastAdminReply: replyText,
            status: 'Replied',
            unreadByAdmin: false,
            unreadByUser: true,
            updatedAtMs: Date.now()
        });

        const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier);
        if (matchedUid && matchedUid !== ticketId) {
            try {
                const userChatRef = doc(db, "supportTickets", matchedUid);
                const userChatSnap = await getDoc(userChatRef);
                let uMsgs = userChatSnap.exists() && Array.isArray(userChatSnap.data().messages) ? [...userChatSnap.data().messages] : [];
                uMsgs.push(newMsgObj);
                await setDoc(userChatRef, {
                    userId: matchedUid,
                    userIdentifier: window.usersDataList[matchedUid]?.email || ticket.userIdentifier,
                    messages: uMsgs,
                    lastAdminReply: replyText,
                    status: 'Replied',
                    unreadByAdmin: false,
                    unreadByUser: true,
                    updatedAtMs: Date.now()
                }, { merge: true });
            } catch (e) {}
        }
        inp.value = '';
        window.renderActiveChatConversation(ticketId, true);
    } catch (err) {
        alert('रिप्लाई भेजने में समस्या आई: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

window.insertQuickChatReply = function(type) {
    const ticket = window.allSupportTickets.find(t => t.id === window.selectedChatTicketId);
    if (!ticket) return alert('कृपया पहले किसी यूज़र की चैट चुनें!');
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier);
    const u = matchedUid ? window.usersDataList[matchedUid] : null;
    const inp = document.getElementById('adminChatReplyInput');
    const shortId = u ? u.email : (ticket.userIdentifier || 'User');
    const pass = u ? (u.userPass || '[PASS]') : '[PASS]';
    const cr = u ? (u.credits || 0) : 0;

    if (type === 'id_pass') {
        inp.value = `नमस्ते, आपकी लॉगिन डिटेल्स नीचे दी गई हैं:\nUser ID: ${shortId}\nPassword: ${pass}\nCredits: ${cr} Cr`;
    } else if (type === 'payment_ok') {
        inp.value = `नमस्ते ${shortId}, आपका पेमेंट वेरीफाई हो गया है और क्रेडिट्स आपके अकाउंट में जोड़ दिए गए हैं।`;
    } else if (type === 'fixed') {
        inp.value = `नमस्ते ${shortId}, आपकी समस्या का समाधान कर दिया गया है। कृपया अब पोर्टल चेक करें।`;
    }
    inp.focus();
};

window.resetPassAndSendInChat = async function() {
    const ticket = window.allSupportTickets.find(t => t.id === window.selectedChatTicketId);
    if (!ticket) return alert('कृपया पहले किसी यूज़र की चैट चुनें!');
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier);
    if (!matchedUid || !window.usersDataList[matchedUid]) {
        return alert(`इस यूज़र (${ticket.userIdentifier}) का अकाउंट Users लिस्ट में नहीं मिला।`);
    }
    const newPass = document.getElementById('chatQuickNewPassInput').value.trim();
    if (!newPass || newPass.length < 6) return alert('नया पासवर्ड कम से कम 6 अक्षरों का लिखें!');
    const btn = document.getElementById('btnChatQuickResetPass');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const uData = window.usersDataList[matchedUid];

    try {
        if (uData.userPass) {
            try {
                const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: uData.email, password: uData.userPass, returnSecureToken: true })
                });
                const signInData = await signInRes.json();
                if (signInData.idToken) {
                    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: signInData.idToken, password: newPass, returnSecureToken: true })
                    });
                }
            } catch (e) {}
        }
        const updateUserPayload = { userPass: newPass, adminResetPass: newPass, passUpdatedAt: new Date() };
        if (ticket.userPhone && !uData.userPhone) {
            updateUserPayload.userPhone = ticket.userPhone;
            window.usersDataList[matchedUid].userPhone = ticket.userPhone;
        }
        await updateDoc(doc(db, "users", matchedUid), updateUserPayload);
        window.usersDataList[matchedUid].userPass = newPass;

        const autoReplyMsg = `🔑 आपका नया पासवर्ड सेट कर दिया गया है:\nUser ID: ${uData.email}\nNew Password: ${newPass}\n\nअब आप इस नए पासवर्ड से लॉगिन कर सकते हैं।`;
        const newMsgObj = { sender: 'admin', text: autoReplyMsg, time: Date.now() };
        const existingMsgs = window.getTicketMessagesArray(ticket);
        existingMsgs.push(newMsgObj);

        await updateDoc(doc(db, "supportTickets", ticket.id), {
            messages: existingMsgs,
            lastAdminReply: autoReplyMsg,
            status: 'Replied',
            unreadByAdmin: false,
            unreadByUser: true,
            updatedAtMs: Date.now()
        });

        if (matchedUid !== ticket.id) {
            try {
                const userChatRef = doc(db, "supportTickets", matchedUid);
                const userChatSnap = await getDoc(userChatRef);
                let uMsgs = userChatSnap.exists() && Array.isArray(userChatSnap.data().messages) ? [...userChatSnap.data().messages] : [];
                uMsgs.push(newMsgObj);
                await setDoc(userChatRef, {
                    userId: matchedUid,
                    userIdentifier: uData.email,
                    messages: uMsgs,
                    lastAdminReply: autoReplyMsg,
                    status: 'Replied',
                    unreadByAdmin: false,
                    unreadByUser: true,
                    updatedAtMs: Date.now()
                }, { merge: true });
            } catch (e) {}
        }
        document.getElementById('chatQuickNewPassInput').value = '';
        window.renderActiveChatConversation(ticket.id, true);
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

window.alsoOpenChatUserWhatsApp = function() {
    const ticket = window.allSupportTickets.find(t => t.id === window.selectedChatTicketId);
    if (!ticket) return;
    const matchedUid = ticket.userId || window.findUserUidByIdentifier(ticket.userIdentifier);
    const matchedUser = matchedUid ? window.usersDataList[matchedUid] : null;
    const cleanPhone = window.formatCleanPhone(ticket.userPhone || matchedUser?.userPhone || '');
    const msgs = window.getTicketMessagesArray(ticket);
    const lastAdmin = [...msgs].reverse().find(m => m.sender === 'admin');
    const textToSend = document.getElementById('adminChatReplyInput').value.trim() || lastAdmin?.text || `नमस्ते ${ticket.userIdentifier}, Ojas Portal सपोर्ट से अपडेट:`;
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}` : `https://wa.me/?text=${encodeURIComponent(textToSend)}`;
    window.open(url, '_blank');
};

window.deleteCurrentSupportChat = async function() {
    const ticketId = window.selectedChatTicketId;
    if (!ticketId) return;
    if (!confirm('क्या आप इस पूरी चैट को डिलीट करना चाहते हैं?')) return;
    try {
        await deleteDoc(doc(db, "supportTickets", ticketId));
        window.selectedChatTicketId = null;
        window.renderActiveChatConversation(null);
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.startNewChatWithSelectedUser = async function() {
    const uid = document.getElementById('newChatUserSelect').value;
    if (!uid || !window.usersDataList[uid]) return alert('कृपया ड्रॉपडाउन से यूज़र चुनें!');
    const u = window.usersDataList[uid];
    const existing = window.allSupportTickets.find(t => t.id === uid || t.userId === uid);
    if (existing) {
        window.selectSupportChatThread(existing.id);
        return;
    }
    try {
        const newDocRef = doc(db, "supportTickets", uid);
        await setDoc(newDocRef, {
            type: 'ADMIN_MESSAGE',
            userId: uid,
            userIdentifier: u.email,
            userPhone: u.userPhone || '',
            message: 'Support Chat Started',
            messages: [{ sender: 'admin', text: `नमस्ते ${u.email.split('@')[0]}, Ojas Portal एडमिन सपोर्ट में आपका स्वागत है।`, time: Date.now() }],
            status: 'Replied',
            unreadByAdmin: false,
            unreadByUser: true,
            timestamp: new Date(),
            updatedAtMs: Date.now()
        }, { merge: true });
        window.selectSupportChatThread(uid);
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.populateSupportUserDropdown = function() {
    const sel = document.getElementById('newChatUserSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- किसी यूज़र के साथ नई चैट खोलें --</option>';
    for (const [uid, data] of Object.entries(window.usersDataList)) {
        sel.innerHTML += `<option value="${uid}">${data.email}</option>`;
    }
};
