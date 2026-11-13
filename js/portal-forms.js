// ============================================================================
// FILE: js/portal-forms.js (Core Submission, Draft Persistence & Form Router)
// ============================================================================

import "./config-templates.js?v=9.1";
import "./portal-forms-services.js?v=9.1";
import "./portal-forms-annexures.js?v=9.1";

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
    if (finalPobInp) finalPobInp.value = inputEl.value.trim().toUpperCase();
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
    const ageTopBox = document.getElementById('gazetteChildAgeTopWrapper');
    const gInp = document.getElementById('inpGazetteGuardian');
    const aInp = document.getElementById('inpGazetteChildAge');
    const relSelect = document.getElementById('selGazetteRelType');
    const appTypeHidden = document.getElementById('inpGazetteApplicantTypeHidden');
    const childRelHidden = document.getElementById('inpGazetteChildRelHidden');
    const lblOld = document.getElementById('lblGazetteOldName');
    const lblNew = document.getElementById('lblGazetteNewName');
    const lblFather = document.getElementById('lblGazetteFatherName');

    if (val === 'MINOR_SON' || val === 'MINOR_DAUGHTER' || val === 'MINOR') {
        if (ageTopBox) ageTopBox.style.display = 'block';
        if (minorSec) minorSec.style.display = 'grid';
        if (gInp) gInp.required = true;
        if (aInp) aInp.required = true;
        if (appTypeHidden) appTypeHidden.value = 'MINOR';
        if (childRelHidden) childRelHidden.value = (val === 'MINOR_DAUGHTER') ? 'daughter' : 'son';
        if (relSelect) relSelect.value = (val === 'MINOR_DAUGHTER') ? 'daughter of' : 'son of';

        if (lblOld) lblOld.innerHTML = 'Child Old Name (बच्चे का पुराना नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblNew) lblNew.innerHTML = 'Child New Name (बच्चे का नया सही नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblFather) lblFather.innerHTML = 'Father / Husband Name (पिता का नाम - BOLD) <span class="text-red-500">*</span>';
    } else {
        if (ageTopBox) ageTopBox.style.display = 'none';
        if (minorSec) minorSec.style.display = 'none';
        if (gInp) { gInp.required = false; gInp.value = ''; }
        if (aInp) { aInp.required = false; aInp.value = ''; }
        if (appTypeHidden) appTypeHidden.value = 'ADULT';

        if (lblOld) lblOld.innerHTML = 'Old Name (पुराना नाम / गलत नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblNew) lblNew.innerHTML = 'New Name (नया सही नाम - BOLD) <span class="text-red-500">*</span>';
        if (lblFather) lblFather.innerHTML = 'Father / Husband Name (पिता / पति का नाम - BOLD) <span class="text-red-500">*</span>';
    }
};

window.saveFormDataToSession = function(serviceName) {
    const form = document.querySelector('#formContainer form');
    if (!form) return;
    const fd = new FormData(form);
    const dataObj = {};
    fd.forEach((val, key) => {
        if (key !== 'PHOTO' && typeof val === 'string') dataObj[key] = val;
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

        // === SECURE SERVER-SIDE BRN API EXECUTION FOR DOB ORIGINAL PDF (₹140) ===
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

        // === INSTANT LOCAL GENERATION (CASTE, DOMICILE, e-VOTER, DOB DELHI, GAZETTE, PASSPORT, DOB PRINT) ===
        const isPassport = (serviceType === 'Passport' || serviceType === 'Passport Services');
        if (serviceType === 'Caste' || serviceType === 'Domicile' || serviceType === 'e-Voter ID' || serviceType === 'DOB Delhi' || serviceType === 'DOB Minor' || serviceType === 'Gazette Notification' || serviceType === 'Gazette' || serviceType === 'DOB Print' || isPassport) {
            const preGenDocRef = isEditMode
                ? doc(db, "history", window.currentEditingAnnexure.docId)
                : doc(collection(db, "history"));
            const targetDocId = preGenDocRef.id;

            let processedData = {};
            let fileIdKey = '';
            if (serviceType === 'e-Voter ID') {
                processedData = window.processEvoterData(dataObj);
                fileIdKey = 'LOCAL_HTML_EVOTER';
            } else if (isPassport) {
                processedData = window.processPassportData(dataObj);
                fileIdKey = 'LOCAL_HTML_PASSPORT';
                serviceType = 'Passport';
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

        // === GOOGLE DRIVE SUBMISSION FOR MINOR ===
        let targetUrl = "";
        if (serviceType === 'Minor') targetUrl = window.API_URLS["minor"];

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

window.currentEditingAnnexure = null;

window.ANNEXURE_SERVICE_TO_TAB = {
    'Domicile': 'domicile', 'Caste': 'caste', 'e-Voter ID': 'evoter',
    'DOB Delhi': 'dob_delhi', 'DOB Minor': 'dob_delhi', 'Minor': 'minor', 'DOB': 'minor',
    'Passport': 'passport', 'Passport Services': 'passport', 'Gazette Notification': 'gazette',
    'Gazette': 'gazette', 'DOB Print': 'dob_print',
    'Annexure 1': 'annexure1', 'Annexure 1A': 'annexure1a', 'Annexure 3': 'annexure3',
    'Annexure 3A': 'annexure3a', 'Annexure B': 'annexureb', 'Annexure C': 'annexurec',
    'Annexure D': 'annexured', 'Annexure E': 'annexuree', 'Annexure F': 'annexuref'
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
                if (parts.length === 3 && parts[2].length === 4) isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (val.includes('-')) {
                const parts = val.split('-');
                if (parts.length === 3 && parts[2].length === 4) isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            input.value = isoDate;
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
    const { db, doc, updateDoc, collection, addDoc } = window.fb;

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

    if (formDataObj.oldDoc === 'OTHER' && formDataObj.oldDocCustom) formDataObj.oldDoc = formDataObj.oldDocCustom;
    if (formDataObj.newDoc === 'OTHER' && formDataObj.newDocCustom) formDataObj.newDoc = formDataObj.newDocCustom;
    if (formDataObj.invalidDocName === 'OTHER' && formDataObj.invalidDocNameCustom) formDataObj.invalidDocName = formDataObj.invalidDocNameCustom;

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
        'annexuref': { emoji: '🖍️', text: 'ANNEXURE F' }
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
    const isFormRendered =
        window.renderMainServiceFormHtml(serviceName, container, submitBtnText, statusTagHtml, getWatermarkHtml) ||
        window.renderAnnexureFormHtml(serviceName, container, submitBtnText, statusTagHtml, getWatermarkHtml);

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
