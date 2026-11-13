// ============================================================================
// FILE: js/portal-forms-annexures.js
// Renders All 9 Official Annexure Forms (1, 1A, 3, 3A, B, C, D, E, F)
// ============================================================================

window.renderAnnexureFormHtml = function(serviceName, container, submitBtnText, statusTagHtml, getWatermarkHtml) {
    if (!serviceName.startsWith('annexure')) return false;
    if (!window.currentUserData || !window.canCurrentUserSeeService('annexures')) {
        window.switchService(window.getFirstAllowedTab());
        return true;
    }

    const todayISO = new Date().toISOString().split('T')[0];
    const annexureDropdownHtml = `
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
    `;

    // 1. ANNEXURE-I
    if (serviceName === 'annexure1') {
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
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">12-Digit ID Number (4-4 Pair)</label><input type="text" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">कितनी बार DoB अपडेट किया?</label><select name="updateTimes" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="NEVER">NEVER (कभी नहीं)</option><option value="ONCE">ONCE (एक बार)</option><option value="MORE THAN ONCE">MORE THAN ONCE (एक से अधिक बार)</option></select></div>
                        <div><label class="block text-[11px] font-bold text-green-700 uppercase mb-1">सही जन्मतिथि (Correct DoB)</label><input type="date" name="newDob" required class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold bg-green-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">पहले दर्ज जन्मतिथि (Old DoB)</label><input type="date" name="oldDob" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold bg-amber-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दिया गया दस्तावेज़ (Old Doc)</label>
                            <select name="oldDoc" onchange="window.toggleCustomInput(this, 'an1OldDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">${window.buildDocSelectOptions("BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an1OldDocCustom" name="oldDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">अभी दिया जा रहा दस्तावेज़ (New Doc)</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an1NewDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">${window.buildDocSelectOptions("BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an1NewDocCustom" name="newDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, TEHSIL, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        return true;
    }

    // 2. ANNEXURE-IA
    if (serviceName === 'annexure1a') {
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
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का 12-Digit ID Number</label><input type="text" name="parentIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-amber-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का नाम (Child Name)</label><input type="text" name="childName" placeholder="e.g. AARAV KUMAR" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold uppercase bg-indigo-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label><input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-green-800 uppercase mb-1">बच्चे की सही जन्मतिथि (Correct DoB)</label><input type="date" name="newDob" required class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold bg-green-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दर्ज गलत जन्मतिथि (Old DoB)</label><input type="date" name="oldDob" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दिया गया दस्तावेज़ (Old Doc)</label>
                            <select name="oldDoc" onchange="window.toggleCustomInput(this, 'an1aOldDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">${window.buildDocSelectOptions("BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an1aOldDocCustom" name="oldDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">कितनी बार अपडेट किया?</label><select name="updateTimes" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"><option value="NEVER">NEVER (कभी नहीं)</option><option value="ONCE">ONCE (एक बार)</option><option value="MORE THAN ONCE">MORE THAN ONCE (एक से अधिक बार)</option></select></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">अभी दिया जा रहा दस्तावेज़ (New Doc)</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an1aNewDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">${window.buildDocSelectOptions("BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an1aNewDocCustom" name="newDocCustom" placeholder="दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        return true;
    }

    // 3. ANNEXURE-III
    if (serviceName === 'annexure3') {
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
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">12-Digit ID Number (4-4 Pair)</label><input type="text" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">पहले दिया गया अमान्य दस्तावेज़ (Invalid Doc)</label>
                            <select name="invalidDocName" onchange="window.toggleCustomInput(this, 'an3InvDocCustom')" class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">${window.buildDocSelectOptions("INVALID BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an3InvDocCustom" name="invalidDocNameCustom" placeholder="अमान्य दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><label class="text-[11px] font-bold text-amber-800 uppercase">अमान्य दस्तावेज़ का नंबर (Doc No)</label><label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none"><input type="checkbox" onchange="window.toggleNaField(this, 'an3InvDocNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA</label></div>
                            <input type="text" id="an3InvDocNo" name="invalidDocNo" placeholder="Enter Document No" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><label class="text-[11px] font-bold text-amber-800 uppercase">अमान्य दस्तावेज़ की तारीख (Doc Date)</label><label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none"><input type="checkbox" onchange="window.toggleNaField(this, 'an3InvDocDate', 'date')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA</label></div>
                            <input type="date" id="an3InvDocDate" name="invalidDocDate" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><label class="text-[11px] font-bold text-amber-800 uppercase">EID Number (एनरोलमेंट आईडी)</label><label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none"><input type="checkbox" onchange="window.toggleNaField(this, 'an3EidNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA</label></div>
                            <input type="text" id="an3EidNo" name="eidNumber" placeholder="Enter EID Number" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-green-800 uppercase mb-1">अभी दिया जा रहा सही दस्तावेज़</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an3NewDocCustom')" class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold uppercase bg-green-50 relative z-10">${window.buildDocSelectOptions("BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an3NewDocCustom" name="newDocCustom" placeholder="सही दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-green-300 rounded-xl text-xs bg-green-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        return true;
    }

    // 4. ANNEXURE-IIIA
    if (serviceName === 'annexure3a') {
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
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का 12-Digit ID Number</label><input type="text" name="parentIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-amber-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Complete Address)</label><input type="text" name="address" placeholder="VILL, POST, DISTT, PIN" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का नाम (Child Name)</label><input type="text" name="childName" placeholder="e.g. AARAV KUMAR" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold uppercase bg-indigo-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label><input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पहले दिया गया अमान्य दस्तावेज़</label>
                            <select name="invalidDocName" onchange="window.toggleCustomInput(this, 'an3aInvDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">${window.buildDocSelectOptions("INVALID BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an3aInvDocCustom" name="invalidDocNameCustom" placeholder="अमान्य दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><label class="text-[11px] font-bold text-slate-600 uppercase">अमान्य दस्तावेज़ का नंबर (Doc No)</label><label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none"><input type="checkbox" onchange="window.toggleNaField(this, 'an3aInvDocNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA</label></div>
                            <input type="text" id="an3aInvDocNo" name="invalidDocNo" placeholder="Enter Document No" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><label class="text-[11px] font-bold text-slate-600 uppercase">अमान्य दस्तावेज़ की तारीख (Doc Date)</label><label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none"><input type="checkbox" onchange="window.toggleNaField(this, 'an3aInvDocDate', 'date')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA</label></div>
                            <input type="date" id="an3aInvDocDate" name="invalidDocDate" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><label class="text-[11px] font-bold text-slate-600 uppercase">EID Number (एनरोलमेंट आईडी)</label><label class="inline-flex items-center gap-1 cursor-pointer bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black select-none"><input type="checkbox" onchange="window.toggleNaField(this, 'an3aEidNo', 'text')" class="accent-dark-900 w-3.5 h-3.5"> टिक करें = NA</label></div>
                            <input type="text" id="an3aEidNo" name="eidNumber" placeholder="Enter EID Number" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-green-800 uppercase mb-1">अभी दिया जा रहा सही दस्तावेज़</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'an3aNewDocCustom')" class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold uppercase bg-green-50 relative z-10">${window.buildDocSelectOptions("BIRTH CERTIFICATE")}</select>
                            <input type="text" id="an3aNewDocCustom" name="newDocCustom" placeholder="सही दस्तावेज़ का नाम लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-green-300 rounded-xl text-xs bg-green-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">शपथ पत्र की तारीख (Date)</label><input type="date" name="date" value="${todayISO}" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        return true;
    }

    // 5, 6, 7. ANNEXURE B, C, D
    if (serviceName === 'annexureb' || serviceName === 'annexurec' || serviceName === 'annexured') {
        const isChild = (serviceName === 'annexurec');
        const mapInfo = {
            'annexureb': { title: 'Annexure B', key: 'LOCAL_HTML_ANNEXURE_B', desc: 'वयस्कों के नाम सुधार / परिवर्तन हेतु शपथ पत्र' },
            'annexurec': { title: 'Annexure C', key: 'LOCAL_HTML_ANNEXURE_C', desc: 'बच्चों के नाम सुधार / परिवर्तन हेतु माता-पिता द्वारा शपथ पत्र' },
            'annexured': { title: 'Annexure D', key: 'LOCAL_HTML_ANNEXURE_D', desc: 'विवाह पश्चात या दूसरी बार नाम अपडेट करने हेतु शपथ पत्र' }
        }[serviceName];

        const childFieldsHtml = isChild ? `<div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label><input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10"></div>` : '';

        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div><h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-file-contract text-royal-500 mr-1.5"></i> ${mapInfo.title} - Name Update Affidavit</h3><p class="text-[11px] text-slate-500">${mapInfo.desc}</p></div>
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
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">${isChild ? 'माता/पिता का 12-Digit ID Number' : '12-Digit ID Number (4-4 Pair)'}</label><input type="text" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10"></div>
                        ${childFieldsHtml}
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">पहले दर्ज नाम (Old Recorded Name)</label><input type="text" name="oldName" placeholder="OLD NAME" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold uppercase bg-amber-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-green-800 uppercase mb-1">नया सही नाम (New Correct Name)</label><input type="text" name="newName" placeholder="NEW CORRECT NAME" required class="w-full p-3 border border-green-300 rounded-xl text-sm font-bold uppercase bg-green-50 relative z-10"></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">सपोर्टिंग दस्तावेज़ (Supporting PoI Doc)</label>
                            <select name="newDoc" onchange="window.toggleCustomInput(this, 'anBcdDocCustom')" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10">${window.buildDocSelectOptions(isChild ? "BIRTH CERTIFICATE" : "PAN CARD")}</select>
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
        return true;
    }

    // 8. ANNEXURE E
    if (serviceName === 'annexuree') {
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div><h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-file-contract text-royal-500 mr-1.5"></i> Annexure E (Adults Urf/Alias Removal)</h3><p class="text-[11px] text-slate-500">वयस्कों के नाम में से "उर्फ़ / Alias" हटाने हेतु शपथ पत्र।</p></div>
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
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">12-Digit ID Number (4-4 Pair)</label><input type="text" id="inpIdNumber" name="idNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold tracking-wider uppercase bg-slate-50 relative z-10"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
                        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 relative z-10">
                            <div class="flex justify-between items-center"><span class="text-[11px] font-black text-amber-900 uppercase">2. कार्ड में दर्ज दोनों नाम</span><button type="button" onclick="window.swapAnnexureERetainRemove()" class="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded"><i class="fa-solid fa-right-left mr-1"></i> Swap</button></div>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">पहला नाम (Name 1)</label><input type="text" id="inpRecorded1" name="recorded1" oninput="window.syncAnnexureENames()" placeholder="RAMESH" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">उर्फ़ नाम (Alias 2)</label><input type="text" id="inpRecorded2" name="recorded2" oninput="window.syncAnnexureENames()" placeholder="SONU" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                            </div>
                        </div>
                        <div class="p-3 bg-green-50 rounded-2xl border border-green-200 space-y-2 relative z-10">
                            <span class="text-[11px] font-black text-green-900 uppercase block">3. कौन-सा नाम रखना है और हटाना है</span>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-[10px] font-bold text-green-800 uppercase mb-1">रखने वाला (Retain)</label><input type="text" id="inpRetainName" name="retainName" placeholder="RAMESH" required class="w-full p-2.5 border border-green-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                                <div><label class="block text-[10px] font-bold text-red-700 uppercase mb-1">हटाने वाला (Remove)</label><input type="text" id="inpRemoveName" name="removeName" placeholder="SONU" required class="w-full p-2.5 border border-red-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2.5 relative z-10">
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">स्थान (Place)</label><input type="text" id="inpPlace" name="place" placeholder="BARAUT" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">दिन (Day)</label><input type="text" id="inpDay" name="day" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">महीना व वर्ष</label><input type="text" id="inpMonthYear" name="monthYear" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.initVerificationDefaults();
        return true;
    }

    // 9. ANNEXURE F
    if (serviceName === 'annexuref') {
        container.innerHTML = `
            ${annexureDropdownHtml}
            <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div><h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-child-reaching text-royal-500 mr-1.5"></i> Annexure F (Children Urf/Alias Removal)</h3><p class="text-[11px] text-slate-500">बच्चे के नाम में से "उर्फ़ / Alias" हटाने हेतु शपथ पत्र।</p></div>
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
                        <div><label class="block text-[11px] font-bold text-amber-800 uppercase mb-1">माता / पिता का 12-Digit ID Number</label><input type="text" name="parentIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-amber-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-amber-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पूरा पता (Resident of)</label><input type="text" name="address" placeholder="VILL BARAUT, DISTT BAGHPAT" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का नाम (Child Name)</label><input type="text" id="inpApplicantName" name="childName" oninput="window.syncAnnexureENames()" placeholder="e.g. AARAV URF GOLU" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold uppercase bg-indigo-50 relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">बच्चे का 12-Digit ID Number</label><input type="text" name="childIdNumber" oninput="window.format12DigitId(this)" pattern="\\d{4} \\d{4} \\d{4}" minlength="14" maxlength="14" placeholder="XXXX XXXX XXXX" required class="w-full p-3 border border-indigo-300 rounded-xl text-sm font-bold tracking-wider uppercase bg-indigo-50 relative z-10"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
                        <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                            <div class="flex justify-between items-center"><span class="text-[11px] font-black text-amber-900 uppercase">2. बच्चे के दर्ज दोनों नाम</span><button type="button" onclick="window.swapAnnexureERetainRemove()" class="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded"><i class="fa-solid fa-right-left mr-1"></i> Swap</button></div>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">पहला नाम (Name 1)</label><input type="text" id="inpRecorded1" name="recorded1" oninput="window.syncAnnexureENames()" placeholder="AARAV" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                                <div><label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">उर्फ़ नाम (Alias 2)</label><input type="text" id="inpRecorded2" name="recorded2" oninput="window.syncAnnexureENames()" placeholder="GOLU" required class="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                            </div>
                        </div>
                        <div class="p-3 bg-green-50 rounded-2xl border border-green-200 space-y-2">
                            <span class="text-[11px] font-black text-green-900 uppercase block">3. कौन-सा नाम रखना है और हटाना है</span>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-[10px] font-bold text-green-800 uppercase mb-1">रखने वाला (Retain)</label><input type="text" id="inpRetainName" name="retainName" placeholder="AARAV" required class="w-full p-2.5 border border-green-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                                <div><label class="block text-[10px] font-bold text-red-700 uppercase mb-1">हटाने वाला (Remove)</label><input type="text" id="inpRemoveName" name="removeName" placeholder="GOLU" required class="w-full p-2.5 border border-red-300 rounded-xl text-xs font-bold uppercase bg-white"></div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2.5 relative z-10">
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">स्थान (Place)</label><input type="text" id="inpPlace" name="place" placeholder="BARAUT" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">दिन (Day)</label><input type="text" id="inpDay" name="day" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"></div>
                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">महीना व वर्ष</label><input type="text" id="inpMonthYear" name="monthYear" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.initVerificationDefaults();
        return true;
    }

    return false;
};
