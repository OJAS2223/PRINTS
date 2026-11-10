// ============================================================================
// FILE: js/pdf-engine.js
// (Template Loader, Auto m.png Stamp, Caste/Domicile/e-Voter Processor & 3x HD PDF Generator)
// ============================================================================

import "./config.js?v=9.0";

window.TEMPLATE_FILES_MAP = {
    'LOCAL_HTML_CASTE': 'caste.html',
    'LOCAL_HTML_DOMICILE': 'domicile.html',
    'LOCAL_HTML_EVOTER': 'evoter.html',
    'LOCAL_HTML_DOB_DELHI': 'dob-delhi.html',
    'LOCAL_HTML_GAZETTE': 'gazette.html',
    'LOCAL_HTML_DOB_PRINT': 'dob-print.html',
    'LOCAL_HTML_ANNEXURE_1': 'annexure-1.html',
    'LOCAL_HTML_ANNEXURE_1A': 'annexure-1a.html',
    'LOCAL_HTML_ANNEXURE_3': 'annexure-3.html',
    'LOCAL_HTML_ANNEXURE_3A': 'annexure-3a.html',
    'LOCAL_HTML_ANNEXURE_B': 'annexure-b.html',
    'LOCAL_HTML_ANNEXURE_C': 'annexure-c.html',
    'LOCAL_HTML_ANNEXURE_D': 'annexure-d.html',
    'LOCAL_HTML_ANNEXURE_E': 'annexure-e.html',
    'LOCAL_HTML_ANNEXURE_F': 'annexure-f.html'
};

window.loadedTemplatesCache = {};
window.preloadAllHtmlTemplates = async function() {
    const entries = Object.entries(window.TEMPLATE_FILES_MAP);
    await Promise.all(entries.map(async ([fileId, fileName]) => {
        if (window.loadedTemplatesCache[fileId]) return;
        const candidatePaths = [
            `/templates/${fileName}?v=9.0`,
            `templates/${fileName}?v=9.0`,
            `../templates/${fileName}?v=9.0`
        ];
        for (const p of candidatePaths) {
            try {
                const r = await fetch(p);
                if (r.ok) {
                    let text = await r.text();
                    const match = text.match(/<div class="affidavit-paper"[\s\S]*<\/div>/i);
                    if (match) text = match[0];
                    window.loadedTemplatesCache[fileId] = text;
                    break;
                }
            } catch (e) {}
        }
    }));
};
window.preloadAllHtmlTemplates();

// ================= AUTOMATIC m.png STAMP ENGINE FOR CASTE & DOMICILE =================
window.autoMStampDataUrl = '';
window.preloadAutoMStamp = function() {
    if (window.autoMStampDataUrl) return Promise.resolve(window.autoMStampDataUrl);
    const candidates = ['/images/m.png', 'images/m.png', '/m.png', 'm.png'];
    return new Promise((resolve) => {
        let idx = 0;
        const tryNext = () => {
            if (idx >= candidates.length) {
                resolve('/images/m.png');
                return;
            }
            const src = candidates[idx++];
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (!img.naturalWidth) return tryNext();
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth || 794;
                    canvas.height = img.naturalHeight || 1122;
                    ctx.drawImage(img, 0, 0);
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) {
                            d[i + 3] = 0;
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    window.autoMStampDataUrl = canvas.toDataURL('image/png');
                    resolve(window.autoMStampDataUrl);
                } catch (e) {
                    window.autoMStampDataUrl = src;
                    resolve(src);
                }
            };
            img.onerror = tryNext;
            img.src = src;
        };
        tryNext();
    });
};
window.preloadAutoMStamp();

