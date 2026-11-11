// ============================================================================
// FILE 2: js/portal-forms.js (UPDATED COMPLETE)
// (Forms, submitForm fix, FORM DRAFT PERSISTENCE, DOB DELHI DROPDOWN & GAZETTE FORM)
// ============================================================================ 

import "./config-templates.js";

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 250; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.2)); 
            };
        };
    });
}

// === HELPER FUNCTIONS FOR DOB DELHI (DROPDOWN + SINGLE ADDRESS SYNC) & GAZETTE ===
window.handleDobDelhiPobChange = function(selectEl) {
    const val = selectEl.value;
    const customWrapper = document.getElementById('dobDelhiPobCustomWrapper');
    const customInp = document.getElementById('inpMcdPobCustom');
    const finalPobInp = document.getElementById('inpMcdPob');

    if (val === 'OTHER') {
        if (customWrapper) customWrapper.style.display = 'block';
        if (customInp) {
            customInp.required = true;
            customInp.focus();
            if (finalPobInp) finalPobInp.value = customInp.value.trim().toUpperCase();
        }
    } else {
        if (customWrapper) customWrapper.style.display = 'none';
        if (customInp) customInp.required = false;
        if (finalPobInp) finalPobInp.value = val;
    }
};

window.syncDobDelhiCustomPob = function(inputEl) {
    const finalPobInp = document.getElementById('inpMcdPob');
    if (finalPobInp) {
        finalPobInp.value = inputEl.value.trim().toUpperCase();
    }
};

window.syncDobDelhiUnifiedAddress = function(inputEl) {
    const upperVal = String(inputEl.value || '').toUpperCase();
    const permEl = document.getElementById('inpMcdPermAddr');
    const addrEl = document.getElementById('inpMcdAddress');
    const birthAddrEl = document.getElementById('inpMcdBirthAddress');
    const permanentAddrEl = document.getElementById('inpMcdPermanentAddress');

    if (permEl) permEl.value = upperVal;
    if (addrEl) addrEl.value = upperVal;
    if (birthAddrEl) birthAddrEl.value = upperVal;
    if (permanentAddrEl) permanentAddrEl.value = upperVal;
};

window.toggleGazetteChangeMode = function(val) {
    const minorSec = document.getElementById('gazetteMinorFields');
    const gInp = document.getElementById('inpGazetteGuardian');
    const aInp = document.getElementById('inpGazetteChildAge');
    const appTypeHidden = document.getElementById('inpGazetteApplicantTypeHidden');
    const childRelHidden = document.getElementById('inpGazetteChildRelHidden');
    const lblOld = document.getElementById('lblGazetteOldName');
    const lblNew = document.getElementById('lblGazetteNewName');
    const lblFather = document.getElementById('lblGazetteFatherName');

    if (val === 'MINOR_SON' || val === 'MINOR_DAUGHTER' || val === 'MINOR') {
        if (minorSec) minorSec.style.display = 'grid';
        if (gInp) gInp.required = true;
        if (aInp) aInp.required = true;
        if (appTypeHidden) appTypeHidden.value = 'MINOR';
        if (childRelHidden) childRelHidden.value = (val === 'MINOR_DAUGHTER') ? 'daughter' : 'son';
        if (lblOld) lblOld.innerHTML = 'Child Old Name (बच्चे का पुराना नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblNew) lblNew.innerHTML = 'Child New Name (बच्चे का नया सही नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblFather) lblFather.innerHTML = 'Guardian\'s Father Name (अभिभावक के पिता का नाम - BOLD) <span class="text-red-500">*</span>';
    } else {
        if (minorSec) minorSec.style.display = 'none';
        if (gInp) gInp.required = false;
        if (aInp) aInp.required = false;
        if (appTypeHidden) appTypeHidden.value = 'ADULT';
        if (lblOld) lblOld.innerHTML = 'Old Name (पुराना नाम / गलत नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblNew) lblNew.innerHTML = 'New Name (नया सही नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblFather) lblFather.innerHTML = 'Father / Husband Name (पिता / पति का नाम - BOLD) <span class="text-red-500">*</span>';
    }
};

// === FORM DRAFT SAVING LOGIC ===
window.saveFormDataToSession = function(serviceName) {
    const form = document.querySelector('#formContainer form');
    if (!form) return;
    const fd = new FormData(form);
    const dataObj = {};
    fd.forEach((val, key) => {
        if (key !== 'PHOTO' && typeof val === 'string') {
            dataObj[key] = val;
        }
    });
    sessionStorage.setItem('ojas_draft_' + serviceName, JSON.stringify(dataObj));
};

window.restoreFormDataFromSession = function(serviceName) {
    const savedStr = sessionStorage.getItem('ojas_draft_' + serviceName);
    if (!savedStr) return;
    try {
        const dataObj = JSON.parse(savedStr);
        const form = document.querySelector('#formContainer form');
        if (!form) return;
        Object.keys(dataObj).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input && input.type !== 'file') {
                if (input.type === 'checkbox' || input.type === 'radio') {
                     if (input.value === dataObj[key]) input.checked = true;
                } else {
                     input.value = dataObj[key];
                }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    } catch (e) {}
};

