// ============================================================================
// FILE: js/portal-forms-services.js
// Renders Standard & Main Service Forms (Minor, Domicile, Caste, e-Voter, DOB Delhi, Passport, Gazette, DOB Original PDF)
// ============================================================================

window.renderMainServiceFormHtml = function(serviceName, container, submitBtnText, statusTagHtml, getWatermarkHtml) {
    const todayISO = new Date().toISOString().split('T')[0];

    const vleSelectHtml = `
        <select name="VLE" onchange="window.toggleCustomInput(this, 'customVleInput')" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10">
            ${window.VLE_NAMES_LIST.map(v => `<option value="${v}">${v}</option>`).join('')}
            <option value="OTHER">OTHER (अन्य नाम दर्ज करें)</option>
        </select>
        <input type="text" id="customVleInput" name="VLE_CUSTOM" placeholder="VLE का नाम यहाँ लिखें" style="display:none;" class="w-full mt-2 p-2.5 border border-amber-300 rounded-xl text-xs bg-amber-50 uppercase relative z-10">
    `;

    // 0. MINOR SERVICE
    if (serviceName === 'minor') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('minor')) {
            window.switchService(window.getFirstAllowedTab());
            return true;
        }
        const hospitalsList = window.HOSPITALS_LIST || [];
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
        return true;
    }

    // DOMICILE
    if (serviceName === 'domicile') {
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
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Customer Name (English)</label><input type="text" name="NAME" placeholder="Enter Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hindi Name (Optional)</label><input type="text" name="HNAME" placeholder="हिंदी में नाम (वैकल्पिक)" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father / Husband Name</label><input type="text" name="FNAME" placeholder="Enter Father/Husband Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mother Name</label><input type="text" name="MNAME" placeholder="Enter Mother Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">House Number (मकान नंबर - MN)</label><input type="text" name="MN" placeholder="Enter House No" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Area / Locality (मोहल्ला / पोस्ट)</label><input type="text" name="AREA" placeholder="Enter Area / Locality" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Village / Ward Name (गाँव / वार्ड)</label><input type="text" name="GRAM" placeholder="Enter Village / Ward Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">VLE Name (जन सेवा केंद्र संचालक)</label>${vleSelectHtml}</div>
                        <div><label class="block text-[11px] font-bold text-royal-700 uppercase mb-1">Issue Date (जारी करने की तारीख)</label><input type="date" name="ISSUE_DATE" value="${todayISO}" required class="w-full p-3 border border-royal-300 rounded-xl text-sm bg-royal-50/50 focus:bg-white outline-none relative z-10"></div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Photo</label><input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-700 cursor-pointer relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.updateTehsilsAndThanas();
        return true;
    }

    // CASTE
    if (serviceName === 'caste') {
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
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">VLE Name</label>${vleSelectHtml}</div>
                        <div><label class="block text-[11px] font-bold text-royal-700 uppercase mb-1">Issue Date (जारी करने की तारीख)</label><input type="date" name="ISSUE_DATE" value="${todayISO}" required class="w-full p-3 border border-royal-300 rounded-xl text-sm bg-royal-50/50 focus:bg-white outline-none relative z-10"></div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Photo</label><input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-700 cursor-pointer relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-glow transition text-sm md:text-base relative z-10">${submitBtnText}</button>
                </form>
            </div>
        `;
        window.updateTehsilsAndThanas();
        return true;
    }

    // e-VOTER ID
    if (serviceName === 'evoter' || serviceName === 'e-voter') {
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
                            <input type="text" id="inpEpicNo" name="EPIC_NO" placeholder="e.g. UPB1234567" required class="w-full p-3 border border-royal-300 rounded-xl text-sm font-black tracking-wider bg-royal-50/40 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name (मतदाता का नाम - English) <span class="text-red-500">*</span></label><input type="text" name="NAME" placeholder="Enter Elector Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hindi Name (हिंदी में नाम - वैकल्पिक)</label><input type="text" name="HNAME" placeholder="हिंदी में नाम लिखें (Optional)" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">संबंध</label><select name="REL_TYPE" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"><option value="S/O">पिता (Father)</option><option value="W/O">पति (Husband)</option></select></div>
                            <div class="col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father / Husband Name <span class="text-red-500">*</span></label><input type="text" name="FNAME" placeholder="Enter Father/Husband Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth (जन्मतिथि - DOB) <span class="text-red-500">*</span></label><input type="date" name="DOB" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gender (लिंग) <span class="text-red-500">*</span></label><select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"><option value="MALE / पुरुष">MALE / पुरुष</option><option value="FEMALE / महिला">FEMALE / महिला</option></select></div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">District (जिला)</label>
                            <select id="districtSelect" name="DISTRICT" onchange="window.updateTehsilsAndThanas()" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10">
                                <option value="BAGHPAT">बागपत</option><option value="SHAMLI">शामली</option><option value="MUZAFFARNAGAR">मुजफ्फरनगर</option><option value="MEERUT">मेरठ</option><option value="SAHARANPUR">सहारनपुर</option><option value="GHAZIABAD">गाजियाबाद</option>
                            </select>
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Assembly / Tehsil (विधानसभा / तहसील)</label><select id="tehsilSelect" name="TAHSEEL" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></select></div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Complete Address (पूरा पता) <span class="text-red-500">*</span></label><input type="text" name="ADDRESS" placeholder="HOUSE NO, VILLAGE/WARD, POST, PIN CODE" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Elector Photo (पासपोर्ट फोटो अपलोड करें)</label><input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-royal-100 file:text-royal-700 cursor-pointer relative z-10"></div>
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
        return true;
    }

    // DOB DELHI
    if (serviceName === 'dob_delhi' || serviceName === 'dob_minor') {
        const dobDelhiBtnText = 'Generate MCD Delhi Birth Certificate (50 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';
        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-cake-candles text-royal-500 mr-1.5"></i> MCD Delhi Birth Certificate (दिल्ली जन्म प्रमाण पत्र • Form No. 5)</h3>
                    <p class="text-[11px] font-bold text-slate-500">Place of Birth ड्रॉपडाउन से चुनें और केवल 1 बार पता टाइप करें • शुल्क: 50 Credits (₹50)</p>
                </div>
                <span class="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-emerald-300 uppercase">50 Credits (₹50)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('dob_delhi')}
                <form onsubmit="window.submitForm(event, 'DOB Delhi')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-royal-700 uppercase">Registration No (पंजीकरण संख्या) <span class="text-red-500">*</span></label>
                                <button type="button" onclick="document.getElementById('inpMcdRegNo').value = window.generateMcdRegNo();" class="text-[10px] bg-royal-100 hover:bg-royal-200 text-royal-900 font-black px-2 py-0.5 rounded border border-royal-300 transition"><i class="fa-solid fa-shuffle mr-1"></i>Auto Generate</button>
                            </div>
                            <input type="text" id="inpMcdRegNo" name="REG_NO" placeholder="e.g. MCDOLIR-2219-007395634" required class="w-full p-3 border border-royal-300 rounded-xl text-sm font-black tracking-wider bg-royal-50/40 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Child / Person Name (नाम / Name) <span class="text-red-500">*</span></label><input type="text" name="NAME" placeholder="e.g. SAHIL ASHRAF" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gender (लिंग / Gender) <span class="text-red-500">*</span></label><select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option><option value="TRANSGENDER">TRANSGENDER</option></select></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth (जन्म की तिथि) <span class="text-red-500">*</span></label><input type="date" id="inpMcdDob" name="DOB" onchange="const dorEl = document.getElementById('inpMcdDor'); if(dorEl && !dorEl.value) dorEl.value = this.value;" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Name of Mother (माता का नाम) <span class="text-red-500">*</span></label><input type="text" name="MNAME" placeholder="e.g. FOUZIA TEMURI" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Name of Father (पिता का नाम) <span class="text-red-500">*</span></label><input type="text" name="FNAME" placeholder="e.g. MAHMOOD ASHRAF" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Registration (पंजीकरण की तिथि) <span class="text-red-500">*</span></label><input type="date" id="inpMcdDor" name="DOR" required class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-royal-700 uppercase mb-1">Date of Issue (जारी करने की तिथि) <span class="text-red-500">*</span></label><input type="date" name="DOI" value="${todayISO}" required class="w-full p-3 border border-royal-300 rounded-xl text-sm font-bold bg-royal-50/40 focus:bg-white outline-none relative z-10"></div>
                        <div class="md:col-span-2 bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2 relative z-10">
                            <label class="block text-[11px] font-black text-indigo-950 uppercase"><i class="fa-solid fa-hospital text-royal-600 mr-1"></i> Place of Birth (जन्म का स्थान) <span class="text-red-500">*</span></label>
                            <select id="selMcdPobDropdown" name="POB_SELECT" onchange="window.handleDobDelhiPobChange(this)" required class="w-full p-3 border border-indigo-300 rounded-xl text-xs md:text-sm font-black bg-white text-slate-800 outline-none focus:border-royal-500 cursor-pointer">
                                <option value="2529,KAMRA BANGASH SIR SAYED AHMED ROAD CHANDNI MAHAL DELHI-110006">1. 2529, KAMRA BANGASH SIR SAYED AHMED ROAD CHANDNI MAHAL DELHI-110006</option>
                                <option value="KASTURBA HOSPITAL, DARYA GANJ, NEAR JAMA MASJID, CHANDNI MAHAL, DELHI-110006">2. KASTURBA HOSPITAL, DARYA GANJ, NEAR JAMA MASJID, CHANDNI MAHAL, DELHI-110006</option>
                                <option value="LOK NAYAK HOSPITAL (LNJP), JAWAHARLAL NEHRU MARG, NEAR DELHI GATE, DARYA GANJ, NEW DELHI-110002">3. LOK NAYAK HOSPITAL (LNJP), JAWAHARLAL NEHRU MARG, NEAR DELHI GATE, DARYA GANJ, NEW DELHI-110002</option>
                                <option value="ST. STEPHEN'S HOSPITAL, TIS HAZARI, NEAR KASHMERE GATE, OLD DELHI, DELHI-110054">4. ST. STEPHEN'S HOSPITAL, TIS HAZARI, NEAR KASHMERE GATE, OLD DELHI, DELHI-110054</option>
                                <option value="OTHER">5. OTHER (खुद टाइप करके अस्पताल या जन्म स्थान का पता डालें)</option>
                            </select>
                            <div id="dobDelhiPobCustomWrapper" style="display: none;" class="pt-1">
                                <input type="text" id="inpMcdPobCustom" name="POB_CUSTOM" oninput="window.syncDobDelhiCustomPob(this)" placeholder="यहाँ जन्म स्थान / अस्पताल का पूरा पता टाइप करें..." class="w-full p-3 border-2 border-amber-400 rounded-xl text-sm font-bold bg-amber-50 focus:bg-white outline-none uppercase">
                            </div>
                            <input type="hidden" id="inpMcdPob" name="POB" value="2529,KAMRA BANGASH SIR SAYED AHMED ROAD CHANDNI MAHAL DELHI-110006">
                        </div>
                        <div class="md:col-span-2 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-300 space-y-1.5 relative z-10">
                            <div class="flex flex-wrap items-center justify-between gap-1">
                                <label class="text-[11px] font-black text-emerald-950 uppercase"><i class="fa-solid fa-location-dot text-emerald-600 mr-1"></i> Mother / Father Complete Address <span class="text-red-500">*</span></label>
                                <span class="bg-emerald-200 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full">Auto-Fills Both Address Sections</span>
                            </div>
                            <input type="text" id="inpMcdPresAddr" name="PRES_ADDR" oninput="window.syncDobDelhiUnifiedAddress(this)" placeholder="e.g. 2529,TIRAHA BEHRAM KHAN DARYA GANJ DELHI-110002" required class="w-full p-3 border border-emerald-400 rounded-xl text-sm font-bold bg-white outline-none uppercase focus:border-emerald-600">
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
            if (regInp && !regInp.value && typeof window.generateMcdRegNo === 'function') regInp.value = window.generateMcdRegNo();
        }
        return true;
    }


    // DOB BARAUT (NAGAR PALIKA PARISHAD BARAUT BIRTH CERTIFICATE)
    if (serviceName === 'dob_baraut') {
        if (!window.currentUserData?.isAdmin) return false;
        const hospitalsList = window.HOSPITALS_LIST || [];
        const pobOptions = hospitalsList.map(h => `<option value="${h}">${h}</option>`).join('');
        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-baby text-emerald-600 mr-1.5"></i> DOB Baraut (नगर पालिका परिषद बड़ौत)</h3>
                    <p class="text-[11px] font-bold text-slate-500">Nagar Palika Parishad Baraut Birth Certificate • शुल्क: 50 Credits (₹50)</p>
                </div>
                <span class="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-emerald-300 uppercase">50 Credits (₹50)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('dob_baraut')}
                <form onsubmit="window.submitForm(event, 'DOB Baraut')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">नाम / Name (English / हिंदी) <span class="text-red-500">*</span></label><input type="text" name="NAME" placeholder="e.g. OJASVI / ओजस्वी" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">लिंग / Sex <span class="text-red-500">*</span></label><select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"><option value="FEMALE / महिला">FEMALE / महिला</option><option value="MALE / पुरुष">MALE / पुरुष</option></select></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">आधार संख्या / Aadhaar No (वैकल्पिक)</label><input type="text" name="AADHAAR_NO" placeholder="Optional" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">जन्म तिथि / Date of Birth <span class="text-red-500">*</span></label><input type="date" name="DOB" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-emerald-800 uppercase mb-1">जन्म स्थान / Place of Birth (Baraut Hospitals) <span class="text-red-500">*</span></label>
                            <select name="POB" onchange="window.toggleCustomInput(this, 'barautPobCustom')" class="w-full p-3 border border-emerald-300 rounded-xl text-sm font-bold bg-emerald-50/50 focus:bg-white outline-none relative z-10">
                                ${pobOptions}
                                <option value="OTHER">✍️ अन्य अस्पताल / घर का पता लिखें (Custom)</option>
                            </select>
                            <input type="text" id="barautPobCustom" name="POB_CUSTOM" placeholder="अस्पताल या जन्म स्थान का पूरा पता लिखें" style="display:none;" class="w-full mt-2 p-3 border border-emerald-300 rounded-xl text-xs bg-emerald-50 uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">माता का नाम / Mother Name <span class="text-red-500">*</span></label><input type="text" name="MNAME" placeholder="e.g. NIKKI / निक्की" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पिता का नाम / Father Name <span class="text-red-500">*</span></label><input type="text" name="FNAME" placeholder="e.g. HARISH KUMAR / हरीश कुमार" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">माता का आधार नं. / Mother Aadhaar</label><input type="text" name="MA" placeholder="e.g. XXXX-XXXX-2286" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पिता का आधार नं. / Father Aadhaar</label><input type="text" name="FA" placeholder="e.g. XXXX-XXXX-7550" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">माता-पिता का पता (Birth Time &amp; Permanent Address Same रहेगा) <span class="text-red-500">*</span></label><input type="text" name="ADDRESS" placeholder="e.g. DOGHAT, BARAUT, BAGHPAT, UTTAR PRADESH, / दोघट (नप) , बड़ौत, बागपत, उत्तर प्रदेश," required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">पंजीकरण संख्या / Registration No. <span class="text-red-500">*</span></label><input type="text" name="BRN_NO" placeholder="e.g. B202409900900004833" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-emerald-800 uppercase mb-1">पंजीकरण एवं जारी तिथि (Reg &amp; Issue Date Same) <span class="text-red-500">*</span></label><input type="date" name="REG_DATE" value="${todayISO}" required class="w-full p-3 border border-emerald-300 rounded-xl text-sm bg-emerald-50/50 focus:bg-white outline-none relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">टिप्पणी / Remarks (Optional)</label><input type="text" name="REMARKS" placeholder="Optional" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-indigo-800 uppercase mb-1">QR Code Link (Manual URL) <span class="text-red-500">*</span></label><input type="url" name="QR_LINK" placeholder="https://..." required class="w-full p-3 border border-indigo-300 rounded-xl text-sm bg-indigo-50/50 focus:bg-white outline-none relative z-10"></div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">Generate DOB Baraut Certificate (50 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i></button>
                </form>
            </div>
        `;
        return true;
    }

    // PASSPORT SERVICES (Uses LOCAL_HTML_PASSPORT template!)
    if (serviceName === 'passport') {
        const passportBtnText = 'Generate Passport Document (30 Credits) <i class="fa-solid fa-wand-magic-sparkles ml-1"></i>';
        const defaultIssueDate = typeof window.generateRandomPassportIssueDate === 'function' ? window.generateRandomPassportIssueDate() : '2019-06-15';
        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-passport text-sky-500 mr-1.5"></i> Passport Services (पासपोर्ट सर्विस)</h3>
                    <p class="text-[11px] font-bold text-slate-500">पासपोर्ट डॉक्यूमेंट तुरंत जनरेट करें • शुल्क: 30 Credits (₹30)</p>
                </div>
                <span class="bg-sky-100 text-sky-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-sky-300 uppercase">30 Credits (₹30)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('passport')}
                <form onsubmit="window.submitForm(event, 'Passport')" class="space-y-3.5 relative z-10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-sky-700 uppercase">Passport No. (पासपोर्ट नंबर)</label>
                                <button type="button" onclick="document.getElementById('inpPassportNo').value = window.generateRandomPassportNo();" class="text-[10px] bg-sky-100 hover:bg-sky-200 text-sky-900 font-black px-2 py-0.5 rounded border border-sky-300 transition"><i class="fa-solid fa-shuffle mr-1"></i>Auto</button>
                            </div>
                            <input type="text" id="inpPassportNo" name="PASSPORT_NO" placeholder="e.g. Z4681234" class="w-full p-3 border border-sky-300 rounded-xl text-sm font-black tracking-wider bg-sky-50/40 focus:bg-white outline-none uppercase relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name (पूरा नाम) <span class="text-red-500">*</span></label><input type="text" name="NAME" placeholder="Enter Full Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Father / Husband Name <span class="text-red-500">*</span></label><input type="text" name="FNAME" placeholder="Enter Father/Husband Name" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Sex / Gender</label><select name="SEX" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option></select></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date of Birth (DOB) <span class="text-red-500">*</span></label><input type="date" name="DOB" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[11px] font-bold text-sky-700 uppercase">Issue Date (जारी करने की तारीख) <span class="text-red-500">*</span></label>
                                <button type="button" onclick="document.getElementById('inpPassportIssueDate').value = window.generateRandomPassportIssueDate();" class="text-[10px] bg-sky-100 hover:bg-sky-200 text-sky-900 font-black px-2 py-0.5 rounded border border-sky-300 transition"><i class="fa-solid fa-shuffle mr-1"></i>Auto</button>
                            </div>
                            <input type="date" id="inpPassportIssueDate" name="ISSUE_DATE" value="${defaultIssueDate}" required class="w-full p-3 border border-sky-300 rounded-xl text-sm bg-sky-50 focus:bg-white outline-none relative z-10">
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Place of Issue (जारी स्थान)</label><input type="text" name="POI" value="GHAZIABAD" placeholder="e.g. GHAZIABAD" class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Place of Birth / Address <span class="text-red-500">*</span></label><input type="text" name="ADDRESS" placeholder="e.g. BAGHPAT, UTTAR PRADESH" required class="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Upload Photo (पासपोर्ट फोटो)</label>
                            <input type="file" name="PHOTO" accept="image/*" required class="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-sky-100 file:text-sky-700 cursor-pointer relative z-10">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-black py-3.5 rounded-xl shadow-vip-glow transition text-sm md:text-base relative z-10">${passportBtnText}</button>
                </form>
            </div>
        `;
        if (!window.currentEditingAnnexure) {
            const pInp = document.getElementById('inpPassportNo');
            if (pInp && !pInp.value && typeof window.generateRandomPassportNo === 'function') pInp.value = window.generateRandomPassportNo();
        }
        return true;
    }

    // GAZETTE NOTIFICATION
    if (serviceName === 'gazette') {
        if (!window.currentUserData || !window.canCurrentUserSeeService('gazette')) { window.switchService(window.getFirstAllowedTab()); return true; }
        container.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 relative z-20">
                <div>
                    <h3 class="text-base md:text-lg font-black text-dark-900"><i class="fa-solid fa-newspaper text-purple-600 mr-1.5"></i> Gazette Notification (गैजेट नोटिफिकेशन • भारत का राजपत्र भाग IV)</h3>
                    <p class="text-[11px] font-bold text-slate-500">Old Name व New Name बोल्ड छपेंगे + 2 रैंडम इंडियन सेक्शन अपने-आप जुड़ेंगे • शुल्क: 100 Credits (₹100)</p>
                </div>
                <span class="bg-purple-100 text-purple-900 px-2.5 py-1 rounded-md text-[10px] font-black border border-purple-300 uppercase">100 Credits (₹100)</span>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-1 -mx-1">
                ${getWatermarkHtml('gazette')}
                <form onsubmit="window.submitForm(event, 'Gazette Notification')" class="space-y-3.5 relative z-10">
                    <input type="hidden" id="inpGazetteNo" name="GAZETTE_NO" value="CG-DL-W-2021-232514">
                    <input type="hidden" id="inpGazetteApplicantTypeHidden" name="APPLICANT_TYPE" value="ADULT">
                    <input type="hidden" id="inpGazetteChildRelHidden" name="CHILD_REL" value="son">

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <label class="block text-[11px] font-bold text-purple-800 uppercase mb-1">Applicant Category (आवेदक का प्रकार) <span class="text-red-500">*</span></label>
                            <select name="CHANGE_TYPE" onchange="window.toggleGazetteChangeMode(this.value)" class="w-full p-3 border border-purple-300 rounded-xl text-sm font-black bg-purple-50/50 focus:bg-white outline-none relative z-10 cursor-pointer">
                                <option value="ADULT_SELF">1. ADULT / SELF (वयस्क — स्वयं का नाम परिवर्तन)</option>
                                <option value="MINOR_SON">2. MINOR SON (नाबालिग बेटे का नाम परिवर्तन — माता/पिता द्वारा)</option>
                                <option value="MINOR_DAUGHTER">3. MINOR DAUGHTER (नाबालिग बेटी का नाम परिवर्तन — माता/पिता द्वारा)</option>
                            </select>
                        </div>
                        <div id="gazetteChildAgeTopWrapper" style="display: none;">
                            <label class="block text-[11px] font-bold text-amber-900 uppercase mb-1">Age of Child in Years (बच्चे की उम्र) <span class="text-red-500">*</span></label>
                            <input type="number" id="inpGazetteChildAge" name="CHILD_AGE" placeholder="e.g. 6" min="1" max="17" class="w-full p-3 border border-amber-400 rounded-xl text-sm font-black bg-amber-50/60 focus:bg-white outline-none relative z-10">
                        </div>
                        <div id="gazetteMinorFields" style="display: none;" class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl">
                            <div><label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Guardian / Parent Name (BOLD) <span class="text-red-500">*</span></label><input type="text" id="inpGazetteGuardian" name="GUARDIAN_NAME" placeholder="e.g. VISHAL SHUKLA" class="w-full p-2.5 border border-amber-300 rounded-xl text-sm font-bold bg-white outline-none uppercase"></div>
                            <div><label class="block text-[11px] font-bold text-amber-950 uppercase mb-1">Guardian's Father Name</label><input type="text" name="GUARDIAN_FATHER" placeholder="e.g. Late DAYA SHANKAR SHUKLA" class="w-full p-2.5 border border-amber-300 rounded-xl text-sm font-bold bg-white outline-none uppercase"></div>
                        </div>
                        <div><label id="lblGazetteOldName" class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Old Name (पुराना नाम / गलत नाम - BOLD) <span class="text-red-500">*</span></label><input type="text" name="OLD_NAME" placeholder="e.g. SUBRATA DAS" required class="w-full p-3 border border-slate-300 rounded-xl text-sm font-black bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div><label id="lblGazetteNewName" class="block text-[11px] font-bold text-emerald-700 uppercase mb-1">New Name (नया सही नाम - BOLD) <span class="text-red-500">*</span></label><input type="text" name="NEW_NAME" placeholder="e.g. DREYVAN DAYSE" required class="w-full p-3 border border-emerald-300 rounded-xl text-sm font-black bg-emerald-50/40 focus:bg-white outline-none uppercase relative z-10"></div>
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Relation (संबंध) <span class="text-red-500">*</span></label>
                                <select id="selGazetteRelType" name="REL_TYPE" class="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10 cursor-pointer">
                                    <option value="son of">son of (पुत्र)</option>
                                    <option value="daughter of">daughter of (पुत्री)</option>
                                    <option value="wife of">wife of (पत्नी)</option>
                                </select>
                            </div>
                            <div class="col-span-2"><label id="lblGazetteFatherName" class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Father / Husband Name (BOLD) <span class="text-red-500">*</span></label><input type="text" name="FNAME" placeholder="e.g. Late RADHA RAMAN DAS" required class="w-full p-3 border border-slate-300 rounded-xl text-sm font-black bg-slate-50 focus:bg-white outline-none uppercase relative z-10"></div>
                        </div>
                        <div><label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Occupation / Employment (पेशा — Optional)</label><input type="text" name="REASON" placeholder="e.g. Private Service / Business" class="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"></div>
                        <div class="md:col-span-2"><label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Complete Address <span class="text-red-500">*</span></label><input type="text" name="ADDRESS" placeholder="e.g. H.No. 43, Block-P, Sector-12, Noida, UP-201301" required class="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none relative z-10"></div>
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
        return true;
    }

    // DOB ORIGINAL PDF (Server-Side BRN API)
    if (serviceName === 'dob_print') {
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
        return true;
    }

    return false;
};