window.openSavedPhotoPreview = function(photoSrc, personName = 'Applicant') {
    if (!photoSrc) return;
    const a = document.createElement('a');
    a.href = photoSrc;
    a.download = `${(personName || 'Applicant').replace(/\s+/g, '_')}_Photo.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

window.processCasteOrDomicileData = function(rawFormObj, serviceType) {
    const toTitleCase = str => str ? str.toString().trim().split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ') : '';
    const isCaste = (serviceType === 'Caste');

    const processed = {
        SERVICE_TYPE: serviceType,
        DISTRICT: (rawFormObj.DISTRICT || '').toString().trim(),
        TAHSEEL: (rawFormObj.TAHSEEL || '').toString().trim(),
        NAME: toTitleCase(rawFormObj.NAME),
        FNAME: toTitleCase(rawFormObj.FNAME),
        MNAME: toTitleCase(rawFormObj.MNAME),
        AREA: (rawFormObj.AREA || '').toString().trim() ? toTitleCase(rawFormObj.AREA) : '',
        GRAM: toTitleCase(rawFormObj.GRAM),
        HNAME: (rawFormObj.HNAME || '').toString().trim(),
        REL: rawFormObj.REL || 'पुत्र / पुत्री',
        MN: (rawFormObj.MN || '').toString().toUpperCase(),
        THANA: (rawFormObj.THANA || '').toString().trim().toUpperCase(),
        CAST: (rawFormObj.CAST || '').toString().trim().toUpperCase(),
        VLE: (rawFormObj.VLE || '').toString().trim().toUpperCase(),
        PHOTO: rawFormObj.PHOTO || ''
    };

    const rawTahseel = processed.TAHSEEL.toUpperCase();
    const rawDistrict = processed.DISTRICT.toUpperCase();
    const match = window.SDM_LOCATIONS_LIST.find(loc => loc.keys.some(k => rawTahseel.includes(k)))
               || window.SDM_LOCATIONS_LIST.find(loc => loc.keys.some(k => rawDistrict.includes(k)))
               || { t: 'बागपत', d: 'बागपत', o: 'RAKESH CHAUHAN' };

    processed.TEHSIL = match.t;
    processed.DISS = match.d;
    processed.SDM = processed.OFFICER = match.o;

    if (rawFormObj.ISSUE_DATE && rawFormObj.ISSUE_DATE.toString().trim()) {
        const rawDate = rawFormObj.ISSUE_DATE.toString().trim();
        if (rawDate.includes('-')) {
            const parts = rawDate.split('-');
            processed.DATE = (parts.length === 3 && parts[0].length === 4) ? `${parts[2]}/${parts[1]}/${parts[0]}` : rawDate;
        } else {
            processed.DATE = rawDate;
        }
    } else {
        const now = new Date();
        processed.DATE = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
    }
    processed.ISSUE_DATE = processed.DATE;

    const appRandomPart = Math.floor(Math.random() * 49999) + 10000;
    if (isCaste) {
        processed.RN = rawFormObj.RN || ('2613900200' + appRandomPart);
        processed.AM = rawFormObj.AM || ('812620' + (appRandomPart + 2830));
    } else {
        processed.RN = rawFormObj.RN || ('2613900100' + appRandomPart);
        processed.AM = rawFormObj.AM || ('811620' + (appRandomPart + 2830));
    }

    const displayName = processed.HNAME ? `${processed.NAME} / ${processed.HNAME}` : processed.NAME;
    processed.DISPLAY_NAME = displayName.length > 28 ? processed.NAME : displayName;

    const qrDataText = isCaste
        ? `आवेदन क्र० - ${processed.RN}, प्रमाणपत्र क्र० - 0${processed.AM}, नाम - ${processed.DISPLAY_NAME} , जाति - ${processed.CAST}, तहसील - ${processed.TEHSIL}, जिला - ${processed.DISS}, ${processed.SDM}`
        : `आवेदन क्र० - ${processed.RN}, प्रमाणपत्र क्र० - 0${processed.AM}, नाम - ${processed.DISPLAY_NAME} , तहसील - ${processed.TEHSIL}, जिला - ${processed.DISS}, ${processed.SDM}`;

    processed.QR_URL = "https://quickchart.io/chart?cht=qr&chs=300x300&chl=" + encodeURIComponent(qrDataText);
    return processed;
};

// ================= MCD DOB DELHI (BIRTH.HTML) PROCESSOR & LIVE SYNC =================
window.generateMcdRegNo = function() {
    const rand7 = Math.floor(1000000 + Math.random() * 9000000);
    return `MCDOLIR-2219-00${rand7}`;
};

window.processDobDelhiData = function(rawFormObj, docId = '') {
    const regNo = (rawFormObj.REG_NO || '').toString().trim().toUpperCase() || window.generateMcdRegNo();
    const name = (rawFormObj.NAME || '').toString().trim().toUpperCase();
    const sex = (rawFormObj.SEX || 'MALE').toString().trim().toUpperCase();
    const fname = (rawFormObj.FNAME || '').toString().trim().toUpperCase();
    const mname = (rawFormObj.MNAME || '').toString().trim().toUpperCase();
    const zone = (rawFormObj.ZONE || 'CITY S.P. ZONE').toString().trim().toUpperCase();

    const formatToDMY = (dStr) => {
        if (!dStr) return '';
        const s = String(dStr).trim();
        if (s.includes('-')) {
            const p = s.split('-');
            if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return s;
    };

    const now = new Date();
    const todayDMY = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
    const dob = formatToDMY(rawFormObj.DOB) || todayDMY;
    const dor = formatToDMY(rawFormObj.DOR) || dob;
    const doi = formatToDMY(rawFormObj.DOI) || todayDMY;

    const presAddr = (rawFormObj.PRES_ADDR || rawFormObj.ADDRESS || '').toString().trim().toUpperCase();
    const permAddr = (rawFormObj.PERM_ADDR || presAddr).toString().trim().toUpperCase();
    const pob = (rawFormObj.POB === 'SAME_AS_ADDR' || !rawFormObj.POB)
        ? presAddr
        : (rawFormObj.POB === 'OTHER' && rawFormObj.POB_CUSTOM ? rawFormObj.POB_CUSTOM.trim().toUpperCase() : rawFormObj.POB.toString().trim().toUpperCase());

    const finalDocId = (docId || rawFormObj.DOC_ID || '').toString().trim();
    const baseUrl = (window.DOB_DELHI_VERIFY_BASE_URL || "https://www.mcdgov.online").replace(/\/+$/, '');
    const verifyUrl = finalDocId
        ? `${baseUrl}/verify/${encodeURIComponent(finalDocId)}`
        : `${baseUrl}/verify/${encodeURIComponent(regNo)}`;
    const customQr = (rawFormObj.CUSTOM_QR || '').toString().trim();

    // Multi-line QR text payload with transparent background
    const qrTextPayload = customQr || 
`Name Of The Child - ${name}
Registration No - ${regNo}
Registration Date - ${dor}
DOB. - ${dob}
Father Name: ${fname}
Verified URL: ${verifyUrl}`;

    const qrUrl = "https://quickchart.io/chart?cht=qr&chs=340x340&margin=0&dark=000000&bgcolor=transparent&light=ffffff00&chl=" + encodeURIComponent(qrTextPayload);

    return {
        SERVICE_TYPE: 'DOB Delhi',
        DOC_ID: finalDocId,
        VERIFY_URL: verifyUrl,
        REG_NO: regNo,
        ZONE: zone,
        NAME: name,
        SEX: sex,
        DOB: dob,
        POB: pob,
        DOR: dor,
        MNAME: mname,
        FNAME: fname,
        PRES_ADDR: presAddr,
        PERM_ADDR: permAddr,
        ADDRESS: presAddr,
        DOI: doi,
        CUSTOM_QR: customQr,
        QR_URL: qrUrl
    };
};

window.syncMcdPreviewFields = function(sourceType, newVal) {
    const container = document.getElementById('htmlDocPreviewContainer');
    if (!container) return;
    const topReg = container.querySelector('#valTopRegNo');
    const botReg = container.querySelector('#valRegNo');
    const presEl = container.querySelector('#valPresAddr');
    const permEl = container.querySelector('#valPermAddr');

    if (sourceType === 'topReg' && botReg && botReg.innerText.trim() !== String(newVal || '').trim()) {
        botReg.innerText = String(newVal || '').trim();
    } else if (sourceType === 'botReg' && topReg && topReg.innerText.trim() !== String(newVal || '').trim()) {
        topReg.innerText = String(newVal || '').trim();
    } else if (sourceType === 'presAddr' && permEl && permEl.innerText !== newVal) {
        permEl.innerText = newVal;
    } else if (sourceType === 'permAddr' && presEl && presEl.innerText !== newVal) {
        presEl.innerText = newVal;
    }

    const regNo = (botReg?.innerText || topReg?.innerText || '').trim();
    const name = (container.querySelector('#valName')?.innerText || '').trim();
    const sex = (container.querySelector('#valGender')?.innerText || '').trim();
    const dob = (container.querySelector('#valDob')?.innerText || '').trim();
    const pob = (container.querySelector('#valPob')?.innerText || '').replace(/\s+/g, ' ').trim();
    const dor = (container.querySelector('#valDor')?.innerText || '').trim();
    const mname = (container.querySelector('#valMother')?.innerText || '').trim();
    const fname = (container.querySelector('#valFather')?.innerText || '').trim();
    const presAddr = (presEl?.innerText || '').trim();
    const permAddr = (permEl?.innerText || '').trim();
    const doi = (container.querySelector('#valDoi')?.innerText || '').trim();

    const ctxForQr = window.currentModalContext;
    const recForQr = (ctxForQr && ctxForQr.historyIndex >= 0) ? ((window.historyData && window.historyData[ctxForQr.historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[ctxForQr.historyIndex])) : null;
    const docIdForQr = recForQr?.id || recForQr?.formData?.DOC_ID || '';
    const baseUrl = (window.DOB_DELHI_VERIFY_BASE_URL || "https://www.mcdgov.online").replace(/\/+$/, '');
    const verifyUrl = docIdForQr ? `${baseUrl}/verify/${encodeURIComponent(docIdForQr)}` : `${baseUrl}/verify/${encodeURIComponent(regNo)}`;
    
    const qrTextPayload = 
`Name Of The Child - ${name}
Registration No - ${regNo}
Registration Date - ${dor}
DOB. - ${dob}
Father Name: ${fname}
Verified URL: ${verifyUrl}`;

    const qrUrl = "https://quickchart.io/chart?cht=qr&chs=340x340&margin=0&dark=000000&bgcolor=transparent&light=ffffff00&chl=" + encodeURIComponent(qrTextPayload);

    const qrImg = container.querySelector('#qrCodeImg');
    if (qrImg) qrImg.src = qrUrl;

    const ctx = window.currentModalContext;
    if (ctx && ctx.historyIndex >= 0) {
        const rec = (window.historyData && window.historyData[ctx.historyIndex]) || (window.adminAllHistoryData && window.adminAllHistoryData[ctx.historyIndex]);
        if (rec && rec.formData) {
            Object.assign(rec.formData, {
                REG_NO: regNo, NAME: name, SEX: sex, DOB: dob, POB: pob,
                DOR: dor, MNAME: mname, FNAME: fname, PRES_ADDR: presAddr,
                PERM_ADDR: permAddr, DOI: doi, QR_URL: qrUrl
            });
        }
    }
};

// ================= GAZETTE NOTIFICATION (₹100) & DOB PRINT (₹140) PROCESSORS =================
window.generateGazetteNo = function() {
    const year = new Date().getFullYear();
    const rand5 = Math.floor(10000 + Math.random() * 90000);
    return `CG-DL-W-${year}-${rand5}`;
};

window.processGazetteData = function(rawFormObj = {}) {
    const oldName = (rawFormObj.OLD_NAME || 'SUBRATA DAS').toString().trim().toUpperCase();
    const newName = (rawFormObj.NEW_NAME || rawFormObj.NAME || 'DREYVAN DAYSE').toString().trim().toUpperCase();
    const fname = (rawFormObj.FNAME || 'Late RADHA RAMAN DAS').toString().trim();
    const address = (rawFormObj.ADDRESS || '2/10, Field Marshal Cariappa Colony, Opp. Manipal Center, Cubbon Road, Bangalore-560001').toString().trim();
    const profession = (rawFormObj.PROFESSION || 'employed in the Indian Navy').toString().trim();

    const relCode = (rawFormObj.REL_TYPE || 'S/O').toString().trim().toUpperCase();
    const relWordEn = relCode === 'D/O' ? 'daughter of' : (relCode === 'W/O' ? 'wife of' : 'son of');
    const isMinor = (rawFormObj.APPLICANT_TYPE === 'MINOR');
    const minorAge = (rawFormObj.MINOR_AGE || '4').toString().trim();
    const minorRel = (rawFormObj.MINOR_REL || 'son').toString().trim().toLowerCase();
    const pronoun = minorRel === 'daughter' ? 'she' : 'he';

    // Default to exact 157413.pdf date/issue if not custom-selected
    let issueNo = (rawFormObj.ISSUE_NO || '52').toString().trim();
    let dateLineEn = 'NEW DELHI, SATURDAY, DECEMBER 28, 2013—JANUARY 3, 2014 (PAUSA 7, 1935)';
    let dateLineHi = 'नई दिल्ली, शनिवार, दिसम्बर 28, 2013 - जनवरी 3, 2014 (पौष 7, 1935)';
    let giCode = rawFormObj.GI_CODE || '1-390 GI/2013';
    let pageNo = rawFormObj.PAGE_NO || '1235';

    if (rawFormObj.ISSUE_DATE && rawFormObj.ISSUE_DATE.toString().trim()) {
        const d = new Date(rawFormObj.ISSUE_DATE);
        if (!isNaN(d.getTime())) {
            const endD = new Date(d.getTime() + 6 * 86400000);
            const monthsEn = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
            const monthsHi = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितम्बर','अक्टूबर','नवम्बर','दिसम्बर'];
            const m1 = d.getMonth(), m2 = endD.getMonth();
            const d1 = d.getDate(), d2 = endD.getDate();
            const y1 = d.getFullYear(), y2 = endD.getFullYear();
            const sakaYear = y1 - 78;
            dateLineEn = `NEW DELHI, SATURDAY, ${monthsEn[m1]} ${d1}${y1 !== y2 ? ', ' + y1 : ''}—${monthsEn[m2]} ${d2}, ${y2} (PAUSA 7, ${sakaYear})`;
            dateLineHi = `नई दिल्ली, शनिवार, ${monthsHi[m1]} ${d1}${y1 !== y2 ? ', ' + y1 : ''} - ${monthsHi[m2]} ${d2}, ${y2} (पौष 7, ${sakaYear})`;
            giCode = `1-390 GI/${y1}`;
        }
    }

    let englishParagraph = '';
    let signNameEn = oldName;
    let signCaptionEn = '[Signature (in existing old name)]';

    if (isMinor) {
        const guardianName = (rawFormObj.GUARDIAN_NAME || fname).toString().trim().toUpperCase();
        const guardianFather = (rawFormObj.GUARDIAN_FATHER || '').toString().trim().toUpperCase();
        englishParagraph = `I, ${guardianName}${guardianFather ? ' ' + relWordEn + ' ' + guardianFather : ''}, residing at ${address}, have changed the name of my minor ${minorRel} ${oldName}, aged ${minorAge} years and ${pronoun} shall hereafter be known as ${newName}.`;
        signNameEn = guardianName;
        signCaptionEn = '[Signature of Guardian]';
    } else {
        englishParagraph = `I, hitherto known as ${oldName} ${relWordEn} ${fname}${profession ? ', ' + profession : ''}, residing at ${address}, have changed my name and shall hereafter be known as ${newName}.`;
    }

    const hindiParagraph = rawFormObj.HINDI_NOTICE_PARAGRAPH ||
        `मैं अब तक प्रभास मिस्त्री पुत्र श्री राम सरूप शर्मा के नाम से जाना जाता हूँ। मैं राज मिस्त्री के पद पर नियुक्त हूँ। मैं एल-117, गली नं. 10, लक्ष्मन पुरी, पहाड़ गंज, नई दिल्ली-110055 पर रहता हूँ। मैंने अपना नाम बदल लिया है और इसके बाद प्रभाकर शर्मा से जाना जाऊँगा।`;
    const hindiSignName = rawFormObj.HINDI_SIGN_NAME || 'प्रभास मिस्त्री';

    return {
        SERVICE_TYPE: 'Gazette Notification',
        NAME: newName,
        OLD_NAME: oldName,
        NEW_NAME: newName,
        ISSUE_NO: issueNo,
        DATE_LINE_EN: dateLineEn,
        DATE_LINE_HI: dateLineHi,
        HINDI_NOTICE_PARAGRAPH: hindiParagraph,
        HINDI_SIGN_NAME: hindiSignName,
        ENGLISH_NOTICE_PARAGRAPH: englishParagraph,
        SIGN_NAME_EN: signNameEn,
        SIGN_CAPTION_EN: signCaptionEn,
        GI_CODE: giCode,
        PAGE_NO: pageNo
    };
};

window.generateDobPrintBrn = function() {
    const year = new Date().getFullYear();
    const rand8 = Math.floor(10000000 + Math.random() * 90000000);
    return `B-${year}: 9-${rand8}`;
};

window.processDobPrintData = function(rawFormObj) {
    const formatToDMY = (dStr) => {
        if (!dStr) return '';
        const s = String(dStr).trim();
        if (s.includes('-')) {
            const p = s.split('-');
            if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
        }
        return s;
    };
    const now = new Date();
    const todayDMY = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;

    const brnNo = (rawFormObj.BRN_NO || '').toString().trim().toUpperCase() || window.generateDobPrintBrn();
    const name = (rawFormObj.NAME || '').toString().trim().toUpperCase();
    const sex = (rawFormObj.SEX || 'MALE / पुरुष').toString().trim().toUpperCase();
    const dob = formatToDMY(rawFormObj.DOB) || todayDMY;
    const dobWords = (rawFormObj.DOB_WORDS || dob).toString().trim().toUpperCase();
    const pob = (rawFormObj.POB || 'HOSPITAL / घर').toString().trim().toUpperCase();
    const mname = (rawFormObj.MNAME || '').toString().trim().toUpperCase();
    const fname = (rawFormObj.FNAME || '').toString().trim().toUpperCase();

    const cleanMA = (rawFormObj.MA || '').toString().replace(/\D/g, '').slice(-4);
    const maFormatted = cleanMA.length === 4 ? `XXXXXXXX${cleanMA}` : 'NA';
    const cleanFA = (rawFormObj.FA || '').toString().replace(/\D/g, '').slice(-4);
    const faFormatted = cleanFA.length === 4 ? `XXXXXXXX${cleanFA}` : 'NA';

    const address = (rawFormObj.ADDRESS || '').toString().trim().toUpperCase();
    const permAddress = (rawFormObj.PERM_ADDRESS || address).toString().trim().toUpperCase();
    const regDate = formatToDMY(rawFormObj.REG_DATE) || dob;
    const issueDate = formatToDMY(rawFormObj.ISSUE_DATE) || todayDMY;
    const hospitalUnit = (rawFormObj.PB === 'OTHER' && rawFormObj.PB_CUSTOM ? rawFormObj.PB_CUSTOM : (rawFormObj.HOSPITAL_UNIT || rawFormObj.PB || 'CHC BARAUT, BAGHPAT')).toString().trim().toUpperCase();
    const tehsil = (rawFormObj.TAHSEEL || 'BARAUT').toString().trim().toUpperCase();
    const district = (rawFormObj.DISTRICT || 'BAGHPAT').toString().trim().toUpperCase();
    const stateName = (rawFormObj.STATE_NAME || 'UTTAR PRADESH').toString().trim().toUpperCase();
    const remarks = (rawFormObj.REMARKS || 'NONE').toString().trim().toUpperCase();

    const qrText = `CRS BIRTH CERTIFICATE | Reg No: ${brnNo} | Name: ${name} | Sex: ${sex} | DOB: ${dob} | Mother: ${mname} | Father: ${fname} | Unit: ${hospitalUnit}`;
    const qrUrl = "https://quickchart.io/chart?cht=qr&chs=300x300&chl=" + encodeURIComponent(qrText);

    return {
        SERVICE_TYPE: 'DOB Print',
        BRN_NO: brnNo,
        NAME: name,
        SEX: sex,
        DOB: dob,
        DOB_WORDS: dobWords,
        POB: pob,
        MNAME: mname,
        FNAME: fname,
        MA: maFormatted,
        FA: faFormatted,
        ADDRESS: address,
        PERM_ADDRESS: permAddress,
        REG_DATE: regDate,
        ISSUE_DATE: issueDate,
        HOSPITAL_UNIT: hospitalUnit,
        PB: hospitalUnit,
        TAHSEEL: tehsil,
        TEHSIL: tehsil,
        DISTRICT: district,
        STATE_NAME: stateName,
        STATE_GOVT_HI: 'उत्तर प्रदेश सरकार',
        STATE_GOVT_EN: 'GOVERNMENT OF UTTAR PRADESH',
        REMARKS: remarks,
        QR_URL: qrUrl
    };
};

// ================= e-VOTER ID PROCESSOR =================
window.generateRandomEpicNo = function() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const prefix = letters.charAt(Math.floor(Math.random()*letters.length)) + letters.charAt(Math.floor(Math.random()*letters.length)) + letters.charAt(Math.floor(Math.random()*letters.length));
    const digits = Math.floor(1000000 + Math.random() * 9000000);
    return prefix + digits;
};

window.processEvoterData = function(rawFormObj) {
    const toTitleCase = str => str ? str.toString().trim().split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ') : '';
    const epicRaw = (rawFormObj.EPIC_NO || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const epicNo = epicRaw.length >= 6 ? epicRaw : window.generateRandomEpicNo();

    const nameClean = toTitleCase(rawFormObj.NAME || '');
    const hnameClean = (rawFormObj.HNAME || '').toString().trim();
    const displayName = hnameClean ? `${nameClean} / ${hnameClean}` : nameClean;

    const rawTahseel = (rawFormObj.TAHSEEL || '').toString().toUpperCase();
    const rawDistrict = (rawFormObj.DISTRICT || '').toString().toUpperCase();
    const match = window.SDM_LOCATIONS_LIST.find(loc => loc.keys.some(k => rawTahseel.includes(k)))
               || window.SDM_LOCATIONS_LIST.find(loc => loc.keys.some(k => rawDistrict.includes(k)))
               || { t: 'बड़ौत', d: 'बागपत', o: 'BAL KRISHNA SINGH' };

    let dobFormatted = (rawFormObj.DOB || '').toString().trim();
    if (dobFormatted.includes('-')) {
        const p = dobFormatted.split('-');
        if (p.length === 3 && p[0].length === 4) dobFormatted = `${p[2]}/${p[1]}/${p[0]}`;
    }

    const now = new Date();
    const issueDate = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
    const relLabel = (rawFormObj.REL_TYPE === 'W/O') ? 'पति का नाम / Husband Name' : 'पिता का नाम / Father Name';

    const processed = {
        SERVICE_TYPE: 'e-Voter ID',
        EPIC_NO: epicNo,
        NAME: nameClean,
        HNAME: hnameClean,
        DISPLAY_NAME: displayName,
        REL_TYPE: rawFormObj.REL_TYPE || 'S/O',
        REL_LABEL: relLabel,
        FNAME: toTitleCase(rawFormObj.FNAME || ''),
        DOB: dobFormatted,
        SEX: rawFormObj.SEX || 'MALE / पुरुष',
        DISTRICT: rawFormObj.DISTRICT || 'BAGHPAT',
        TAHSEEL: rawFormObj.TAHSEEL || match.t,
        TEHSIL: match.t,
        DISS: match.d,
        SDM: match.o,
        ADDRESS: (rawFormObj.ADDRESS || '').toString().trim().toUpperCase(),
        DATE: issueDate,
        PHOTO: rawFormObj.PHOTO || ''
    };

    const qrText = `e-EPIC: ${processed.EPIC_NO} | Name: ${processed.NAME} | Father/Husband: ${processed.FNAME} | DOB: ${processed.DOB} | Gender: ${processed.SEX} | AC/Tehsil: ${processed.TEHSIL}, ${processed.DISS}`;
    processed.QR_URL = "https://quickchart.io/chart?cht=qr&chs=300x300&chl=" + encodeURIComponent(qrText);
    return processed;
};

window.userStampCache = {};
window.getTransparentStampDataUrl = function(fileName = 'stamp.png') {
    const cleanName = (fileName.startsWith('/images/') || fileName.startsWith('images/') || fileName.startsWith('data:')) ? fileName : '/images/' + fileName;
    if (window.userStampCache[cleanName]) return Promise.resolve(window.userStampCache[cleanName]);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth || 794; canvas.height = img.naturalHeight || 1122;
                ctx.drawImage(img, 0, 0); const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) { if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) { data[i + 3] = 0; } }
                ctx.putImageData(imgData, 0, 0); const url = canvas.toDataURL('image/png'); window.userStampCache[cleanName] = url; resolve(url);
            } catch (e) { resolve(cleanName); }
        };
        img.onerror = () => resolve(cleanName);
        img.src = cleanName;
    });
};

window.buildLocalAffidavitHtml = function(fileId, d = {}, withShadow = true, withStamp = false, stampSrc = '') {
    const shadowClass = withShadow ? 'shadow-2xl' : '';
    const isCasteOrDomicile = (fileId === 'LOCAL_HTML_CASTE' || fileId === 'LOCAL_HTML_DOMICILE');

    let effectiveWithStamp = withStamp;
    let finalStampSrc = stampSrc;

    if (isCasteOrDomicile) {
        effectiveWithStamp = true; // ALWAYS AUTOMATICALLY STAMPED WITH m.png
        finalStampSrc = window.autoMStampDataUrl || '/images/m.png';
    } else if (effectiveWithStamp && !finalStampSrc) {
        finalStampSrc = (typeof window.pickRandomAvailableStamp === 'function' ? window.pickRandomAvailableStamp() : '/images/stamp.png');
    }

    const stampOverlayHtml = (effectiveWithStamp && finalStampSrc) ? `
        <div class="stamp-overlay-layer">
            <img src="${finalStampSrc}" onerror="this.onerror=null;this.src='m.png';" />
        </div>
    ` : '';

    if (fileId === 'LOCAL_HTML_DOB_DELHI' && d && d.DOC_ID && !d.CUSTOM_QR) {
        const baseUrl = (window.DOB_DELHI_VERIFY_BASE_URL || "https://www.mcdgov.online").replace(/\/+$/, '');
        const verifyUrl = `${baseUrl}/verify/${encodeURIComponent(d.DOC_ID)}`;
        d.VERIFY_URL = verifyUrl;
        const qrTextPayload =
`Name Of The Child - ${d.NAME || ''}
Registration No - ${d.REG_NO || ''}
Registration Date - ${d.DOR || ''}
DOB. - ${d.DOB || ''}
Father Name: ${d.FNAME || ''}
Verified URL: ${verifyUrl}`;
        d.QR_URL = "https://quickchart.io/chart?cht=qr&chs=340x340&margin=0&dark=000000&bgcolor=transparent&light=ffffff00&chl=" + encodeURIComponent(qrTextPayload);
    }

    const rawTemplate = window.loadedTemplatesCache[fileId];
    if (rawTemplate) {
        let compiled = rawTemplate.replace('class="affidavit-paper', `class="affidavit-paper ${shadowClass}`);
        compiled = compiled.replace(/\{\{STAMP_OVERLAY\}\}/g, stampOverlayHtml);
        compiled = compiled.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key) => {
            return (d[key] !== undefined && d[key] !== null) ? d[key] : '';
        });
        return compiled;
    }

    return `<div class="affidavit-paper ${shadowClass}">${stampOverlayHtml}<div>Template loading... Please click Preview again.</div><div></div></div>`;
};

