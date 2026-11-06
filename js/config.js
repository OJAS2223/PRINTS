// ============================================================================
// FILE: js/config.js
// (Firebase upeprint Config, Pricing Rates, District/Tehsil/SDM Data & Form Helpers)
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, 
    updatePassword, EmailAuthProvider, reauthenticateWithCredential 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, 
    addDoc, getDocs, query, where, onSnapshot, deleteDoc,
    orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCjvAVdtOWmyDx4MPYW-0UPsAj7UKEKCuo",
    authDomain: "upeprint.firebaseapp.com",
    projectId: "upeprint",
    storageBucket: "upeprint.firebasestorage.app",
    messagingSenderId: "28101043239",
    appId: "1:28101043239:web:5f90bfa0929583d0b5da02",
    measurementId: "G-GCV8937FRJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.fb = {
    firebaseConfig, app, auth, db,
    signInWithEmailAndPassword, signOut, onAuthStateChanged,
    updatePassword, EmailAuthProvider, reauthenticateWithCredential,
    doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, onSnapshot, deleteDoc, orderBy, limit, startAfter
};

window.alert = function(message) {
    let alertModal = document.getElementById('customAlertModal');
    if (!alertModal) {
        alertModal = document.createElement('div');
        alertModal.id = 'customAlertModal';
        alertModal.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-dark-950/85 backdrop-blur-sm p-4 opacity-0 pointer-events-none transition-all duration-300';
        alertModal.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border-t-4 border-royal-500 max-w-sm w-full p-6 text-center transform scale-95 transition-transform duration-300">
                <div class="mx-auto w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden p-2">
                    <img src="/images/logo.png" alt="Ojas Logo" class="w-full h-full object-contain" onerror="this.onerror=null;this.src='images/logo.png';">
                </div>
                <h2 class="text-lg font-black text-dark-900 mb-2">Ojas Print Service</h2>
                <p id="customAlertMessage" class="text-sm font-semibold text-slate-600 mb-6 whitespace-pre-line"></p>
                <button onclick="window.closeCustomAlert()" class="bg-royal-600 hover:bg-royal-700 text-white font-black py-3 px-6 rounded-xl shadow-glow transition w-full text-sm">
                    OK, Got it!
                </button>
            </div>
        `;
        document.body.appendChild(alertModal);
        
        window.closeCustomAlert = function() {
            alertModal.classList.remove('opacity-100', 'pointer-events-auto');
            alertModal.classList.add('opacity-0', 'pointer-events-none');
            alertModal.querySelector('div').classList.remove('scale-100');
            alertModal.querySelector('div').classList.add('scale-95');
        };
    }
    document.getElementById('customAlertMessage').innerText = message;
    alertModal.classList.remove('opacity-0', 'pointer-events-none');
    alertModal.classList.add('opacity-100', 'pointer-events-auto');
    alertModal.querySelector('div').classList.remove('scale-95');
    alertModal.querySelector('div').classList.add('scale-100');
};

// DOB Delhi QR Code Verification Domain (Aap baad mein is URL ko apne hisaab se badal sakte hain)
window.DOB_DELHI_VERIFY_BASE_URL = "https://www.mcdgov.online";
window.ADMIN_EMAIL = "hkosiun1221@gmail.com";
window.SUB_ADMIN_EMAILS = ["prince@gmail.com", "prince@print.com"];
window.ADMIN_SECRET_PIN = "1221";
window.FREE_VIP_EMAILS = []; // No VIP system; all users are normal users

window.isSuperAdminEmail = function(email) {
    if (!email) return false;
    return String(email).trim().toLowerCase() === window.ADMIN_EMAIL.toLowerCase();
};

window.isSubAdminEmail = function(email) {
    if (!email) return false;
    return window.SUB_ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
};

window.isAnyAdminEmail = function(email) {
    return window.isSuperAdminEmail(email) || window.isSubAdminEmail(email);
};
window.MS_PER_DAY = 24 * 60 * 60 * 1000;

// ================= UPDATED SERVICE CREDIT RATES =================
// • Domicile, Caste, e-Voter ID, DOB Delhi: 10 Credits (₹10)
// • Passport: 30 Credits (₹30)
// • DOB (Minor Birth Certificate): 50 Credits (₹50)
// • Annexures (1 to F):
//     - Generate Annexure = 10 Credits (₹10)
//     - Admin Stamp Attach = +20 Credits (₹20) -> (Annexure 10 + Stamp 20 = ₹30)
//     - Admin Certificate Attach = +20 Credits (₹20) -> (Annexure 10 + Stamp 20 + Cert 20 = ₹50 Complete)
window.ANNEXURE_STAMP_FEE = 20;
window.ANNEXURE_CERT_FEE = 20;

window.SERVICE_RATES = {
    'Domicile': 10,
    'Caste': 10,
    'e-Voter ID': 10,
    'DOB Delhi': 10,
    'DOB Minor': 10,
    'Passport': 30,
    'Passport Services': 30,
    'Minor': 50,
    'DOB': 50,
    'DOB Print': 140,
    'DOB Original PDF': 140,
    'Gazette Notification': 100,
    'Gazette': 100,
    'Annexure 1': 10,
    'Annexure 1A': 10,
    'Annexure 3': 10,
    'Annexure 3A': 10,
    'Annexure B': 10,
    'Annexure C': 10,
    'Annexure D': 10,
    'Annexure E': 10,
    'Annexure F': 10
};

window.getServiceCreditCost = function(serviceType) {
    if (!serviceType) return 10;
    if (window.SERVICE_RATES[serviceType] !== undefined) return window.SERVICE_RATES[serviceType];
    const sLower = String(serviceType).toLowerCase();
    if (sLower.includes('gazette')) return 100;
    if (sLower === 'dob print' || sLower === 'dob_print' || sLower.includes('dob original')) return 140;
    if (sLower === 'minor' || sLower === 'dob') return 50;
    if (sLower.includes('passport')) return 30;
    return 10;
};

window.extractUserDisplayName = function(email, username) {
    let name = username || (email ? email.split('@')[0] : 'User');
    name = String(name).trim();
    return name.charAt(0).toUpperCase() + name.slice(1);
};

window.isAllowedPortalEmail = function(email) {
    if (!email) return false;
    const cleanEmail = String(email).trim().toLowerCase();
    if (window.isAnyAdminEmail(cleanEmail) || window.FREE_VIP_EMAILS.includes(cleanEmail)) return true;
    return cleanEmail.endsWith("@print.com");
};

// ================= API URLS (Minor/DOB & Certificate on Google Apps Script) =================
window.API_URLS = {
    "DOB_DELHI": "DELHI",
    "certificate": "https://script.google.com/macros/s/AKfycbxWe_nx9QyfR3oHgJSG7Os_u2FOF22HdPDGUO7nekdwMYIfbNL16LNpIvY2M-QSHTyl/exec",
    "passport": "PASSPORT",
    "minor": "https://script.google.com/macros/s/AKfycbwepvaw92YcuQUQCzYi5DXoL4m2OS00_5vShecUJRY_fsnCREpnTFeLgsGGtka0R1Ot/exec"
};

// ================= APPS SCRIPT SDM & LOCATION LOGIC =================
window.SDM_LOCATIONS_LIST = [
    { keys: ['BUDHANA', 'बुढ़ाना'], t: 'बुढ़ाना', d: 'मुजफ्फरनगर', o: 'MONIKA SINGH' },
    { keys: ['KHATOLI', 'खतौली'], t: 'खतौली', d: 'मुजफ्फरनगर', o: 'RAHUL SHARMA' },
    { keys: ['JANSHATH', 'जानसठ'], t: 'जानसठ', d: 'मुजफ्फरनगर', o: 'AMIT KUMAR' },
    { keys: ['MUZAFFARNAGAR', 'मुजफ्फरनगर'], t: 'मुजफ्फरनगर', d: 'मुजफ्फरनगर', o: 'SURESH CHANDRA' },
    { keys: ['KAIRANA', 'कैराना'], t: 'कैराना', d: 'शामली', o: 'SHIVAJI YADAV' },
    { keys: ['OON', 'UN', 'ऊन'], t: 'ऊन', d: 'शामली', o: 'VINAY PRATAP SINGH' },
    { keys: ['SHAMLI', 'शामली'], t: 'शामली', d: 'शामली', o: 'NIDHI BHARDWAJ' },
    { keys: ['BARAUT', 'बड़ौत'], t: 'बड़ौत', d: 'बागपत', o: 'BAL KRISHNA SINGH' },
    { keys: ['KHEKRA', 'खेकड़ा', 'खेखड़ा'], t: 'खेकड़ा', d: 'बागपत', o: 'ANIL KUMAR' },
    { keys: ['MAWANA', 'मवाना'], t: 'मवाना', d: 'मेरठ', o: 'ANKIT KUMAR' },
    { keys: ['SARDHANA', 'सरधना'], t: 'सरधना', d: 'मेरठ', o: 'PANKAJ PRAKASH' },
    { keys: ['MEERUT', 'मेरठ'], t: 'मेरठ', d: 'मेरठ', o: 'KAMLESH KUMAR' },
    { keys: ['BEHAT', 'बेहट'], t: 'बेहट', d: 'सहारनपुर', o: 'DEEPAK KUMAR' },
    { keys: ['DEOBAND', 'देवबंद'], t: 'देवबंद', d: 'सहारनपुर', o: 'SANJEEV KUMAR' },
    { keys: ['RAMPUR', 'रामपुर मनिहारन'], t: 'रामपुर मनिहारन', d: 'सहारनपुर', o: 'MANOJ KUMAR' },
    { keys: ['NAKUR', 'नकुड़'], t: 'नकुड़', d: 'सहारनपुर', o: 'AJAY KUMAR' },
    { keys: ['SAHARANPUR', 'सहारनपुर'], t: 'सहारनपुर', d: 'सहारनपुर', o: 'VIVEK YADAV' },
    { keys: ['MODINAGAR', 'मोदीनगर'], t: 'मोदीनगर', d: 'गाजियाबाद', o: 'SANTOSH KUMAR' },
    { keys: ['LONI', 'लोनी'], t: 'लोनी', d: 'गाजियाबाद', o: 'RAJENDRA SHARMA' },
    { keys: ['GHAZIABAD', 'गाजियाबाद'], t: 'गाजियाबाद', d: 'गाजियाबाद', o: 'ARUN DIXIT' }
];

window.DOC_OPTIONS_LIST = ["BIRTH CERTIFICATE", "INVALID BIRTH CERTIFICATE", "MARKSHEET", "SCHOOL LEAVING CERTIFICATE", "TRANSFER CERTIFICATE", "PASSPORT"];
window.VLE_NAMES_LIST = ["कपिल", "सचिन", "नसीम", "शौकीन", "राहुल", "अमन", "मोहित"];
window.CASTE_OPTIONS_LIST = ["गुर्जर", "कश्यप", "अहीर", "ब्राह्मण", "सैनी", "प्रजापति", "राजपूत", "त्यागी", "वाल्मीकि"];

window.HOSPITALS_LIST = [
    "CHC BARAUT, BARAUT, BAGHPAT , UTTAR PRADESH, 250611  / सामुदायिक स्वास्थ्य केंद्र बडौत, बडौत, बागपत, उत्तर प्रदेश, 250611",
    "JAGWATI HOSPITAL NEHRU ROAD BARAUT, BAGHPAT, UTTAR PRADESH / जगवती हास्पिटल नेहरू रोड बड़ौत, बागपत, उत्तर प्रदेश",
    "AASTHA NURSING HOME BARAUT, BARAUT, BAGHPAT, UTTAR PRADESH / आस्था नरसिग होम बडौत, बडौत, बागपत, उत्तर प्रदेश",
    "SUB DISTRICT HOSPITAL BARAUT, BAGHPAT, UTTAR PRADESH, 260611 / उप-जिला अस्पताल बडौत, बागपत, उत्तर प्रदेश, 250611"
];

window.DISTRICT_DATA_MAP = {
    'BAGHPAT': { tehsils: ['बड़ौत', 'खेकड़ा', 'बागपत'], thanas: ['बड़ौत', 'खेकड़ा', 'बागपत', 'छपरोली', 'बिनौली', 'रमाला', 'दोघट', 'सिंघावली अहीर', 'बालैनी', 'चांदीनगर'] },
    'SHAMLI': { tehsils: ['कैराना', 'ऊन', 'शामली'], thanas: ['थाना भवन', 'कैराना', 'झिंझाना', 'शामली', 'बाबरी', 'कांधला', 'गढ़ी पुख्ता', 'आदर्श मंडी'] },
    'MUZAFFARNAGAR': { tehsils: ['बुढ़ाना', 'खतौली', 'जानसठ', 'मुजफ्फरनगर'], thanas: ['बुढ़ाना', 'खतौली', 'जानसठ', 'मीरापुर', 'सिविल लाइन', 'कोतवाली नगर', 'नई मंडी', 'चरथावल', 'पुरकाजी', 'छपार', 'मंसूरपुर', 'शाहपुर', 'सिखेड़ा', 'फुगाना', 'भौराकलां', 'ककरौली', 'भोपा', 'रतनपुरी', 'तितावी', 'रामराज'] },
    'MEERUT': { tehsils: ['मेरठ', 'मवाना', 'सरधना'], thanas: ['मवाना', 'सरधना', 'जानी', 'रोहटा', 'परतापुर', 'कंकरखेड़ा', 'दौराला', 'हस्तिनापुर', 'बहसूमा', 'फलावदा', 'किठौर', 'मुंडाली', 'खरखौदा', 'इंचौली', 'गंगानगर', 'मेडिकल', 'नौचंदी', 'सिविल लाइन', 'कोतवाली', 'देहली गेट', 'लिसाड़ी गेट', 'ब्रह्मपुरी', 'टीपी नगर', 'पल्लवपुरम', 'सरूरपुर', 'लालकुर्ती', 'सदर बाजार', 'रेलवे रोड', 'लोहियानगर'] },
    'SAHARANPUR': { tehsils: ['सहारनपुर', 'बेहट', 'देवबंद', 'रामपुर मनिहारन', 'नकुड़'], thanas: ['बेहट', 'देवबंद', 'रामपुर मनिहारन', 'नकुड़', 'गंगोह', 'चिलकाना', 'सरसावा', 'तीतरों', 'नानौता', 'बड़गांव', 'मिर्जापुर', 'फतेहपुर', 'गागलहेड़ी', 'नागल', 'कोतवाली देहात', 'कोतवाली नगर', 'सदर बाजार', 'कुतुबशेर', 'जनकपुरी', 'मंडी', 'बिहारीगढ़'] },
    'GHAZIABAD': { tehsils: ['गाजियाबाद', 'मोदीनगर', 'लोनी'], thanas: ['मोदीनगर', 'लोनी', 'मुरादनगर', 'भोजपुर', 'निवाड़ी', 'लोनी बॉर्डर', 'ट्रॉनिका सिटी', 'अंकुर विहार', 'साहिबाबाद', 'लिंक रोड', 'टीला मोड़', 'शालीमार गार्डन', 'इंदिरापुरम', 'कौशांबी', 'खोड़ा', 'विजयनगर', 'क्रॉसिंग रिपब्लिक', 'कोतवाली घंटाघर', 'सिहानी गेट', 'नंदग्राम', 'कविनगर', 'मधुबन बापूधाम', 'मसूरी', 'वेव सिटी'] }
};

window.buildDocSelectOptions = function(defaultVal = "BIRTH CERTIFICATE") { return window.DOC_OPTIONS_LIST.map(docName => `<option value="${docName}" ${docName === defaultVal ? 'selected' : ''}>${docName}</option>`).join('') + `<option value="OTHER">OTHER (खुद टाइप करें)</option>`; };
window.toggleCustomInput = function(selectEl, customInputId) { const customInp = document.getElementById(customInputId); if (!customInp) return; if (selectEl.value === 'OTHER') { customInp.style.display = 'block'; customInp.required = true; customInp.focus(); } else { customInp.style.display = 'none'; customInp.required = false; customInp.value = ''; } };
window.format12DigitId = function(el) { const digits = el.value.replace(/\D/g, '').substring(0, 12); el.value = digits.match(/.{1,4}/g)?.join(' ') || ''; };
window.toggleNaField = function(checkbox, inputId, originalType = 'text') { const inp = document.getElementById(inputId); if (!inp) return; if (checkbox.checked) { if (inp.type === 'date') inp.type = 'text'; inp.value = 'NA'; inp.readOnly = true; inp.classList.add('bg-slate-200', 'text-slate-600', 'cursor-not-allowed'); } else { inp.type = originalType; inp.value = ''; inp.readOnly = false; inp.classList.remove('bg-slate-200', 'text-slate-600', 'cursor-not-allowed'); inp.focus(); } };
window.cleanDob18AddressString = function(rawVal = '') { let val = String(rawVal).toUpperCase(); val = val.replace(/[\s,\-\/]*(?:UTT[AE]R\s*PRADESH|उत्तर\s*प्रदेश|उत्तरप्रदेश)[\s,\-\/]*/gi, ' '); val = val.replace(/\s{2,}/g, ' '); if (val.trim() !== 'VILL -') { val = val.replace(/[,\-]+$/, ''); } if (val.length > 38) { val = val.substring(0, 38); } return val; };
window.handleDob18AddressInput = function(el) { const rawUpper = el.value.toUpperCase(); const hasUP = /(?:UTT[AE]R\s*PRADESH|उत्तर\s*प्रदेश|उत्तरप्रदेश)/i.test(rawUpper); if (hasUP || rawUpper.length > 38) { el.value = window.cleanDob18AddressString(rawUpper); } else { el.value = rawUpper; } const counterEl = document.getElementById('dobDelhiAddressCharCount'); if (counterEl) { const len = el.value.length; counterEl.innerText = `${len} / 38 Characters`; counterEl.className = len >= 38 ? "text-[10px] font-black text-red-600" : "text-[10px] font-bold text-slate-400"; } };
window.updateTehsilsAndThanas = function() { const districtEl = document.getElementById('districtSelect'); const tehsilSelect = document.getElementById('tehsilSelect'); const thanaSelect = document.getElementById('thanaSelect'); if (!districtEl || !tehsilSelect) return; const selectedDistrict = districtEl.value; const data = window.DISTRICT_DATA_MAP[selectedDistrict] || window.DISTRICT_DATA_MAP['BAGHPAT']; tehsilSelect.innerHTML = data.tehsils.map(t => `<option value="${t}">${t}</option>`).join(''); if (thanaSelect) { thanaSelect.innerHTML = data.thanas.map(th => `<option value="${th}">${th}</option>`).join(''); } };
window.formatDateIN = function(dateStr) { if (!dateStr) return ''; const parts = String(dateStr).split('-'); if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`; return dateStr; };
window.getOrdinalDay = function(n) { const s = ["th", "st", "nd", "rd"]; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
window.initVerificationDefaults = function() { const now = new Date(); const dayEl = document.getElementById('inpDay'); const myEl = document.getElementById('inpMonthYear'); if (dayEl) dayEl.value = window.getOrdinalDay(now.getDate()); if (myEl) myEl.value = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase(); };
window.syncAnnexureENames = function() { const appName = document.getElementById('inpApplicantName')?.value.trim().toUpperCase() || ''; const rec1Input = document.getElementById('inpRecorded1'); const rec2Input = document.getElementById('inpRecorded2'); const retainInput = document.getElementById('inpRetainName'); const removeInput = document.getElementById('inpRemoveName'); if (appName && document.activeElement?.id === 'inpApplicantName') { const urfSplit = appName.split(/\s+(?:URF|ALIAS|उर्फ|उर्फ़)\s+/i); if (urfSplit.length >= 2) { const firstName = urfSplit[0].trim(); const aliasName = urfSplit.slice(1).join(' ').trim(); if (rec1Input) rec1Input.value = firstName; if (rec2Input) rec2Input.value = aliasName; if (retainInput) retainInput.value = firstName; if (removeInput) removeInput.value = aliasName; } else { if (rec1Input) rec1Input.value = appName; if (retainInput) retainInput.value = appName; } } else if (document.activeElement?.id === 'inpRecorded1' && retainInput) { retainInput.value = rec1Input.value.toUpperCase(); } else if (document.activeElement?.id === 'inpRecorded2' && removeInput) { removeInput.value = rec2Input.value.toUpperCase(); } };
window.swapAnnexureERetainRemove = function() { const retainInput = document.getElementById('inpRetainName'); const removeInput = document.getElementById('inpRemoveName'); if (!retainInput || !removeInput) return; const temp = retainInput.value; retainInput.value = removeInput.value; removeInput.value = temp; };

window.SITE_DOMAIN = 'https://ogasprints.in';
