// ============================================================================
// FILE: js/config-templates.js (Modular Barrel Loader)
// Imports js/config.js and js/pdf-engine.js
// ============================================================================
import "./config.js?v=9.0";
import "./pdf-engine.js?v=9.0";
// ============================================================================
// FILE: js/config-templates.js (COMPLETE UPDATED VERSION)
// ============================================================================

import "./firebase-config.js";

// Template Files Mapping (Includes Gazette, Passport, DOB Delhi, e-Voter, Caste, Domicile & Annexures)
window.TEMPLATE_FILES_MAP = {
    'LOCAL_HTML_CASTE': '/templates/caste.html',
    'LOCAL_HTML_DOMICILE': '/templates/domicile.html',
    'LOCAL_HTML_EVOTER': '/templates/evoter.html',
    'LOCAL_HTML_DOB_DELHI': '/templates/dob-delhi.html',
    'LOCAL_HTML_GAZETTE': '/templates/gazette.html',
    'LOCAL_HTML_PASSPORT': '/templates/passport.html',
    'LOCAL_HTML_DOB_PRINT': '/templates/dob-print.html',
    'LOCAL_HTML_ANNEXURE_1': '/templates/annexure1.html',
    'LOCAL_HTML_ANNEXURE_1A': '/templates/annexure1a.html',
    'LOCAL_HTML_ANNEXURE_3': '/templates/annexure3.html',
    'LOCAL_HTML_ANNEXURE_3A': '/templates/annexure3a.html',
    'LOCAL_HTML_ANNEXURE_B': '/templates/annexureb.html',
    'LOCAL_HTML_ANNEXURE_C': '/templates/annexurec.html',
    'LOCAL_HTML_ANNEXURE_D': '/templates/annexured.html',
    'LOCAL_HTML_ANNEXURE_E': '/templates/annexuree.html',
    'LOCAL_HTML_ANNEXURE_F': '/templates/annexuref.html'
};

window.HTML_TEMPLATES = window.HTML_TEMPLATES || {};

window.preloadAllHtmlTemplates = async function() {
    const entries = Object.entries(window.TEMPLATE_FILES_MAP);
    await Promise.all(entries.map(async ([key, path]) => {
        if (!window.HTML_TEMPLATES[key]) {
            try {
                const res = await fetch(path + '?v=' + Date.now());
                if (res.ok) {
                    window.HTML_TEMPLATES[key] = await res.text();
                }
            } catch (err) {
                console.warn('Template preload warning:', key, err);
            }
        }
    }));
    return window.HTML_TEMPLATES;
};

// Random Indian Passport Number Generator (e.g. L4681234)
window.generateRandomPassportNo = function() {
    const letters = "JKLMNPRSTUVWXYZ";
    const firstChar = letters.charAt(Math.floor(Math.random() * letters.length));
    const sevenDigits = Math.floor(1000000 + Math.random() * 9000000);
    return `${firstChar}${sevenDigits}`;
};

// Random EPIC Number Generator
window.generateRandomEpicNo = function() {
    const prefixes = ["UPB", "UPL", "UPM", "DLN", "HRX"];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000000 + Math.random() * 9000000);
    return `${p}${num}`;
};

// Random MCD Delhi Registration Number Generator
window.generateMcdRegNo = function() {
    const rand9 = String(Math.floor(100000000 + Math.random() * 900000000));
    return `MCDOLIR-2219-${rand9}`;
};

// Random Gazette Serial Number Generator
window.generateGazetteNo = function(dateStr = '') {
    let dtPart = '24062021';
    if (dateStr && dateStr.includes('-')) {
        const p = dateStr.split('-');
        if (p.length === 3) dtPart = `${p[2]}${p[1]}${p[0]}`;
    }
    const rand6 = Math.floor(200000 + Math.random() * 99999);
    return `CG-DL-W-${dtPart}-${rand6}`;
};

// Service Credit Costs
window.getServiceCreditCost = function(serviceType = '') {
    const st = String(serviceType).trim().toLowerCase();
    if (st === 'dob print' || st === 'dob original pdf' || st === 'dob_print') return 140;
    if (st === 'gazette' || st === 'gazette notification') return 100;
    if (st === 'minor' || st === 'dob' || st === 'dob delhi' || st === 'dob minor' || st === 'dob_delhi') return 50;
    if (st === 'passport' || st === 'passport services') return 30;
    return 10;
};