window.downloadHtmlDocAsPdf = async function(fileId, formDataObj, fileName, withStamp = false, stampSrc = '', certificateFileId = '') {
    const btn = document.getElementById('modalDownloadBtn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> HD PDF...'; btn.disabled = true; }

    await window.preloadAllHtmlTemplates();
    const isCasteOrDomicile = (fileId === 'LOCAL_HTML_CASTE' || fileId === 'LOCAL_HTML_DOMICILE');

    if (isCasteOrDomicile) {
        await window.preloadAutoMStamp();
        withStamp = true;
        stampSrc = window.autoMStampDataUrl || '/images/m.png';
    } else if (withStamp && typeof window.preloadAllAvailableStamps === 'function' && window.availableStampsList?.length === 0) {
        await window.preloadAllAvailableStamps();
    }

    const finalStampSrc = isCasteOrDomicile
        ? (window.autoMStampDataUrl || '/images/m.png')
        : (withStamp ? (stampSrc || (typeof window.pickRandomAvailableStamp === 'function' ? window.pickRandomAvailableStamp() : '/images/stamp.png')) : '');

    const savedScrollX = window.scrollX; const savedScrollY = window.scrollY; window.scrollTo(0, 0);

    const tempWrapper = document.createElement('div');
    tempWrapper.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1122px;margin:0;padding:0;z-index:-9999;background:#ffffff;overflow:hidden;';
    tempWrapper.innerHTML = window.buildLocalAffidavitHtml(fileId, formDataObj, false, withStamp, finalStampSrc);
    document.body.appendChild(tempWrapper);
    const targetEl = tempWrapper.querySelector('.affidavit-paper');

    await new Promise(r => setTimeout(r, 300));

    try {
        const finalPdfName = (!isCasteOrDomicile && withStamp) ? fileName.replace('.pdf', ' (With Stamp).pdf') : fileName;
        const opt = {
            margin: 0,
            filename: finalPdfName,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                x: 0, y: 0, scrollX: 0, scrollY: 0,
                width: 794, height: 1122, windowWidth: 794, windowHeight: 1122
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: false }
        };
        await html2pdf().set(opt).from(targetEl).save();
        
        if (certificateFileId) {
            setTimeout(() => {
                window.open(`https://drive.google.com/uc?export=download&id=${certificateFileId}`, '_blank');
            }, 800);
        }
    } catch (err) {
        alert("PDF डाउनलोड करने में समस्या आई।");
    } finally {
        document.body.removeChild(tempWrapper); window.scrollTo(savedScrollX, savedScrollY);
        if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }
    }
};