// === SERVICES SUBMISSION (Caste, Domicile & e-Voter ID Local Instant HTML; Minor on Google Drive & Free) ===
window.submitForm = async function(event, serviceType) {
    event.preventDefault();
    const { db, doc, setDoc, updateDoc, collection, addDoc } = window.fb;

    if (!window.currentUserData) return alert('Please login first!');
    if (!window.isAllowedPortalEmail(window.currentUserData.email)) {
        return alert('अमान्य यूज़र आईडी! केवल @print.com वाली आईडी से ही डॉक्यूमेंट जनरेट हो सकता है।');
    }

    if (serviceType === 'Domicile' && !window.canCurrentUserSeeService('domicile')) return alert('यह सर्विस वर्तमान में बंद है।');
    if (serviceType === 'Caste' && !window.canCurrentUserSeeService('caste')) return alert('यह सर्विस वर्तमान में बंद है।');
    if (serviceType === 'e-Voter ID' && !window.canCurrentUserSeeService('evoter')) return alert('यह सर्विस वर्तमान में बंद है।');
    if ((serviceType === 'DOB Delhi' || serviceType === 'DOB Minor') && !window.canCurrentUserSeeService('dob_delhi')) return alert('यह सर्विस वर्तमान में बंद है।');
    if ((serviceType === 'Passport' || serviceType === 'Passport Services') && !window.canCurrentUserSeeService('passport')) return alert('यह सर्विस वर्तमान में बंद है।');
    if ((serviceType === 'Minor' || serviceType === 'DOB') && !window.canCurrentUserSeeService('minor')) return alert('यह सर्विस वर्तमान में बंद है।');
    if ((serviceType === 'Gazette Notification' || serviceType === 'Gazette') && !window.canCurrentUserSeeService('gazette')) return alert('यह सर्विस वर्तमान में बंद है।');
    if (serviceType === 'DOB Print' && !window.canCurrentUserSeeService('dob_print')) return alert('यह सर्विस वर्तमान में बंद है।');

    const isEditMode = !!(window.currentEditingAnnexure && window.currentEditingAnnexure.docId && window.currentUserData && window.currentUserData.isAdmin);
    const isSuperAdminUser = !!(window.isSuperAdminEmail && window.isSuperAdminEmail(window.currentUserData.email));
    const isFreeForThisService = (serviceType === 'DOB Print' || serviceType === 'DOB Original PDF') ? (isSuperAdminUser || isEditMode) : !!(window.currentUserData.isAdmin || isEditMode);
    const docCost = isFreeForThisService ? 0 : (typeof window.getServiceCreditCost === 'function' ? window.getServiceCreditCost(serviceType) : 10);

    if (!isFreeForThisService && window.currentUserData.credits < docCost) {
        return alert(`Insufficient credits! इस ${serviceType} डॉक्यूमेंट को जनरेट करने के लिए ${docCost} Credits (₹${docCost}) आवश्यक हैं। कृपया वॉलेट रिचार्ज करें।`);
    }

    const formElement = event.target;
    const submitBtn = formElement.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing...';
    submitBtn.disabled = true;

    try {
        await window.preloadAllHtmlTemplates();
        const formData = new FormData(formElement);
        formData.append('USER_ID', window.currentUserData.email);
        formData.append('SERVICE_TYPE', serviceType);

        const photoInput = formElement.querySelector('input[type="file"]');
        let base64Photo = "";
        if (photoInput && photoInput.files[0]) {
            base64Photo = await compressImage(photoInput.files[0]);
            formData.set('PHOTO', base64Photo);
        } else if (isEditMode && window.currentEditingAnnexure?.formData?.PHOTO) {
            base64Photo = window.currentEditingAnnexure.formData.PHOTO;
            formData.set('PHOTO', base64Photo);
        }

        const dataObj = {};
        formData.forEach((v, k) => { dataObj[k] = v; });

        if (dataObj.CAST === 'OTHER' && dataObj.CAST_CUSTOM) dataObj.CAST = dataObj.CAST_CUSTOM.trim();
        if (dataObj.VLE === 'OTHER' && dataObj.VLE_CUSTOM) dataObj.VLE = dataObj.VLE_CUSTOM.trim();
        if (dataObj.PB === 'OTHER' && dataObj.PB_CUSTOM) dataObj.PB = dataObj.PB_CUSTOM.trim();

        // Ensure DOB Delhi POB & Single Address auto-sync before processing
        if (serviceType === 'DOB Delhi' || serviceType === 'DOB Minor') {
            if (dataObj.POB_SELECT === 'OTHER' && dataObj.POB_CUSTOM) {
                dataObj.POB = dataObj.POB_CUSTOM.trim().toUpperCase();
            } else if (dataObj.POB_SELECT && dataObj.POB_SELECT !== 'OTHER') {
                dataObj.POB = dataObj.POB_SELECT.trim().toUpperCase();
            }
            dataObj.PLACE_OF_BIRTH = dataObj.POB;

            const singleAddr = (dataObj.PRES_ADDR || dataObj.PERM_ADDR || dataObj.ADDRESS || '').trim().toUpperCase();
            dataObj.PRES_ADDR = singleAddr;
            dataObj.PERM_ADDR = singleAddr;
            dataObj.ADDRESS = singleAddr;
            dataObj.BIRTH_ADDRESS = singleAddr;
            dataObj.PERMANENT_ADDRESS = singleAddr;
        }

        // === SECURE SERVER-SIDE BRN API EXECUTION FOR DOB ORIGINAL PDF (₹140 / 140 CREDITS) ===
        if (serviceType === 'DOB Print' && dataObj.DOB_PRINT_MODE !== 'INSTANT_CRS') {
            const currentUser = window.fb.auth.currentUser;
            if (!currentUser) throw new Error('Session expired. Please log in again.');
            const idToken = await currentUser.getIdToken(true);

            const apiResponse = await fetch('/api/dob-print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    action: 'apply',
                    name: dataObj.NAME,
                    number: dataObj.BRN_NO
                })
            });

            const resJson = await apiResponse.json();
            if (!apiResponse.ok || !resJson.status) {
                throw new Error(resJson.message || 'Server error while generating DOB Original PDF.');
            }

            if (resJson.remainingCredits !== undefined) {
                window.currentUserData.credits = resJson.remainingCredits;
                const crEl = document.getElementById('displayCredits');
                if (crEl) crEl.innerText = resJson.remainingCredits;
            }

            sessionStorage.removeItem('ojas_draft_dob_print');
            const rawSt = String(resJson.data?.status || 'pending').toLowerCase();
            const normSt = (resJson.data?.has_pdf || rawSt === 'successful' || rawSt === 'approved' || rawSt === 'completed') ? 'SUCCESSFUL' : 'PENDING';
            alert(`✅ ${resJson.message}\n\n• Application Ref: ${resJson.data?.application_ref || 'N/A'}\n• Name: ${resJson.data?.name}\n• BRN No: ${resJson.data?.number}\n• Status: ${normSt}\n\nआप Document History में जाकर स्टेटस चेक और ओरिजिनल PDF डाउनलोड कर सकते हैं।`);
            formElement.reset();
            window.switchService('history');
            return;
        }

        // === INSTANT LOCAL GENERATION FOR CASTE, DOMICILE, e-VOTER ID, DOB DELHI, GAZETTE & DOB PRINT ===
        if (serviceType === 'Caste' || serviceType === 'Domicile' || serviceType === 'e-Voter ID' || serviceType === 'DOB Delhi' || serviceType === 'DOB Minor' || serviceType === 'Gazette Notification' || serviceType === 'Gazette' || serviceType === 'DOB Print') {
            const preGenDocRef = isEditMode
                ? doc(db, "history", window.currentEditingAnnexure.docId)
                : doc(collection(db, "history"));
            const targetDocId = preGenDocRef.id;

            let processedData = {};
            let fileIdKey = '';
            if (serviceType === 'e-Voter ID') {
                processedData = window.processEvoterData(dataObj);
                fileIdKey = 'LOCAL_HTML_EVOTER';
            } else if (serviceType === 'DOB Delhi' || serviceType === 'DOB Minor') {
                processedData = window.processDobDelhiData(dataObj, targetDocId);
                fileIdKey = 'LOCAL_HTML_DOB_DELHI';
                serviceType = 'DOB Delhi';
            } else if (serviceType === 'Gazette Notification' || serviceType === 'Gazette') {
                processedData = window.processGazetteData(dataObj);
                fileIdKey = 'LOCAL_HTML_GAZETTE';
                serviceType = 'Gazette Notification';
            } else if (serviceType === 'DOB Print') {
                processedData = window.processDobPrintData(dataObj);
                fileIdKey = 'LOCAL_HTML_DOB_PRINT';
                serviceType = 'DOB Print';
            } else {
                if (isEditMode && window.currentEditingAnnexure?.formData) {
                    dataObj.RN = window.currentEditingAnnexure.formData.RN;
                    dataObj.AM = window.currentEditingAnnexure.formData.AM;
                }
                processedData = window.processCasteOrDomicileData(dataObj, serviceType);
                fileIdKey = serviceType === 'Caste' ? 'LOCAL_HTML_CASTE' : 'LOCAL_HTML_DOMICILE';
            }
            processedData.DOC_ID = targetDocId;
            processedData.CREDITS_DEDUCTED = docCost;

            const docName = processedData.NAME || serviceType;
            const pdfFileName = `${docName} - ${serviceType}.pdf`;

            if (isEditMode) {
                await updateDoc(preGenDocRef, {
                    fileName: pdfFileName,
                    formData: processedData,
                    updatedAt: new Date()
                });
                window.currentEditingAnnexure = null;
                const banner = document.getElementById('annexureEditBanner');
                if (banner) banner.remove();
                alert(`सफलतापूर्वक अपडेट हो गया! "${pdfFileName}" सेव कर दिया गया है।`);
                formElement.reset();
                window.switchService('history');
                return;
            }

            const isAutoStampedCert = (serviceType === 'Caste' || serviceType === 'Domicile');
            await setDoc(preGenDocRef, {
                userId: window.currentUserData.uid,
                fileName: pdfFileName,
                fileId: fileIdKey,
                serviceType: serviceType,
                formData: processedData,
                withStamp: isAutoStampedCert,
                stampFile: isAutoStampedCert ? 'm.png' : '',
                timestamp: new Date()
            });

            if (docCost > 0) {
                const userDocRef = doc(db, "users", window.currentUserData.uid);
                const newCredits = window.currentUserData.credits - docCost;
                await updateDoc(userDocRef, { credits: newCredits });
                window.currentUserData.credits = newCredits;
                document.getElementById('displayCredits').innerText = newCredits;
            }

            sessionStorage.removeItem('ojas_draft_' + serviceType.toLowerCase().replace(/[^a-z0-9]/g, ''));
            alert(`Success! आपका ${serviceType} डॉक्यूमेंट तुरंत जनरेट हो गया है। अब आप History से इसे Print व Download कर सकते हैं।`);
            formElement.reset();
            window.switchService('history');
            return;
        }

        // === GOOGLE DRIVE SUBMISSION FOR MINOR (AND OTHER DRIVE SERVICES) ===
        let targetUrl = "";
        if (serviceType === 'DOB Delhi' || serviceType === 'DOB Minor') targetUrl = window.API_URLS["DOB_DELHI"];
        else if (serviceType === 'Passport' || serviceType === 'Passport Services') targetUrl = window.API_URLS["passport"] || window.API_URLS["certificate"];
        else if (serviceType === 'Minor') targetUrl = window.API_URLS["minor"];

        if (serviceType === 'Minor') {
            if (dataObj.MA && dataObj.MA.trim()) {
                const cleanMA = dataObj.MA.replace(/\D/g, '').slice(-4);
                dataObj.MA = cleanMA.length === 4 ? `XXXX-XXXX-${cleanMA}` : '';
            } else { dataObj.MA = ''; }

            if (dataObj.FA && dataObj.FA.trim()) {
                const cleanFA = dataObj.FA.replace(/\D/g, '').slice(-4);
                dataObj.FA = cleanFA.length === 4 ? `XXXX-XXXX-${cleanFA}` : '';
            } else { dataObj.FA = ''; }

            const isCustomBrn = document.getElementById('chkCustomMinorBrn')?.checked;
            if (isCustomBrn) {
                const rawBr = (dataObj.BR || dataObj.BRN || '').trim().toUpperCase();
                if (rawBr) { dataObj.BR = rawBr; dataObj.BRN = rawBr; dataObj.BRN_NO = rawBr; }
                const toDDMMYYYY = (dStr) => {
                    if (!dStr) return '';
                    if (dStr.includes('-')) {
                        const parts = dStr.split('-');
                        if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    return dStr;
                };
                const rawDr = (dataObj.DR || dataObj.REG_DATE || '').trim();
                const formattedDr = toDDMMYYYY(rawDr);
                if (formattedDr) { dataObj.DR = formattedDr; dataObj.REG_DATE = formattedDr; dataObj.REGISTRATION_DATE = formattedDr; }
                const rawDi = (dataObj.DI || rawDr || '').trim();
                const formattedDi = toDDMMYYYY(rawDi);
                if (formattedDi) { dataObj.DI = formattedDi; dataObj.ISSUE_DATE = formattedDi; }
            } else {
                delete dataObj.BR; delete dataObj.DR; delete dataObj.DI; delete dataObj.BRN; delete dataObj.REG_DATE; delete dataObj.BRN_NO; delete dataObj.REGISTRATION_DATE;
            }
            delete dataObj.CUSTOM_BRN_ENABLED;
        }

        let result = null;
        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(dataObj)
            });
            result = await response.json();
        } catch (networkError) {
            alert('सर्वर डिले या टाइमआउट के कारण डॉक्यूमेंट जनरेट नहीं हो पाया। कृपया दोबारा Generate पर क्लिक करें।');
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
        }

        if (result && result.success && result.fileId) {
            if (docCost > 0) {
                const userDocRef = doc(db, "users", window.currentUserData.uid);
                const newCredits = window.currentUserData.credits - docCost;
                await updateDoc(userDocRef, { credits: newCredits });
                window.currentUserData.credits = newCredits;
                document.getElementById('displayCredits').innerText = newCredits;
            }

            const docName = dataObj.NAME || 'Minor';
            const pdfFileName = `${docName} - ${serviceType}.pdf`;
            if (isEditMode && window.currentEditingAnnexure?.docId) {
                await updateDoc(doc(db, "history", window.currentEditingAnnexure.docId), {
                    fileName: pdfFileName,
                    fileId: result.fileId || 'N/A',
                    formData: dataObj,
                    updatedAt: new Date()
                });
                window.currentEditingAnnexure = null;
                const banner = document.getElementById('annexureEditBanner');
                if (banner) banner.remove();
                alert(`सफलतापूर्वक अपडेट हो गया! "${pdfFileName}" सेव कर दिया गया है।`);
                window.switchService('history');
                formElement.reset();
                return;
            }
            dataObj.CREDITS_DEDUCTED = docCost;
            await addDoc(collection(db, "history"), {
                userId: window.currentUserData.uid,
                fileName: pdfFileName,
                fileId: result.fileId || 'N/A',
                serviceType: serviceType,
                formData: dataObj,
                creditsDeducted: docCost,
                timestamp: new Date()
            });

            sessionStorage.removeItem('ojas_draft_' + (serviceType.toLowerCase()));
            alert('Success! आपका डॉक्यूमेंट सफलतापूर्वक जनरेट हो गया है। कृपया History चेक करें।');
            window.switchService('history');
            formElement.reset();
        } else {
            alert('Google Apps Script Error:\n\n' + (result && result.error ? result.error : "अज्ञात बैकएंड एरर"));
        }
    } catch (error) {
        alert('Form processing error: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
};

// === LOCAL ANNEXURE FORM SUBMISSION ===
window.currentEditingAnnexure = null;

window.ANNEXURE_SERVICE_TO_TAB = {
    'Domicile': 'domicile',
    'Caste': 'caste',
    'e-Voter ID': 'evoter',
    'DOB Delhi': 'dob_delhi',
    'DOB Minor': 'dob_delhi',
    'Minor': 'minor',
    'DOB': 'minor',
    'Passport': 'passport',
    'Passport Services': 'passport',
    'Gazette Notification': 'gazette',
    'Gazette': 'gazette',
    'DOB Print': 'dob_print',
    'Annexure 1': 'annexure1',
    'Annexure 1A': 'annexure1a',
    'Annexure 3': 'annexure3',
    'Annexure 3A': 'annexure3a',
    'Annexure B': 'annexureb',
    'Annexure C': 'annexurec',
    'Annexure D': 'annexured',
    'Annexure E': 'annexuree',
    'Annexure F': 'annexuref'
};

window.populateAnnexureFormForEdit = function(fData) {
    const form = document.querySelector('#formContainer form');
    if (!form) return;

    let banner = document.getElementById('annexureEditBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'annexureEditBanner';
        banner.className = 'mb-4 p-3.5 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border-2 border-amber-400 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-sm';
        banner.innerHTML = `
            <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-black shadow-sm"><i class="fa-solid fa-pen-to-square"></i></span>
                <div>
                    <h4 class="text-xs md:text-sm font-black text-amber-950">Editing Document: <span class="underline">${window.currentEditingAnnexure?.fileName || 'Annexure'}</span></h4>
                    <p class="text-[11px] text-amber-800 font-bold">फॉर्म में बदलाव करके नीचे 'Update Document' दबाएं (कोई अतिरिक्त क्रेडिट नहीं कटेगा)</p>
                </div>
            </div>
            <button type="button" onclick="window.cancelAnnexureEdit()" class="bg-white hover:bg-red-50 text-red-600 border border-red-300 font-black px-3.5 py-1.5 rounded-xl text-xs transition shadow-sm flex items-center gap-1">
                <i class="fa-solid fa-xmark"></i> Cancel Edit
            </button>
        `;
        form.parentNode.insertBefore(banner, form);
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1.5"></i> Update Document (बदलाव सेव करें)`;
        submitBtn.className = "w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-dark-950 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10 flex items-center justify-center gap-2";
    }

    const fileInp = form.querySelector('input[type="file"]');
    if (fileInp) fileInp.required = false;
    if (fData.DISTRICT) {
        const distEl = form.querySelector('[name="DISTRICT"]');
        if (distEl) {
            distEl.value = fData.DISTRICT;
            if (typeof window.updateTehsilsAndThanas === 'function') window.updateTehsilsAndThanas();
        }
    }
    for (const [key, val] of Object.entries(fData)) {
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) continue;
        if (input.type === 'date') {
            let isoDate = val;
            if (val.includes('/')) {
                const parts = val.split('/');
                if (parts.length === 3 && parts[2].length === 4) {
                    isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            } else if (val.includes('-')) {
                const parts = val.split('-');
                if (parts.length === 3 && parts[2].length === 4) {
                    isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            input.value = isoDate;
        } else if (input.tagName === 'SELECT') {
            input.value = val;
        } else {
            input.value = val;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
};

window.cancelAnnexureEdit = function() {
    window.currentEditingAnnexure = null;
    const banner = document.getElementById('annexureEditBanner');
    if (banner) banner.remove();
    window.switchService('history');
};

window.submitLocalAnnexureForm = async function(event, serviceType, fileIdKey) {
    event.preventDefault();
    const { db, doc, setDoc, updateDoc, collection, addDoc } = window.fb;

    if (!window.currentUserData) return alert('Please login first!');
    if (!window.isAllowedPortalEmail(window.currentUserData.email)) {
        return alert('अमान्य यूज़र आईडी! केवल @print.com वाली आईडी से ही डॉक्यूमेंट जनरेट हो सकता है।');
    }
    if (!window.canCurrentUserSeeService('annexures')) return alert('यह सर्विस वर्तमान में बंद है।');

    const isEditMode = !!(window.currentEditingAnnexure && window.currentEditingAnnexure.docId && window.currentUserData && window.currentUserData.isAdmin);

    const docCost = 10;
    if (!isEditMode && !window.currentUserData.hasFreeAccess && window.currentUserData.credits < docCost) {
        return alert(`Insufficient credits! You need ${docCost} credits to generate ${serviceType}. Please add credits.`);
    }

    const formEl = event.target;
    const btn = formEl.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = isEditMode 
        ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Updating Document...' 
        : '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating...';
    btn.disabled = true;

    const fd = new FormData(formEl);
    const formDataObj = {};
    fd.forEach((val, key) => {
        const strVal = String(val).trim();
        if (key === 'newDob' || key === 'oldDob' || key === 'date' || key === 'invalidDocDate') {
            formDataObj[key] = window.formatDateIN(strVal);
        } else if (key === 'rel' || key === 'title' || key === 'day') {
            formDataObj[key] = strVal;
        } else {
            formDataObj[key] = strVal.toUpperCase();
        }
    });

    if (formDataObj.oldDoc === 'OTHER' && formDataObj.oldDocCustom) {
        formDataObj.oldDoc = formDataObj.oldDocCustom;
    }
    if (formDataObj.newDoc === 'OTHER' && formDataObj.newDocCustom) {
        formDataObj.newDoc = formDataObj.newDocCustom;
    }
    if (formDataObj.invalidDocName === 'OTHER' && formDataObj.invalidDocNameCustom) {
        formDataObj.invalidDocName = formDataObj.invalidDocNameCustom;
    }

    const mainPersonName = formDataObj.childName || formDataObj.applicantName || formDataObj.parentName || 'CUSTOMER';
    const cleanName = mainPersonName.replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFileName = `${cleanName} - ${serviceType}.pdf`;

    try {
        if (isEditMode) {
            const editDocId = window.currentEditingAnnexure.docId;
            await updateDoc(doc(db, "history", editDocId), {
                fileName: pdfFileName,
                formData: formDataObj,
                updatedAt: new Date()
            });

            const inMemoryItem = window.historyData && window.historyData.find(d => d.id === editDocId);
            if (inMemoryItem) {
                inMemoryItem.fileName = pdfFileName;
                inMemoryItem.formData = formDataObj;
            }

            window.currentEditingAnnexure = null;
            const banner = document.getElementById('annexureEditBanner');
            if (banner) banner.remove();

            alert(`सफलतापूर्वक अपडेट हो गया!\n\n"${pdfFileName}" के बदलाव सेव कर दिए गए हैं।`);
            formEl.reset();
            window.switchService('history');
            return;
        }

        const effectiveAnnexureCost = window.currentUserData.hasFreeAccess ? 0 : docCost;
        formDataObj.CREDITS_DEDUCTED = effectiveAnnexureCost;
        await addDoc(collection(db, "history"), {
            userId: window.currentUserData.uid,
            fileName: pdfFileName,
            fileId: fileIdKey,
            serviceType: serviceType,
            formData: formDataObj,
            creditsDeducted: effectiveAnnexureCost,
            timestamp: new Date()
        });

        if (!window.currentUserData.hasFreeAccess) {
            const userDocRef = doc(db, "users", window.currentUserData.uid);
            const newCredits = window.currentUserData.credits - docCost;
            await updateDoc(userDocRef, { credits: newCredits });
            window.currentUserData.credits = newCredits;
            document.getElementById('displayCredits').innerText = newCredits;
        }

        const mapping = {
            'Annexure 1': 'annexure1', 'Annexure 1A': 'annexure1a', 'Annexure 3': 'annexure3',
            'Annexure 3A': 'annexure3a', 'Annexure B': 'annexureb', 'Annexure C': 'annexurec',
            'Annexure D': 'annexured', 'Annexure E': 'annexuree', 'Annexure F': 'annexuref'
        };
        sessionStorage.removeItem('ojas_draft_' + (mapping[serviceType] || serviceType));

        alert(`आपका डॉक्यूमेंट (${serviceType}) जनरेट हो चुका है! अब आप यहाँ History से इसे Preview, Print और Download कर सकते हैं।`);
        formEl.reset();
        window.switchService('history');
    } catch (err) {
        alert('Error saving document: ' + err.message);
    } finally {
        if (btn) {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    }
};

// === BACKGROUND WATERMARK HELPER ===
const getWatermarkHtml = (srv) => {
    const wMap = {
        'domicile': { emoji: '🏠', text: 'DOMICILE' },
        'caste': { emoji: '👥', text: 'CASTE CERT' },
        'evoter': { emoji: '🗳️', text: 'e-VOTER ID' },
        'dob_minor': { emoji: '🎂', text: 'DOB DELHI' },
        'dob_delhi': { emoji: '🎂', text: 'DOB DELHI' },
        'passport': { emoji: '🛂', text: 'PASSPORT' },
        'gazette': { emoji: '📜', text: 'GAZETTE INDIA' },
        'dob_print': { emoji: '🎂', text: 'DOB PRINT' },
        'minor': { emoji: '👶', text: 'MINOR CERT' },
        'annexure1': { emoji: '📜', text: 'ANNEXURE I' },
        'annexure1a': { emoji: '👶', text: 'ANNEXURE IA' },
        'annexure3': { emoji: '⚡', text: 'ANNEXURE III' },
        'annexure3a': { emoji: '👦', text: 'ANNEXURE IIIA' },
        'annexureb': { emoji: '🧑', text: 'ANNEXURE B' },
        'annexurec': { emoji: '👧', text: 'ANNEXURE C' },
        'annexured': { emoji: '💍', text: 'ANNEXURE D' },
        'annexuree': { emoji: '✂', text: 'ANNEXURE E' },
        'annexuref': { emoji: '🖍️', text: 'ANNEXURE F' },
    };
    const wm = wMap[srv] || { emoji: '📄', text: srv.toUpperCase() };
    
    return `
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-[60] overflow-hidden select-none">
            <div class="absolute text-[160px] md:text-[220px] transform -rotate-12 grayscale-[10%] opacity-[0.06]">${wm.emoji}</div>
            <div class="absolute inset-0 flex flex-col justify-around items-center py-6 transform -rotate-12 w-[200%] left-[-50%] opacity-[0.03]">
                <div class="flex justify-around w-full px-4"><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span></div>
                <div class="flex justify-around w-full px-4"><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span></div>
                <div class="flex justify-around w-full px-4"><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span><span class="text-[30px] md:text-[45px] font-black uppercase tracking-widest whitespace-nowrap">${wm.text}</span></div>
            </div>
        </div>
    `;
};

// === RENDER DOCUMENT FORMS INTO CONTAINER ===
window.toggleMinorCustomBrn = function(isChecked) {
    const sec = document.getElementById('minorCustomBrnSection');
    const brInp = document.getElementById('inpMinorBr');
    const drInp = document.getElementById('inpMinorDr');
    const diInp = document.getElementById('inpMinorDi');
    if (!sec) return;
    if (isChecked) {
        sec.style.display = 'grid';
        if (brInp) brInp.focus();
    } else {
        sec.style.display = 'none';
        if (brInp) brInp.value = '';
        if (drInp) drInp.value = '';
        if (diInp) diInp.value = '';
    }
};

window.renderServiceFormHtml = function(serviceName, container, submitBtnText, statusTagHtml) {
    const todayISO = new Date().toISOString().split('T')[0];

    const vleSelectHtml = `
        <select name="VLE" onchange="window.toggleCustomInput(this, 'customVleInput')" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10">
            ${window.VLE_NAMES_LIST.map(v => `<option value="${v}">${v}</option>`).join('')}
            <option value="OTHER">OTHER (अन्य नाम दर्ज करें)</option>
        </select>
        <input type="text" id="customVleInput" name="VLE_CUSTOM" placeholder="VLE का नाम यहाँ लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
    `;

    const annexureDropdownHtml = serviceName.startsWith('annexure') ? `
        <div class="mb-6 p-1 rounded-2xl bg-gradient-to-r from-amber-400 via-royal-500 to-amber-600 shadow-vip-glow relative z-20">
            <div class="bg-dark-950 p-4 rounded-[14px]">
                <label class="block text-[11px] font-black text-amber-400 uppercase mb-2 tracking-widest flex items-center">
                    <i class="fa-solid fa-file-signature mr-1.5 text-royal-400"></i> Official Annexures Collection (Generate: ₹10 • Stamp: +₹20 • Cert: +₹20 = ₹50 Complete)
                </label>
                <select onchange="window.switchService(this.value)" class="w-full p-3.5 border border-slate-700 rounded-xl text-sm font-black bg-dark-900 text-white outline-none cursor-pointer shadow-inner focus:border-amber-400 transition hover:bg-dark-800">
                    <option value="annexure1" ${serviceName==='annexure1'?'selected':''}>📜 Annexure-I (Adults DoB Update)</option>
                    <option value="annexure1a" ${serviceName==='annexure1a'?'selected':''}>👶 Annexure-IA (Children DoB Update)</option>
                    <option value="annexure3" ${serviceName==='annexure3'?'selected':''}>⚡ Annexure-III (Adults Reactivation)</option>
                    <option value="annexure3a" ${serviceName==='annexure3a'?'selected':''}>👦 Annexure-IIIA (Children Reactivation)</option>
                    <option value="annexureb" ${serviceName==='annexureb'?'selected':''}>🧑 Annexure B (Adults Name Update)</option>
                    <option value="annexurec" ${serviceName==='annexurec'?'selected':''}>👧 Annexure C (Children Name Update)</option>
                    <option value="annexured" ${serviceName==='annexured'?'selected':''}>💍 Annexure D (Name Update after Marriage)</option>
                    <option value="annexuree" ${serviceName==='annexuree'?'selected':''}>✂️ Annexure E (Adults Urf/Alias Removal)</option>
                    <option value="annexuref" ${serviceName==='annexuref'?'selected':''}>🖍 Annexure F (Children Urf/Alias Removal)</option>
                </select>
            </div>
        </div>
    ` : '';

    let isFormRendered = false;

    // 0. MINOR SERVICE (माइनर)
    if (serviceName === 'minor') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('minor')) {
            window.switchService(window.getFirstAllowedTab());
            return true;
        }

        const hospitalsList = window.HOSPITALS_LIST || [
            "JAGWATI HOSPITAL NEHRU ROAD BARAUT, BARAUT,  BAGHPAT, UTTAR PRADESH / जगवती हास्पिटल नेहरू रोड बड़ौत, बड़ौत, बागपत, उत्तर प्रदेश",
            "AASTHA NURSING HOME BARAUT, BARAUT, BAGHPAT, UTTAR PRADESH / आस्था नरसिग होम बडौत, बडौत, बागपत, उत्तर प्रदेश",
            "CHC BARAUT, BARAUT, BARAUT, BAGHPAT , UTTAR PRADESH, 250611  / सामुदायिक स्वास्थ्य केंद्र बडौत, बडौत, बडौत, बागपत, उत्तर प्रदेश, 250611",
            "SUB DISTRICT HOSPITAL BARUT, BAGHPAT, UTTAR PRADESH, 260611 / उप-जिला अस्पताल बडौत, बडौत, बडौत, बागपत, उत्तर प्रदेश, 250611"
        ];

        const hospitalSelectHtml = `
            <select name="PB" onchange="window.toggleCustomInput(this, 'customPbInput')" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                ${hospitalsList.map(h => `<option value="${h}">${h}</option>`).join('')}
                <option value="OTHER">OTHER (अन्य अस्पताल का नाम दर्ज करें)</option>
            </select>
            <input type="text" id="customPbInput" name="PB_CUSTOM" placeholder="अस्पताल का नाम यहाँ लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
        `;

        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900 flex items-center gap-2">
                        <i class="fa-solid fa-cake-candles text-royal-500"></i> DOB (जन्म प्रमाण पत्र / Birth Certificate)
                    </h3>
                    <p class="text-[11px] font-bold text-slate-500">जन्म प्रमाण पत्र (DOB) जनरेट करें • शुल्क: 50 Credits (₹50)</p>
                </div>
                <span class="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-amber-300 uppercase">50 Credits (₹50)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('minor')}
                <form onsubmit="window.submitForm(event, 'Minor')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Child Name / नाम (NAME) <span class="text-red-500">*</span></label>
                            <input type="text" name="NAME" placeholder="Enter Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth / जन्मतिथि (DOB) <span class="text-red-500">*</span></label>
                            <input type="date" name="DOB" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gender / लिंग (SEX) <span class="text-red-500">*</span></label>
                            <select name="SEX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="MALE / पुरुष">MALE / पुरुष</option>
                                <option value="FEMALE / महिला">FEMALE / महिला</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mother Name / माता का नाम (MOTHER NAME) <span class="text-red-500">*</span></label>
                            <input type="text" name="MOTHER NAME" placeholder="Enter Mother Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mother ID Last 4 Digits (MA) <span class="text-[10px] text-slate-400 font-normal">(वैकल्पिक / Optional)</span></label>
                            <input type="text" name="MA" maxlength="4" inputmode="numeric" oninput="this.value = this.value.replace(/\\D/g, '').slice(0, 4)" placeholder="अंतिम 4 अंक या खाली छोड़ें" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-widest bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father Name / पिता का नाम (FATHER NAME) <span class="text-red-500">*</span></label>
                            <input type="text" name="FATHER NAME" placeholder="Enter Father Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father ID Last 4 Digits (FA) <span class="text-[10px] text-slate-400 font-normal">(वैकल्पिक / Optional)</span></label>
                            <input type="text" name="FA" maxlength="4" inputmode="numeric" oninput="this.value = this.value.replace(/\\D/g, '').slice(0, 4)" placeholder="अंतिम 4 अंक या खाली छोड़ें" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-widest bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Place of Birth / अस्पताल का नाम (PB) <span class="text-red-500">*</span></label>
                            ${hospitalSelectHtml}
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Address / पूरा पता (ADDRESS) <span class="text-red-500">*</span></label>
                            <input type="text" name="ADDRESS" placeholder="VILL, POST, TEHSIL, DISTRICT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div class="md:col-span-2 pt-2 border-t border-slate-200">
                            <label class="inline-flex items-center gap-2 cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 px-3.5 py-2.5 rounded-xl text-xs font-black select-none transition shadow-sm">
                                <input type="checkbox" id="chkCustomMinorBrn" name="CUSTOM_BRN_ENABLED" value="yes" onchange="window.toggleMinorCustomBrn(this.checked)" class="w-4 h-4 accent-amber-600 rounded cursor-pointer">
                                <span><i class="fa-solid fa-barcode text-amber-600 mr-1"></i> कस्टम रजिस्ट्रेशन नंबर व डेट दर्ज करें (Manual BR, DR &amp; DI)</span>
                            </label>
                        </div>
                        <div id="minorCustomBrnSection" style="display: none;" class="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 bg-amber-50/70 border border-amber-300 rounded-2xl">
                            <div>
                                <label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Registration No. (&lt;&lt;BR&gt;&gt;)</label>
                                <input type="text" name="BR" id="inpMinorBr" placeholder="e.g. B-2026: 09-90054-000123" class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold bg-white focus:border-amber-500 outline-none uppercase relative z-10">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Registration Date (&lt;&lt;DR&gt;&gt;)</label>
                                <input type="date" name="DR" id="inpMinorDr" onchange="const di = document.getElementById('inpMinorDi'); if(di && !di.value) di.value = this.value;" class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold bg-white focus:border-amber-500 outline-none relative z-10">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Date of Issue (&lt;&lt;DI&gt;&gt;)</label>
                                <input type="date" name="DI" id="inpMinorDi" class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold bg-white focus:border-amber-500 outline-none relative z-10">
                            </div>
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10 flex items-center justify-center gap-2">
                        <span>Generate DOB Certificate (50 Credits)</span> <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // DOMICILE
    else if (serviceName === 'domicile') {
        container.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-house-chimney text-royal-500 mr-1.5"></i> Domicile Certificate (मूल निवास)</h3>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('domicile')}
                <form onsubmit="window.submitForm(event, 'Domicile')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">District (जिला)</label>
                            <select id="districtSelect" name="DISTRICT" onchange="window.updateTehsilsAndThanas()" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="BAGHPAT">बागपत</option>
                                <option value="SHAMLI">शामली</option>
                                <option value="MUZAFFARNAGAR">मुजफ्फरनगर</option>
                                <option value="MEERUT">मेरठ</option>
                                <option value="SAHARANPUR">सहारनपुर</option>
                                <option value="GHAZIABAD">गाजियाबाद</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tehsil (तहसील)</label>
                            <select id="tehsilSelect" name="TAHSEEL" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Police Station (थाना)</label>
                            <select id="thanaSelect" name="THANA" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation (संबंध)</label>
                            <select name="REL" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10">
                                <option value="पुत्र / पुत्री">पुत्र / पुत्री</option>
                                <option value="पत्नी      .">पत्नी</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Customer Name (English)</label>
                            <input type="text" name="NAME" placeholder="Enter Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hindi Name (Optional)</label>
                            <input type="text" name="HNAME" placeholder="हिंदी में नाम (वैकल्पिक)" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father / Husband Name</label>
                            <input type="text" name="FNAME" placeholder="Enter Father/Husband Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mother Name</label>
                            <input type="text" name="MNAME" placeholder="Enter Mother Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">House Number (मकान नंबर - MN)</label>
                            <input type="text" name="MN" placeholder="Enter House No" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Area / Locality (मोहल्ला / पोस्ट)</label>
                            <input type="text" name="AREA" placeholder="Enter Area / Locality" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Village / Ward Name (गाँव / वार्ड)</label>
                            <input type="text" name="GRAM" placeholder="Enter Village / Ward Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">VLE Name (जन सेवा केंद्र संचालक)</label>
                            ${vleSelectHtml}
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-royal-700 uppercase mb-1">Issue Date (जारी करने की तारीख)</label>
                            <input type="date" name="ISSUE_DATE" value="${todayISO}" required class="w-full p-3 border border-royal-300 rounded-xl text-sm bg-royal-50/50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Photo</label>
                            <input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-700 cursor-pointer relative z-10">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.updateTehsilsAndThanas();
        isFormRendered = true;
    }

    // CASTE
    else if (serviceName === 'caste') {
        container.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-users text-royal-500 mr-1.5"></i> Caste Certificate (जाति प्रमाण पत्र)</h3>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('caste')}
                <form onsubmit="window.submitForm(event, 'Caste')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">District (जिला)</label>
                            <select id="districtSelect" name="DISTRICT" onchange="window.updateTehsilsAndThanas()" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="BAGHPAT">बागपत</option>
                                <option value="SHAMLI">शामली</option>
                                <option value="MUZAFFARNAGAR">मुजफ्फरनगर</option>
                                <option value="MEERUT">मेरठ</option>
                                <option value="SAHARANPUR">सहारनपुर</option>
                                <option value="GHAZIABAD">गाजियाबाद</option>
                            </select>
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tehsil (तहसील)</label><select id="tehsilSelect" name="TAHSEEL" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></select></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="REL" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"><option value="पुत्र / पुत्री">पुत्र / पुत्री</option><option value="पत्नी      .">पत्नी</option></select></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Caste (जाति)</label>
                            <select name="CAST" onchange="window.toggleCustomInput(this, 'customCasteInput')" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                ${window.CASTE_OPTIONS_LIST.map(c => `<option value="${c}">${c}</option>`).join('')}
                                <option value="OTHER">OTHER (अन्य जाति लिखें)</option>
                            </select>
                            <input type="text" id="customCasteInput" name="CAST_CUSTOM" placeholder="जाति का नाम यहाँ लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Customer Name</label><input type="text" name="NAME" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hindi Name (Optional)</label><input type="text" name="HNAME" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father/Husband Name</label><input type="text" name="FNAME" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mother Name</label><input type="text" name="MNAME" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Area / Locality</label><input type="text" name="AREA" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Village / Ward Name</label><input type="text" name="GRAM" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">VLE Name</label>
                            ${vleSelectHtml}
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-royal-700 uppercase mb-1">Issue Date (जारी करने की तारीख)</label>
                            <input type="date" name="ISSUE_DATE" value="${todayISO}" required class="w-full p-3 border border-royal-300 rounded-xl text-sm bg-royal-50/50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Photo</label><input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-700 cursor-pointer relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.updateTehsilsAndThanas();
        isFormRendered = true;
    }

    // e-VOTER ID (ई-वोटर आईडी कार्ड)
    else if (serviceName === 'evoter' || serviceName === 'e-voter') {
        const evoterSubmitBtnText = 'Generate e-Voter ID (10 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';

        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-id-card-clip text-royal-500 mr-1.5"></i> e-Voter ID Card (ई-मतदाता पहचान पत्र / e-EPIC)</h3>
                    <p class="text-[11px] font-bold text-slate-500">तुरंत प्रिंटेबल फ्रंट-बैक ई-वोटर कार्ड व सत्यापन पत्रक बनाएं</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('evoter')}
                <form onsubmit="window.submitForm(event, 'e-Voter ID')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-royal-700 uppercase">EPIC Number (वोटर आईडी नंबर) <span class="text-red-500">*</span></label>
                                <button type="button" onclick="document.getElementById('inpEpicNo').value = window.generateRandomEpicNo();" class="text-[10px] bg-royal-100 hover:bg-royal-200 text-royal-900 font-black px-2 py-0.5 rounded border border-royal-300 transition"><i class="fa-solid fa-shuffle mr-1"></i>Auto Generate</button>
                            </div>
                            <input type="text" id="inpEpicNo" name="EPIC_NO" placeholder="e.g. UPB1234567 (या Auto पर क्लिक करें)" required class="w-full p-3 border border-royal-300 rounded-xl text-sm font-black tracking-wider bg-royal-50/40 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name (मतदाता का नाम - English) <span class="text-red-500">*</span></label>
                            <input type="text" name="NAME" placeholder="Enter Elector Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hindi Name (हिंदी में नाम - वैकल्पिक)</label>
                            <input type="text" name="HNAME" placeholder="हिंदी में नाम लिखें (Optional)" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">संबंध</label>
                                <select name="REL_TYPE" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                                    <option value="S/O">पिता (Father)</option>
                                    <option value="W/O">पति (Husband)</option>
                                </select>
                            </div>
                            <div class="col-span-2">
                                <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father / Husband Name <span class="text-red-500">*</span></label>
                                <input type="text" name="FNAME" placeholder="Enter Father/Husband Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth (जन्मतिथि - DOB) <span class="text-red-500">*</span></label>
                            <input type="date" name="DOB" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gender (लिंग) <span class="text-red-500">*</span></label>
                            <select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="MALE / पुरुष">MALE / पुरुष</option>
                                <option value="FEMALE / महिला">FEMALE / महिला</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">District (जिला)</label>
                            <select id="districtSelect" name="DISTRICT" onchange="window.updateTehsilsAndThanas()" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="BAGHPAT">बागपत</option>
                                <option value="SHAMLI">शामली</option>
                                <option value="MUZAFFARNAGAR">मुजफ्फरनगर</option>
                                <option value="MEERUT">मेरठ</option>
                                <option value="SAHARANPUR">सहारनपुर</option>
                                <option value="GHAZIABAD">गाजियाबाद</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Assembly / Tehsil (विधानसभा / तहसील)</label>
                            <select id="tehsilSelect" name="TAHSEEL" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></select>
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Complete Address (पूरा पता) <span class="text-red-500">*</span></label>
                            <input type="text" name="ADDRESS" placeholder="HOUSE NO, VILLAGE/WARD, POST, PIN CODE" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Elector Photo (पासपोर्ट फोटो अपलोड करें)</label>
                            <input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-700 cursor-pointer relative z-10">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${evoterSubmitBtnText}</button>
                </form>
            </div>
        `;
        window.updateTehsilsAndThanas();
        if (!window.currentEditingAnnexure) {
            const epicInp = document.getElementById('inpEpicNo');
            if (epicInp && !epicInp.value) epicInp.value = window.generateRandomEpicNo();
        }
        isFormRendered = true;
    }

    // DOB CERTIFICATE DELHI (MCD Form No. 5 - Place of Birth Dropdown + Single Address Input Auto-Sync)
    else if (serviceName === 'dob_delhi' || serviceName === 'dob_minor') {
        const dobDelhiBtnText = 'Generate MCD Delhi Birth Certificate (50 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';

        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-cake-candles text-royal-500 mr-1.5"></i> MCD Delhi Birth Certificate (दिल्ली जन्म प्रमाण पत्र • Form No. 5)</h3>
                    <p class="text-[11px] font-bold text-slate-500">Place of Birth ड्रॉपडाउन से चुनें और केवल 1 बार पता टाइप करें (दोनों पते अपने-आप भर जाएंगे) • शुल्क: 50 Credits (₹50)</p>
                </div>
                <span class="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-emerald-300 uppercase">50 Credits (₹50)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('dob_delhi')}
                <form onsubmit="window.submitForm(event, 'DOB Delhi')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <!-- 1. Registration No -->
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-royal-700 uppercase">Registration No (पंजीकरण संख्या) <span class="text-red-500">*</span></label>
                                <button type="button" onclick="document.getElementById('inpMcdRegNo').value = window.generateMcdRegNo();" class="text-[10px] bg-royal-100 hover:bg-royal-200 text-royal-900 font-black px-2 py-0.5 rounded border border-royal-300 transition"><i class="fa-solid fa-shuffle mr-1"></i>Auto Generate</button>
                            </div>
                            <input type="text" id="inpMcdRegNo" name="REG_NO" placeholder="e.g. MCDOLIR-2219-007395634" required class="w-full p-3 border border-royal-300 rounded-xl text-sm font-black tracking-wider bg-royal-50/40 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 2. Full Name -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Child / Person Name (नाम / Name) <span class="text-red-500">*</span></label>
                            <input type="text" name="NAME" placeholder="e.g. SAHIL ASHRAF" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 3. Gender -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gender (लिंग / Gender) <span class="text-red-500">*</span></label>
                            <select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="MALE">MALE</option>
                                <option value="FEMALE">FEMALE</option>
                                <option value="TRANSGENDER">TRANSGENDER</option>
                            </select>
                        </div>

                        <!-- 4. Date of Birth -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth (जन्म की तिथि) <span class="text-red-500">*</span></label>
                            <input type="date" id="inpMcdDob" name="DOB" onchange="const dorEl = document.getElementById('inpMcdDor'); if(dorEl && !dorEl.value) dorEl.value = this.value;" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>

                        <!-- 5. Mother Name -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Name of Mother (माता का नाम) <span class="text-red-500">*</span></label>
                            <input type="text" name="MNAME" placeholder="e.g. FOUZIA TEMURI" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 6. Father Name -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Name of Father (पिता का नाम) <span class="text-red-500">*</span></label>
                            <input type="text" name="FNAME" placeholder="e.g. MAHMOOD ASHRAF" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 7. Date of Registration -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Registration (पंजीकरण की तिथि) <span class="text-red-500">*</span></label>
                            <input type="date" id="inpMcdDor" name="DOR" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>

                        <!-- 8. Date of Issue -->
                        <div>
                            <label class="block text-[11px] font-bold text-royal-700 uppercase mb-1">Date of Issue (जारी करने की तिथि) <span class="text-red-500">*</span></label>
                            <input type="date" name="DOI" value="${todayISO}" required class="w-full p-3 border border-royal-300 rounded-xl text-sm font-bold bg-royal-50/40 focus:bg-white outline-none relative z-10">
                        </div>

                        <!-- 9. Place of Birth DROPDOWN (3 Hospitals near Kamra Bangash + Placeholder Address + OTHER) -->
                        <div class="md:col-span-2 bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2 relative z-10">
                            <label class="block text-[11px] font-black text-indigo-950 uppercase">
                                <i class="fa-solid fa-hospital text-royal-600 mr-1"></i> Place of Birth (जन्म का स्थान — अस्पताल या पता चुनें) <span class="text-red-500">*</span>
                            </label>
                            <select id="selMcdPobDropdown" name="POB_SELECT" onchange="window.handleDobDelhiPobChange(this)" required class="w-full p-3 border border-indigo-300 rounded-xl text-xs md:text-sm font-black bg-white text-slate-800 outline-none focus:border-royal-500 cursor-pointer">
                                <option value="2529,KAMRA BANGASH SIR SAYED AHMED ROAD CHANDNI MAHAL DELHI-110006">1. 2529, KAMRA BANGASH SIR SAYED AHMED ROAD CHANDNI MAHAL DELHI-110006</option>
                                <option value="KASTURBA HOSPITAL, DARYA GANJ, NEAR JAMA MASJID, CHANDNI MAHAL, DELHI-110006">2. KASTURBA HOSPITAL, DARYA GANJ, NEAR JAMA MASJID, CHANDNI MAHAL, DELHI-110006</option>
                                <option value="LOK NAYAK HOSPITAL (LNJP), JAWAHARLAL NEHRU MARG, NEAR DELHI GATE, DARYA GANJ, NEW DELHI-110002">3. LOK NAYAK HOSPITAL (LNJP), JAWAHARLAL NEHRU MARG, NEAR DELHI GATE, DARYA GANJ, NEW DELHI-110002</option>
                                <option value="ST. STEPHEN'S HOSPITAL, TIS HAZARI, NEAR KASHMERE GATE, OLD DELHI, DELHI-110054">4. ST. STEPHEN'S HOSPITAL, TIS HAZARI, NEAR KASHMERE GATE, OLD DELHI, DELHI-110054</option>
                                <option value="OTHER">5. OTHER (खुद टाइप करके अस्पताल या जन्म स्थान का पता डालें)</option>
                            </select>

                            <!-- Custom Place of Birth Input (Opens when OTHER is selected) -->
                            <div id="dobDelhiPobCustomWrapper" style="display: none;" class="pt-1">
                                <input
                                    type="text"
                                    id="inpMcdPobCustom"
                                    name="POB_CUSTOM"
                                    oninput="window.syncDobDelhiCustomPob(this)"
                                    placeholder="यहाँ जन्म स्थान / अस्पताल का पूरा पता टाइप करें (Enter Custom Place of Birth)..."
                                    class="w-full p-3 border-2 border-amber-400 rounded-xl text-sm font-bold bg-amber-50 focus:bg-white outline-none uppercase"
                                >
                            </div>

                            <!-- Synced POB value sent to PDF Engine -->
                            <input type="hidden" id="inpMcdPob" name="POB" value="2529,KAMRA BANGASH SIR SAYED AHMED ROAD CHANDNI MAHAL DELHI-110006">
                        </div>

                        <!-- 10. SINGLE COMBINED MOTHER/FATHER ADDRESS BOX (Auto-Fills Both Birth-Time & Permanent Address) -->
                        <div class="md:col-span-2 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-300 space-y-1.5 relative z-10">
                            <div class="flex flex-wrap items-center justify-between gap-1">
                                <label class="text-[11px] font-black text-emerald-950 uppercase">
                                    <i class="fa-solid fa-location-dot text-emerald-600 mr-1"></i> Mother / Father Complete Address (माता-पिता का वर्तमान एवं स्थायी पता) <span class="text-red-500">*</span>
                                </label>
                                <span class="bg-emerald-200 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full">Auto-Fills Both Address Sections</span>
                            </div>
                            <input
                                type="text"
                                id="inpMcdPresAddr"
                                name="PRES_ADDR"
                                oninput="window.syncDobDelhiUnifiedAddress(this)"
                                placeholder="e.g. 2529,TIRAHA BEHRAM KHAN DARYA GANJ DELHI-110002"
                                required
                                class="w-full p-3 border border-emerald-400 rounded-xl text-sm font-bold bg-white outline-none uppercase focus:border-emerald-600"
                            >
                            <p class="text-[11px] font-bold text-emerald-800">
                                <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>केवल इसी एक बॉक्स में पता टाइप करें — यह <strong>Address at the time of Birth</strong> और <strong>Permanent Address</strong> दोनों जगह अपने-आप भर जाएगा।
                            </p>
                            <!-- Hidden auto-synced fields for Permanent & General Address -->
                            <input type="hidden" id="inpMcdPermAddr" name="PERM_ADDR" value="">
                            <input type="hidden" id="inpMcdAddress" name="ADDRESS" value="">
                            <input type="hidden" id="inpMcdBirthAddress" name="BIRTH_ADDRESS" value="">
                            <input type="hidden" id="inpMcdPermanentAddress" name="PERMANENT_ADDRESS" value="">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${dobDelhiBtnText}</button>
                </form>
            </div>
        `;
        if (!window.currentEditingAnnexure) {
            const regInp = document.getElementById('inpMcdRegNo');
            if (regInp && !regInp.value && typeof window.generateMcdRegNo === 'function') {
                regInp.value = window.generateMcdRegNo();
            }
        }
        isFormRendered = true;
    }

    // PASSPORT SERVICES
    else if (serviceName === 'passport') {
        const passportBtnText = 'Generate Passport Document (30 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';

        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-passport text-sky-500 mr-1.5"></i> Passport Services (पासपोर्ट सर्विस)</h3>
                    <p class="text-[11px] font-bold text-slate-500">पासपोर्ट डॉक्यूमेंट जनरेट करें • शुल्क: 30 Credits (₹30)</p>
                </div>
                <span class="bg-sky-100 text-sky-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-sky-300 uppercase">30 Credits (₹30)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('passport')}
                <form onsubmit="window.submitForm(event, 'Passport')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name (पूरा नाम)</label><input type="text" name="NAME" placeholder="Enter Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father / Husband Name</label><input type="text" name="FNAME" placeholder="Enter Father/Husband Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mother Name (वैकल्पिक)</label><input type="text" name="MNAME" placeholder="Enter Mother Name" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Sex / Gender</label><select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option></select></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth (DOB)</label><input type="date" name="DOB" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-sky-700 uppercase mb-1">Issue Date (जारी करने की तारीख)</label><input type="date" name="ISSUE_DATE" value="${todayISO}" required class="w-full p-3 border border-sky-300 rounded-xl text-sm bg-sky-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Pin Code</label><input type="text" name="PIN" placeholder="Enter Pin Code" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Address (पूरा पता)</label><input type="text" name="ADDRESS" placeholder="Enter Complete Address" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Photo (पासपोर्ट फोटो)</label>
                            <input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-sky-100 file:text-sky-700 cursor-pointer relative z-10">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${passportBtnText}</button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // GAZETTE NOTIFICATION (गैजेट नोटिफिकेशन • UPDATED FOR NEW 3-SECTION TEMPLATE • ₹100 / 100 Credits)
    else if (serviceName === 'gazette') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('gazette')) { window.switchService(window.getFirstAllowedTab()); return true; }

        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-newspaper text-purple-600 mr-1.5"></i> Gazette Notification (गैजेट नोटिफिकेशन • भारत का राजपत्र भाग IV)</h3>
                    <p class="text-[11px] font-bold text-slate-500">नए टेम्पलेट के अनुसार: Old Name व New Name बोल्ड छपेंगे + 2 रैंडम इंडियन सेक्शन अपने-आप जुड़ेंगे • शुल्क: 100 Credits (₹100)</p>
                </div>
                <span class="bg-purple-100 text-purple-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-purple-300 uppercase">100 Credits (₹100)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('gazette')}
                <form onsubmit="window.submitForm(event, 'Gazette Notification')" class="space-y-3.5 relative z-10">
                    <!-- Hidden compatibility fields -->
                    <input type="hidden" id="inpGazetteNo" name="GAZETTE_NO" value="CG-DL-W-2021-232514">
                    <input type="hidden" id="inpGazetteApplicantTypeHidden" name="APPLICANT_TYPE" value="ADULT">
                    <input type="hidden" id="inpGazetteChildRelHidden" name="CHILD_REL" value="son">

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <!-- 1. Application Type (Adult Self vs Minor Son / Daughter) -->
                        <div>
                            <label class="block text-[11px] font-bold text-purple-800 uppercase mb-1">Applicant Category (आवेदक का प्रकार) <span class="text-red-500">*</span></label>
                            <select name="CHANGE_TYPE" onchange="window.toggleGazetteChangeMode(this.value)" class="w-full p-3 border border-purple-300 rounded-xl text-sm font-black bg-purple-50/50 focus:bg-white outline-none relative z-10 cursor-pointer">
                                <option value="ADULT_SELF">1. ADULT / SELF (वयस्क — स्वयं का नाम परिवर्तन)</option>
                                <option value="MINOR_SON">2. MINOR SON (नाबालिग बेटे का नाम परिवर्तन — माता/पिता द्वारा)</option>
                                <option value="MINOR_DAUGHTER">3. MINOR DAUGHTER (नाबालिग बेटी का नाम परिवर्तन — माता/पिता द्वारा)</option>
                            </select>
                        </div>

                        <!-- 2. Relation Type -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation (संबंध - son of / daughter of / wife of) <span class="text-red-500">*</span></label>
                            <select name="REL_TYPE" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10 cursor-pointer">
                                <option value="son of">son of (पुत्र)</option>
                                <option value="daughter of">daughter of (पुत्री)</option>
                                <option value="wife of">wife of (पत्नी)</option>
                            </select>
                        </div>

                        <!-- Minor Extra Fields (Shown when Minor Son/Daughter is selected) -->
                        <div id="gazetteMinorFields" style="display: none;" class="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl">
                            <div>
                                <label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Guardian / Parent Name (अभिभावक का नाम - BOLD) <span class="text-red-500">*</span></label>
                                <input type="text" id="inpGazetteGuardian" name="GUARDIAN_NAME" placeholder="e.g. VISHAL SHUKLA" class="w-full p-2.5 border border-amber-300 rounded-xl text-sm font-bold bg-white outline-none uppercase">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Guardian's Father Name (अभिभावक के पिता)</label>
                                <input type="text" name="GUARDIAN_FATHER" placeholder="e.g. Late DAYA SHANKAR SHUKLA" class="w-full p-2.5 border border-amber-300 rounded-xl text-sm font-bold bg-white outline-none uppercase">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Child Age in Years (बच्चे की उम्र) <span class="text-red-500">*</span></label>
                                <input type="number" id="inpGazetteChildAge" name="CHILD_AGE" value="6" placeholder="e.g. 6" min="1" max="17" class="w-full p-2.5 border border-amber-300 rounded-xl text-sm font-bold bg-white outline-none">
                            </div>
                        </div>

                        <!-- 3. Old Name (Printed in BOLD) -->
                        <div>
                            <label id="lblGazetteOldName" class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Old Name (पुराना नाम / गलत नाम - BOLD) <span class="text-red-500">*</span></label>
                            <input type="text" name="OLD_NAME" placeholder="e.g. SUBRATA DAS" required class="w-full p-3 border border-slate-300 rounded-xl text-sm font-black bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 4. New Name (Printed in BOLD) -->
                        <div>
                            <label id="lblGazetteNewName" class="block text-[11px] font-bold text-emerald-700 uppercase mb-1">New Name (नया सही नाम - BOLD) <span class="text-red-500">*</span></label>
                            <input type="text" name="NEW_NAME" placeholder="e.g. DREYVAN DAYSE" required class="w-full p-3 border border-emerald-300 rounded-xl text-sm font-black bg-emerald-50/40 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 5. Father / Husband Name (Printed in BOLD) -->
                        <div>
                            <label id="lblGazetteFatherName" class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Father / Husband Name (पिता / पति का नाम - BOLD) <span class="text-red-500">*</span></label>
                            <input type="text" name="FNAME" placeholder="e.g. Late RADHA RAMAN DAS / Sh. RAMESH CHAND" required class="w-full p-3 border border-slate-300 rounded-xl text-sm font-black bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                        </div>

                        <!-- 6. Occupation / Profession (Optional) -->
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Occupation / Employment (पेशा — Optional / वैकल्पिक)</label>
                            <input type="text" name="REASON" placeholder="e.g. Private Service / Business (या खाली छोड़ें)" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>

                        <!-- 7. Complete Residential Address -->
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Complete Address (पूरा पता — जैसा गजट में छपेगा) <span class="text-red-500">*</span></label>
                            <input type="text" name="ADDRESS" placeholder="e.g. H.No. 43, Block-P, Sector-12, Noida, Gautam Budh Nagar, Uttar Pradesh-201301" required class="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10">
                        </div>
                    </div>

                    <div class="p-3 rounded-xl bg-purple-50/60 border border-purple-200 text-[11px] font-bold text-purple-950 flex flex-wrap items-center justify-between gap-2">
                        <span><i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Fixed Header: <strong>सं. 53] / No. 53] • 24-Jun-2021—26-Mar-2013 (Ashadh 3, 1943)</strong></span>
                        <span class="bg-purple-200 text-purple-950 px-2.5 py-0.5 rounded-full text-[10px] font-black">Part IV • Page (1235)</span>
                    </div>

                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">
                        Generate Gazette Notification (100 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>
                    </button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // DOB ORIGINAL PDF (डेट ऑफ बर्थ PDF ओरिजिनल • ₹140 / 140 Credits)
    else if (serviceName === 'dob_print') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('dob_print')) { window.switchService(window.getFirstAllowedTab()); return true; }

        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-file-pdf text-teal-600 mr-1.5"></i> DOB Original PDF (डेट ऑफ बर्थ PDF ओरिजिनल)</h3>
                    <p class="text-[11px] font-bold text-slate-500">बीआरएन (BRN) नंबर और नाम से ओरिजिनल जन्म प्रमाण-पत्र PDF प्राप्त करें • शुल्क: 140 Credits (₹140)</p>
                </div>
                <span class="bg-teal-100 text-teal-900 px-3 py-1 rounded-md text-xs font-black border border-teal-300 uppercase">140 Credits (₹140)</span>
            </div>

            <div class="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-slate-50 border-2 border-teal-300 relative z-20 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-black text-teal-950 uppercase"><i class="fa-solid fa-bolt text-teal-600 mr-1"></i> Quick BRN Original PDF Apply (केवल नाम और BRN नंबर से):</span>
                    <span class="text-[10px] font-black bg-dark-900 text-royal-300 px-2.5 py-0.5 rounded-full">Server Secured • ₹140</span>
                </div>
                <form onsubmit="window.submitForm(event, 'DOB Print')" class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <input type="hidden" name="DOB_PRINT_MODE" value="BRN_API">
                    <div>
                        <label class="block text-[10px] font-black text-slate-600 uppercase mb-1">Full Name (पूरा नाम) <span class="text-red-500">*</span></label>
                        <input type="text" name="NAME" placeholder="e.g. RAJESH KUMAR" required class="w-full p-3 border border-teal-300 rounded-xl text-xs font-bold bg-white outline-none uppercase">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-600 uppercase mb-1">BRN Number (बीआरएन नंबर) <span class="text-red-500">*</span></label>
                        <input type="text" name="BRN_NO" placeholder="e.g. B202606901080000903" required class="w-full p-3 border border-teal-300 rounded-xl text-xs font-black bg-white outline-none uppercase">
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3 px-4 rounded-xl text-xs shadow-glow transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-cloud-arrow-down"></i> Apply Original PDF (₹140)
                    </button>
                </form>
            </div>
        `;
        window.updateTehsilsAndThanas();
        if (!window.currentEditingAnnexure) {
            const bInp = document.getElementById('inpDobPrintBrn');
            if (bInp && !bInp.value && typeof window.generateDobPrintBrn === 'function') bInp.value = window.generateDobPrintBrn();
        }
        isFormRendered = true;
    }

    // 1. ANNEXURE-I
    else if (serviceName === 'annexure1') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-file-signature text-royal-500 mr-1.5"></i> Annexure-I (Adults DoB Update)</h3>
                    <p class="text-[11px] text-slate-500">जनरेट करने के बाद ⚙️ गियर आइकन -> Document History से Print व Download करें।</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('annexure1')}
                <form onsubmit="window.submitLocalAnnexureForm(event, 'Annexure 1', 'LOCAL_HTML_ANNEXURE_1')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">आवेदक का नाम (Applicant Name)</label><input type="text" name="applicantName" placeholder="e.g. RAMESH KUMAR" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="D/o">D/o</option><option value="W/o">W/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पिता / पति का नाम</label><input type="text" name="relativeName" placeholder="e.g. SURESH CHAND" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">12-Digit ID Number (4-4 Pair)</label>
                            <input type="text" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">कितनी बार DoB अपडेट किया?</label>
                            <select name="updateTimes" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10">
                                <option value="NEVER">NEVER (कभी नहीं)</option>
                                <option value="ONCE">ONCE (एक बार)</option>
                                <option value="MORE THAN ONCE">MORE THAN ONCE (एक से अधिक बार)</option>
                            </select>
                        </div>
                        <div><label class="block text-[11px] font-bold text-green-700 uppercase mb-1">सही जन्मतिथि (Correct DoB)</label><input type="date" name="newDob" required class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold bg-green-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">पहले दर्ज जन्मतिथि (Old DoB)</label><input type="date" name="oldDob" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold bg-amber-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दिया गया दस्तावेज़ (Old Doc)</label>
                            <select name="oldDoc" onchange="window.toggleCustomInput(this, 'an1OldDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                                ${window.buildDocSelectOptions("BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an1OldDocCustom" name="oldDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">अभी दिया जा रहा दस्तावेज़ (New Doc)</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an1NewDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                                ${window.buildDocSelectOptions("BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an1NewDocCustom" name="newDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, TEHSIL, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // 2. ANNEXURE-IA
    else if (serviceName === 'annexure1a') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-child-reaching text-royal-500 mr-1.5"></i> Annexure-IA (Children DoB Update)</h3>
                    <p class="text-[11px] text-slate-500">बच्चों (18 से कम) की जन्मतिथि अपडेट हेतु माता-पिता का शपथ पत्र।</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('annexure1a')}
                <form onsubmit="window.submitLocalAnnexureForm(event, 'Annexure 1A', 'LOCAL_HTML_ANNEXURE_1A')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का नाम (Parent Name)</label><input type="text" name="parentName" placeholder="e.g. SURESH KUMAR" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10"></div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="W/o">W/o</option><option value="D/o">D/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">दादा / पति का नाम</label><input type="text" name="relativeName" placeholder="e.g. RAMPHAL" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का 12-Digit ID Number</label>
                            <input type="text" name="parentIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-amber-50 relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का नाम (Child Name)</label><input type="text" name="childName" placeholder="e.g. AARAV KUMAR" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold uppercase bg-indigo-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label>
                            <input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-green-800 uppercase mb-1">बच्चे की सही जन्मतिथि (Correct DoB)</label><input type="date" name="newDob" required class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold bg-green-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दर्ज गलत जन्मतिथि (Old DoB)</label><input type="date" name="oldDob" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दिया गया दस्तावेज़ (Old Doc)</label>
                            <select name="oldDoc" onchange="window.toggleCustomInput(this, 'an1aOldDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                                ${window.buildDocSelectOptions("BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an1aOldDocCustom" name="oldDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">कितनी बार अपडेट किया?</label>
                            <select name="updateTimes" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10">
                                <option value="NEVER">NEVER (कभी नहीं)</option>
                                <option value="ONCE">ONCE (एक बार)</option>
                                <option value="MORE THAN ONCE">MORE THAN ONCE (एक से अधिक बार)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">अभी दिया जा रहा दस्तावेज़ (New Doc)</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an1aNewDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                                ${window.buildDocSelectOptions("BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an1aNewDocCustom" name="newDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // 3. ANNEXURE-III
    else if (serviceName === 'annexure3') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-bolt text-royal-500 mr-1.5"></i> Annexure-III (Adults Reactivation)</h3>
                    <p class="text-[11px] text-slate-500">वयस्कों की निष्क्रिय आईडी को चालू (Reactivate) कराने हेतु शपथ पत्र।</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('annexure3')}
                <form onsubmit="window.submitLocalAnnexureForm(event, 'Annexure 3', 'LOCAL_HTML_ANNEXURE_3')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">आवेदक का नाम (Applicant Name)</label><input type="text" name="applicantName" placeholder="e.g. RAMESH KUMAR" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="D/o">D/o</option><option value="W/o">W/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पिता / पति का नाम</label><input type="text" name="relativeName" placeholder="e.g. SURESH CHAND" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">12-Digit ID Number (4-4 Pair)</label>
                            <input type="text" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">पहले दिया गया अमान्य दस्तावेज़ (Invalid Doc)</label>
                            <select name="invalidDocName" onchange="window.toggleCustomInput(this, 'an3InvDocCustom')" class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                                ${window.buildDocSelectOptions("INVALID BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an3InvDocCustom" name="invalidDocNameCustom" placeholder="अमान्य दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-amber-800 uppercase">अमान्य दस्तावेज़ का नंबर (Doc No)</label>
                                <label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none relative z-10">
                                    <input type="checkbox" onchange="window.toggleNaField(this, 'an3InvDocNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA
                                </label>
                            </div>
                            <input type="text" id="an3InvDocNo" name="invalidDocNo" placeholder="Enter Document No" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-amber-800 uppercase">अमान्य दस्तावेज़ की तारीख (Doc Date)</label>
                                <label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none relative z-10">
                                    <input type="checkbox" onchange="window.toggleNaField(this, 'an3InvDocDate', 'date')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA
                                </label>
                            </div>
                            <input type="date" id="an3InvDocDate" name="invalidDocDate" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-amber-800 uppercase">EID Number (एनरोलमेंट आईडी)</label>
                                <label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none relative z-10">
                                    <input type="checkbox" onchange="window.toggleNaField(this, 'an3EidNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA
                                </label>
                            </div>
                            <input type="text" id="an3EidNo" name="eidNumber" placeholder="Enter EID Number" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-green-800 uppercase mb-1">अभी दिया जा रहा सही दस्तावेज़</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an3NewDocCustom')" class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold uppercase bg-green-50 relative z-10">
                                ${window.buildDocSelectOptions("BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an3NewDocCustom" name="newDocCustom" placeholder="सही दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-green-300 rounded-xl text-xs bg-green-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // 4. ANNEXURE-IIIA
    else if (serviceName === 'annexure3a') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-child text-royal-500 mr-1.5"></i> Annexure-IIIA (Children Reactivation)</h3>
                    <p class="text-[11px] text-slate-500">बच्चों की निष्क्रिय आईडी को चालू (Reactivate) कराने हेतु माता-पिता का शपथ पत्र।</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('annexure3a')}
                <form onsubmit="window.submitLocalAnnexureForm(event, 'Annexure 3A', 'LOCAL_HTML_ANNEXURE_3A')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का नाम (Parent Name)</label><input type="text" name="parentName" placeholder="e.g. SURESH KUMAR" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10"></div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="W/o">W/o</option><option value="D/o">D/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">दादा / पति का नाम</label><input type="text" name="relativeName" placeholder="e.g. RAMPHAL" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का 12-Digit ID Number</label>
                            <input type="text" name="parentIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-amber-50 relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का नाम (Child Name)</label><input type="text" name="childName" placeholder="e.g. AARAV KUMAR" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold uppercase bg-indigo-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label>
                            <input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दिया गया अमान्य दस्तावेज़</label>
                            <select name="invalidDocName" onchange="window.toggleCustomInput(this, 'an3aInvDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                                ${window.buildDocSelectOptions("INVALID BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an3aInvDocCustom" name="invalidDocNameCustom" placeholder="अमान्य दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-slate-600 uppercase">अमान्य दस्तावेज़ का नंबर (Doc No)</label>
                                <label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none relative z-10">
                                    <input type="checkbox" onchange="window.toggleNaField(this, 'an3aInvDocNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA
                                </label>
                            </div>
                            <input type="text" id="an3aInvDocNo" name="invalidDocNo" placeholder="Enter Document No" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-slate-600 uppercase">अमान्य दस्तावेज़ की तारीख (Doc Date)</label>
                                <label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none relative z-10">
                                    <input type="checkbox" onchange="window.toggleNaField(this, 'an3aInvDocDate', 'date')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA
                                </label>
                            </div>
                            <input type="date" id="an3aInvDocDate" name="invalidDocDate" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-slate-600 uppercase">EID Number (एनरोलमेंट आईडी)</label>
                                <label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none relative z-10">
                                    <input type="checkbox" onchange="window.toggleNaField(this, 'an3aEidNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA
                                </label>
                            </div>
                            <input type="text" id="an3aEidNo" name="eidNumber" placeholder="Enter EID Number" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-green-800 uppercase mb-1">अभी दिया जा रहा सही दस्तावेज़</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an3aNewDocCustom')" class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold uppercase bg-green-50 relative z-10">
                                ${window.buildDocSelectOptions("BIRTH CERTIFICATE")}
                            </select>
                            <input type="text" id="an3aNewDocCustom" name="newDocCustom" placeholder="सही दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-green-300 rounded-xl text-xs bg-green-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        isFormRendered = true;
    }

    // 5, 6, 7. ANNEXURE B, C, D
    else if (serviceName === 'annexureb' || serviceName === 'annexurec' || serviceName === 'annexured') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        const isChild = (serviceName === 'annexurec');
        const mapInfo = {
            'annexureb': { title: 'Annexure B', key: 'LOCAL_HTML_ANNEXURE_B', desc: 'वयस्कों के नाम सुधार / परिवर्तन हेतु शपथ पत्र' },
            'annexurec': { title: 'Annexure C', key: 'LOCAL_HTML_ANNEXURE_C', desc: 'बच्चों के नाम सुधार / परिवर्तन हेतु माता-पिता द्वारा शपथ पत्र' },
            'annexured': { title: 'Annexure D', key: 'LOCAL_HTML_ANNEXURE_D', desc: 'विवाह पश्चात या दूसरी बार नाम अपडेट करने हेतु शपथ पत्र' }
        }[serviceName];

        const childFieldsHtml = isChild ? `
            <div>
                <label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label>
                <input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10">
            </div>
        ` : '';

        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-file-contract text-royal-500 mr-1.5"></i> ${mapInfo.title} - Name Update Affidavit</h3>
                    <p class="text-[11px] text-slate-500">${mapInfo.desc}</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml(serviceName)}
                <form onsubmit="window.submitLocalAnnexureForm(event, '${mapInfo.title}', '${mapInfo.key}')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label><select name="title" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="Shri">Shri</option><option value="Smt.">Smt.</option><option value="Ms.">Ms.</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">${isChild ? 'माता/पिता का नाम (Parent)' : 'आवेदक का नाम (Applicant)'}</label><input type="text" name="applicantName" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="W/o">W/o</option><option value="D/o">D/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पिता / पति का नाम</label><input type="text" name="relativeName" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">${isChild ? 'माता/पिता का 12-Digit ID Number' : '12-Digit ID Number (4-4 Pair)'}</label>
                            <input type="text" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10">
                        </div>
                        ${childFieldsHtml}
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">पहले दर्ज नाम (Old Recorded Name)</label><input type="text" name="oldName" placeholder="OLD NAME" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-green-800 uppercase mb-1">नया सही नाम (New Correct Name)</label><input type="text" name="newName" placeholder="NEW CORRECT NAME" required class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold uppercase bg-green-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">सपोर्टिंग दस्तावेज़ (Supporting PoI Doc)</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'anBcdDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                                ${window.buildDocSelectOptions(isChild ? "BIRTH CERTIFICATE" : "PAN CARD")}
                            </select>
                            <input type="text" id="anBcdDocCustom" name="newDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">स्थान (Verified at Place)</label><input type="text" name="place" placeholder="e.g. BARAUT" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">दिन (Day)</label><input type="text" id="inpDay" name="day" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">महीना व वर्ष</label><input type="text" id="inpMonthYear" name="monthYear" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.initVerificationDefaults();
        isFormRendered = true;
    }

    // 8. ANNEXURE E
    else if (serviceName === 'annexuree') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-file-contract text-royal-500 mr-1.5"></i> Annexure E (Adults Urf/Alias Removal)</h3>
                    <p class="text-[11px] text-slate-500">वयस्कों के नाम में से "उर्फ़ / Alias" हटाने हेतु शपथ पत्र।</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('annexuree')}
                <form id="annexureEForm" onsubmit="window.submitLocalAnnexureForm(event, 'Annexure E', 'LOCAL_HTML_ANNEXURE_E')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label><select id="inpTitle" name="title" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="Shri">Shri</option><option value="Smt.">Smt.</option><option value="Ms.">Ms.</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">आवेदक का नाम (Applicant)</label><input type="text" id="inpApplicantName" name="applicantName" oninput="window.syncAnnexureENames()" placeholder="e.g. RAMESH URF SONU" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select id="inpRel" name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="D/o">D/o</option><option value="W/o">W/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पिता / पति का नाम</label><input type="text" id="inpRelativeName" name="relativeName" placeholder="e.g. SURESH CHAND" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Resident of)</label><input type="text" id="inpAddress" name="address" placeholder="e.g. VILL BARAUT, DISTT BAGHPAT" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">12-Digit ID Number (4-4 Pair)</label>
                            <input type="text" id="inpIdNumber" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
                        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 relative z-10">
                            <div class="flex justify-between items-center">
                                <span class="text-[11px] font-black text-amber-900 uppercase">2. कार्ड में दर्ज दोनों नाम (Urf / Alias)</span>
                                <button type="button" onclick="window.swapAnnexureERetainRemove()" class="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded relative z-10"><i class="fa-solid fa-right-left mr-1"></i> Swap</button>
                            </div>
                            <div class="grid grid-cols-2 gap-2 relative z-10">
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">पहला नाम (Name 1)</label><input type="text" id="inpRecorded1" name="recorded1" oninput="window.syncAnnexureENames()" placeholder="RAMESH" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">उर्फ़ नाम (Alias 2)</label><input type="text" id="inpRecorded2" name="recorded2" oninput="window.syncAnnexureENames()" placeholder="SONU" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                            </div>
                        </div>

                        <div class="p-3 bg-green-50 rounded-2xl border border-green-200 space-y-2 relative z-10">
                            <span class="text-[11px] font-black text-green-900 uppercase block">3. कौन-सा नाम रखना है और कौन-सा हटाना है</span>
                            <div class="grid grid-cols-2 gap-2 relative z-10">
                                <div><label class="block text-[10px] font-bold text-green-800 uppercase mb-1">रखने वाला (Retain)</label><input type="text" id="inpRetainName" name="retainName" placeholder="RAMESH" required class="w-full p-2.5 border border-green-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                                <div><label class="block text-[10px] font-bold text-red-700 uppercase mb-1">हटाने वाला (Remove)</label><input type="text" id="inpRemoveName" name="removeName" placeholder="SONU" required class="w-full p-2.5 border border-red-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2.5 relative z-10">
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">स्थान (Place)</label><input type="text" id="inpPlace" name="place" placeholder="BARAUT" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">दिन (Day)</label><input type="text" id="inpDay" name="day" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">महीना व वर्ष</label><input type="text" id="inpMonthYear" name="monthYear" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 relative z-10"></div>
                    </div>

                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.initVerificationDefaults();
        isFormRendered = true;
    }

    // 9. ANNEXURE F
    else if (serviceName === 'annexuref') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-child-reaching text-royal-500 mr-1.5"></i> Annexure F (Children Urf/Alias Removal)</h3>
                    <p class="text-[11px] text-slate-500">बच्चे के नाम में से "उर्फ़ / Alias" हटाने हेतु शपथ पत्र।</p>
                </div>
                ${statusTagHtml}
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('annexuref')}
                <form onsubmit="window.submitLocalAnnexureForm(event, 'Annexure F', 'LOCAL_HTML_ANNEXURE_F')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label><select name="title" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="Shri">Shri</option><option value="Smt.">Smt.</option><option value="Ms.">Ms.</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का नाम (Parent)</label><input type="text" name="parentName" placeholder="e.g. SURESH KUMAR" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10"></div>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Relation</label><select name="rel" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="S/o">S/o</option><option value="W/o">W/o</option><option value="D/o">D/o</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">दादा / पति का नाम</label><input type="text" name="relativeName" placeholder="e.g. RAMPHAL" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का 12-Digit ID Number</label>
                            <input type="text" name="parentIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-amber-50 relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Resident of)</label><input type="text" name="address" placeholder="VILL BARAUT, DISTT BAGHPAT" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का नाम (Child Name)</label><input type="text" id="inpApplicantName" name="childName" oninput="window.syncAnnexureENames()" placeholder="e.g. AARAV URF GOLU" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold uppercase bg-indigo-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label>
                            <input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" title="कृपया पूरे 12 अंक दर्ज करें (XXXX XXXX XXXX)" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
                        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 relative z-10">
                            <div class="flex justify-between items-center">
                                <span class="text-[11px] font-black text-amber-900 uppercase">2. बच्चे के दर्ज दोनों नाम (Urf / Alias)</span>
                                <button type="button" onclick="window.swapAnnexureERetainRemove()" class="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded relative z-10"><i class="fa-solid fa-right-left mr-1"></i> Swap</button>
                            </div>
                            <div class="grid grid-cols-2 gap-2 relative z-10">
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">पहला नाम (Name 1)</label><input type="text" id="inpRecorded1" name="recorded1" oninput="window.syncAnnexureENames()" placeholder="AARAV" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">उर्फ़ नाम (Alias 2)</label><input type="text" id="inpRecorded2" name="recorded2" oninput="window.syncAnnexureENames()" placeholder="GOLU" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                            </div>
                        </div>

                        <div class="p-3 bg-green-50 rounded-2xl border border-green-200 space-y-2 relative z-10">
                            <span class="text-[11px] font-black text-green-900 uppercase block">3. कौन-सा नाम रखना है और कौन-सा हटाना है</span>
                            <div class="grid grid-cols-2 gap-2 relative z-10">
                                <div><label class="block text-[10px] font-bold text-green-800 uppercase mb-1">रखने वाला (Retain)</label><input type="text" id="inpRetainName" name="retainName" placeholder="AARAV" required class="w-full p-2.5 border border-green-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                                <div><label class="block text-[10px] font-bold text-red-700 uppercase mb-1">हटाने वाला (Remove)</label><input type="text" id="inpRemoveName" name="removeName" placeholder="GOLU" required class="w-full p-2.5 border border-red-300 rounded-xl text-xs font-bold uppercase bg-white relative z-10"></div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2.5 relative z-10">
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">स्थान (Place)</label><input type="text" id="inpPlace" name="place" placeholder="BARAUT" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">दिन (Day)</label><input type="text" id="inpDay" name="day" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">महीना व वर्ष</label><input type="text" id="inpMonthYear" name="monthYear" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 relative z-10"></div>
                    </div>

                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.initVerificationDefaults();
        isFormRendered = true;
    }

    // === ATTACH SESSION STORAGE LOGIC ===
    if (isFormRendered) {
        setTimeout(() => {
            window.restoreFormDataFromSession(serviceName);
            const form = container.querySelector('form');
            if (form) {
                form.addEventListener('input', () => window.saveFormDataToSession(serviceName));
                form.addEventListener('change', () => window.saveFormDataToSession(serviceName));
            }
        }, 50);
        return true;
    }

    return false;
};