window.directPrintDocument = async function(fileId, formDataObj, fileName, withStamp = false, stampSrc = '', certificateFileId = '') {
    if (String(fileId).startsWith('LOCAL_HTML_')) {
        await window.preloadAllHtmlTemplates();
        const isCasteOrDomicile = (fileId === 'LOCAL_HTML_CASTE' || fileId === 'LOCAL_HTML_DOMICILE');

        if (isCasteOrDomicile) {
            await window.preloadAutoMStamp();
            withStamp = true;
            stampSrc = window.autoMStampDataUrl || '/images/m.png';
        } else if (withStamp && typeof window.preloadAllAvailableStamps === 'function' && window.availableStampsList?.length === 0) {
            await window.preloadAllAvailableStamps();
        }
        
        if (certificateFileId) {
            window.open(`https://drive.google.com/file/d/${certificateFileId}/view`, '_blank');
        }

        const finalStampSrc = isCasteOrDomicile
            ? (window.autoMStampDataUrl || '/images/m.png')
            : (withStamp ? (stampSrc || (typeof window.pickRandomAvailableStamp === 'function' ? window.pickRandomAvailableStamp() : '/images/stamp.png')) : '');

        const htmlContent = window.buildLocalAffidavitHtml(fileId, formDataObj, false, withStamp, finalStampSrc);
        let printFrame = document.getElementById('directPrintIframe');
        if (printFrame) document.body.removeChild(printFrame);

        printFrame = document.createElement('iframe'); printFrame.id = 'directPrintIframe';
        printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document; frameDoc.open();
        frameDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${fileName || 'Print Document'}</title>
                <style>
                    @page { size: A4; margin: 0; }
                    html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .affidavit-paper { position: relative !important; font-family: 'Times New Roman', Times, serif; width: 794px; height: 1122px; padding: 46px 62px; background: #ffffff; color: #000000; font-size: 15px; line-height: 1.55; box-sizing: border-box; display: block !important; margin: 0 !important; overflow: hidden; }
                    .affidavit-paper:not(.mcd-cert-paper) > div:last-child { position: absolute !important; bottom: 46px !important; left: 62px !important; right: 62px !important; }
                    .filled-val { font-weight: bold !important; color: #000000 !important; text-decoration: underline !important; text-underline-offset: 3px !important; }
                    .stamp-overlay-layer { position: absolute; top: 0; left: 0; width: 794px; height: 1122px; pointer-events: none; z-index: 30; mix-blend-mode: normal !important; overflow: hidden; }
                    .stamp-overlay-layer img { width: 794px; height: 1122px; object-fit: contain; object-position: top center; mix-blend-mode: normal !important; display: block; }
                </style>
            </head>
            <body>${htmlContent}</body>
            </html>
        `);
        frameDoc.close();
        setTimeout(() => { printFrame.contentWindow.focus(); printFrame.contentWindow.print(); }, 400);
    } else {
        window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
    }
};

window.shareHtmlDocAsPdf = async function(fileId, formDataObj, fileName, withStamp = false, stampSrc = '', certificateFileId = '') {
    const btn = document.getElementById('modalShareBtn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...'; btn.disabled = true; }

    await window.preloadAllHtmlTemplates();
    const isCasteOrDomicile = (fileId === 'LOCAL_HTML_CASTE' || fileId === 'LOCAL_HTML_DOMICILE');
    if (isCasteOrDomicile) {
        await window.preloadAutoMStamp();
        withStamp = true;
        stampSrc = window.autoMStampDataUrl || '/images/m.png';
    } else if (withStamp && typeof window.preloadAllAvailableStamps === 'function' && window.availableStampsList?.length === 0) {
        await window.preloadAllAvailableStamps();
    }
    const finalStampSrc = isCasteOrDomicile
        ? (window.autoMStampDataUrl || '/images/m.png')
        : (withStamp ? (stampSrc || (typeof window.pickRandomAvailableStamp === 'function' ? window.pickRandomAvailableStamp() : '/images/stamp.png')) : '');

    const savedScrollX = window.scrollX; const savedScrollY = window.scrollY; window.scrollTo(0, 0);

    const tempWrapper = document.createElement('div');
    tempWrapper.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1122px;margin:0;padding:0;z-index:-9999;background:#ffffff;overflow:hidden;';
    tempWrapper.innerHTML = window.buildLocalAffidavitHtml(fileId, formDataObj, false, withStamp, finalStampSrc);
    document.body.appendChild(tempWrapper);
    const targetEl = tempWrapper.querySelector('.affidavit-paper');

    await new Promise(r => setTimeout(r, 300));

    try {
        const finalFileName = (!isCasteOrDomicile && withStamp) ? fileName.replace('.pdf', ' (With Stamp).pdf') : fileName;
        const opt = {
            margin: 0,
            filename: finalFileName,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', x: 0, y: 0, scrollX: 0, scrollY: 0, width: 794, height: 1122 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: false }
        };
        const pdfBlob = await html2pdf().set(opt).from(targetEl).output('blob');
        const file = new File([pdfBlob], finalFileName, { type: 'application/pdf' });

        if (certificateFileId) {
            window.open(`https://drive.google.com/file/d/${certificateFileId}/view`, '_blank');
        }

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: finalFileName, text: 'Here is your generated document.' });
        } else {
            alert('Aapka browser direct file share support nahi karta. Kripya PDF download karke share karein.');
        }
    } catch (err) {
        alert("PDF share karne mein samasya aayi.");
    } finally {
        document.body.removeChild(tempWrapper); window.scrollTo(savedScrollX, savedScrollY);
        if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }
    }
};
