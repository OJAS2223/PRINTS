// ============================================================================
// FILE: js/tools-logic.js
// Ojas Tools Studio - Core Utilities, Router & PDF Utilities (to-Image, from-Image, Merge, Unlock)
// ============================================================================

window.pdfToImgState = { pdfDoc: null, renderedImages: [] };
window.imgToPdfList = [];
window.pdfMergeList = [];
window.pdfUnlockFileBytes = null;
window.currentActiveTool = null;

window.triggerFileDownload = function(blobOrDataUrl, filename) {
    try {
        let url = '';
        let shouldRevoke = false;
        if (typeof blobOrDataUrl === 'string') {
            url = blobOrDataUrl;
        } else if (blobOrDataUrl instanceof Blob) {
            url = URL.createObjectURL(blobOrDataUrl);
            shouldRevoke = true;
        } else {
            return;
        }

        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        if (typeof link.click === 'function') link.click();
        else link.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        setTimeout(() => {
            if (link.parentNode) document.body.removeChild(link);
            if (shouldRevoke) URL.revokeObjectURL(url);
        }, 2000);
    } catch (err) {
        alert('डाउनलोड शुरू करने में समस्या आई: ' + err.message);
    }
};

window.alert = function(message, onClose) {
    let alertModal = document.getElementById('customAlertModal');
    if (!alertModal) {
        alertModal = document.createElement('div');
        alertModal.id = 'customAlertModal';
        alertModal.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-dark-950/85 backdrop-blur-sm p-4 opacity-0 pointer-events-none transition-all duration-300';
        alertModal.innerHTML = `
            <div class="bg-white dark:bg-dark-900 rounded-3xl shadow-2xl border-t-4 border-royal-500 max-w-sm w-full p-6 text-center transform scale-95 transition-transform duration-300">
                <div class="mx-auto w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden p-2">
                    <img src="/images/logo.png" alt="Ojas Logo" class="w-full h-full object-contain" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1211/1211833.png'">
                </div>
                <h2 class="text-lg font-black text-dark-900 dark:text-white mb-2">Ojas Tools Studio</h2>
                <p id="customAlertMessage" class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-6 whitespace-pre-line leading-relaxed"></p>
                <button onclick="window.closeCustomAlert()" class="bg-dark-900 hover:bg-black text-royal-300 font-black py-3 px-6 rounded-xl shadow-glow transition w-full text-sm">
                    OK, Got it!
                </button>
            </div>
        `;
        document.body.appendChild(alertModal);
    }
    window.closeCustomAlert = function() {
        alertModal.classList.remove('opacity-100', 'pointer-events-auto');
        alertModal.classList.add('opacity-0', 'pointer-events-none');
        alertModal.querySelector('div').classList.remove('scale-100');
        alertModal.querySelector('div').classList.add('scale-95');
        if (typeof onClose === 'function') {
            const cb = onClose;
            onClose = null;
            cb();
        }
    };
    document.getElementById('customAlertMessage').innerText = message;
    alertModal.classList.remove('opacity-0', 'pointer-events-none');
    alertModal.classList.add('opacity-100', 'pointer-events-auto');
    alertModal.querySelector('div').classList.remove('scale-95');
    alertModal.querySelector('div').classList.add('scale-100');
};

window.validateFileSize = function(file, customMaxMb = 100) {
    if (!file) return false;
    const maxBytes = customMaxMb * 1024 * 1024;
    if (file.size > maxBytes) {
        const fileMb = (file.size / (1024 * 1024)).toFixed(2);
        alert(`⚠️ फाइल साइज बहुत बड़ा है!\n\nचुनी गई फाइल "${file.name}" का साइज ${fileMb} MB है।\nपोर्टल पर अधिकतम ${customMaxMb} MB तक की फाइल ही मान्य है।\n\nकृपया 100 MB से छोटी फाइल चुनें।`);
        return false;
    }
    return true;
};

function dynamicallyLoadScript(url, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        const timer = setTimeout(() => { s.onload = null; s.onerror = null; reject(new Error('Timeout loading ' + url)); }, timeoutMs);
        s.onload = () => { clearTimeout(timer); resolve(true); };
        s.onerror = () => { clearTimeout(timer); reject(new Error('Failed to load ' + url)); };
        document.head.appendChild(s);
    });
}

window.getPDFLib = function() {
    if (window.PDFLib && window.PDFLib.PDFDocument) return window.PDFLib;
    if (window.PDFDocument) return { PDFDocument: window.PDFDocument };
    return null;
};

window.ensurePdfViewerLoaded = async function() {
    if (!window.pdfjsLib && !window['pdfjs-dist/build/pdf']) {
        const pdfjsSources = [
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
        ];
        for (const src of pdfjsSources) {
            try {
                await dynamicallyLoadScript(src, 4000);
                if (window.pdfjsLib || window['pdfjs-dist/build/pdf']) break;
            } catch (err) {}
        }
    }
    if (!window.pdfjsLib && window['pdfjs-dist/build/pdf']) window.pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    if (!window.pdfjsLib) throw new Error('PDF व्यूअर लाइब्रेरी (PDF.js) लोड नहीं हो सकी। कृपया इंटरनेट कनेक्शन चेक करें।');
    return true;
};

window.ensurePdfLibLoaded = async function() {
    if (!window.getPDFLib()) {
        const pdfLibSources = [
            'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
            'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
            'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
        ];
        for (const src of pdfLibSources) {
            try {
                await dynamicallyLoadScript(src, 4000);
                if (window.getPDFLib()) break;
            } catch (err) {}
        }
    }
    if (!window.getPDFLib()) throw new Error('PDF जनरेटर लाइब्रेरी (PDF-Lib) लोड नहीं हो सकी।');
    return true;
};

window.ensurePdfLibrariesLoaded = async function() {
    await window.ensurePdfViewerLoaded();
    await window.ensurePdfLibLoaded();
    return true;
};

setTimeout(() => {
    window.ensurePdfViewerLoaded().catch(() => {});
    window.ensurePdfLibLoaded().catch(() => {});
}, 300);

// ================= WORKSPACE ROUTER & FILTERS =================
window.openToolWorkspace = function(toolId) {
    window.currentActiveTool = toolId;
    const gridView = document.getElementById('toolsGridView');
    const wsView = document.getElementById('toolWorkspaceView');
    const container = document.getElementById('activeToolContainer');

    if (gridView) gridView.classList.add('hidden');
    if (wsView) wsView.classList.remove('hidden');

    document.querySelectorAll('.ws-tab-btn').forEach(btn => {
        btn.className = "ws-tab-btn px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 shrink-0 transition flex items-center gap-1.5 border border-slate-200";
    });
    const activeTab = document.getElementById(`wsTab-${toolId}`);
    if (activeTab) {
        activeTab.className = "ws-tab-btn px-3.5 py-2 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shrink-0 transition flex items-center gap-1.5 border-2 border-royal-400 shadow-glow";
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    if (container) {
        try {
            window.renderToolWorkspaceContent(toolId, container);
        } catch (err) {
            container.innerHTML = `<div class="p-6 text-center text-red-500 font-bold">टूल लोड करने में समस्या आई: ${err.message}</div>`;
        }
    }
};

window.closeToolWorkspace = function() {
    window.currentActiveTool = null;
    const gridView = document.getElementById('toolsGridView');
    const wsView = document.getElementById('toolWorkspaceView');
    const container = document.getElementById('activeToolContainer');
    if (wsView) wsView.classList.add('hidden');
    if (gridView) gridView.classList.remove('hidden');
    if (container) container.innerHTML = '';
};

window.switchWorkspaceTool = function(toolId) { window.openToolWorkspace(toolId); };

window.filterToolsCategory = function(cat) {
    const cards = document.querySelectorAll('#toolsCardsContainer .tool-card');
    ['all', 'photo', 'pdf'].forEach(b => {
        const el = document.getElementById(`catBtn-${b}`);
        if (!el) return;
        el.className = b === cat
            ? "px-3.5 py-1.5 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shadow-sm border border-royal-500/40 transition"
            : "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-200 border border-slate-200 transition";
    });
    cards.forEach(card => {
        const itemCat = card.getAttribute('data-category') || '';
        card.style.display = (cat === 'all' || itemCat.includes(cat)) ? 'flex' : 'none';
    });
};

window.filterToolsBySearch = function(query) {
    const q = String(query).trim().toLowerCase();
    document.querySelectorAll('#toolsCardsContainer .tool-card').forEach(card => {
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const text = card.innerText.toLowerCase();
        card.style.display = (!q || title.includes(q) || text.includes(q)) ? 'flex' : 'none';
    });
};

window.renderToolWorkspaceContent = function(toolId, container) {
    switch (toolId) {
        case 'passport_photo': window.setupPassportPhotoTool(container); break;
        case 'bg_remover': window.setupBgRemoverTool(container); break;
        case 'pdf_to_img': window.setupPdfToImageTool(container); break;
        case 'img_to_pdf': window.setupImageToPdfTool(container); break;
        case 'pdf_editor': window.setupPdfEditorTool(container); break;
        case 'pdf_merge': window.setupPdfMergeTool(container); break;
        case 'pdf_unlock': window.setupPdfUnlockTool(container); break;
        case 'img_compress': window.setupImageCompressorTool(container); break;
        default: container.innerHTML = '<div class="p-6 text-center text-red-500 font-bold">Unknown Tool</div>';
    }
};

// ============================================================================
// TOOL 3: PDF TO HIGH-RES IMAGE
// ============================================================================
window.setupPdfToImageTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center text-lg font-black">
                    <i class="fa-solid fa-file-image"></i>
                </div>
                <div>
                    <h2 class="text-base md:text-lg font-black text-dark-900">PDF to High-Res Image Converter</h2>
                    <p class="text-[11px] font-semibold text-slate-400">300+ से 800 DPI अल्ट्रा-क्लियर रेंडरिंग • PNG / JPG एक्सपोर्ट</p>
                </div>
            </div>

            <div id="pdfImgUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('pdfImgFileInput').click()">
                <input type="file" id="pdfImgFileInput" accept="application/pdf" class="hidden" onchange="window.handlePdfToImgUpload(this.files[0])">
                <div class="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-indigo-200">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ अपनी PDF फाइल अपलोड करें</h3>
                <p class="text-xs font-semibold text-slate-400">केवल PDF फाइल</p>
            </div>

            <div id="pdfImgWorkspaceSection" class="hidden space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div class="flex items-center gap-3">
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">DPI / रेज़ोल्यूशन क्वालिटी</label>
                            <select id="pdfRenderDpi" onchange="window.renderPdfPagesToImages()" class="p-2 border border-slate-200 rounded-xl text-xs font-black bg-white outline-none">
                                <option value="1.5">150 DPI (Fast Web)</option>
                                <option value="3.0" selected>300 DPI (High-Quality Print)</option>
                                <option value="6.0">600 DPI (Ultra-Sharp HD)</option>
                                <option value="8.0">800 DPI (Extreme Resolution)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">फॉर्मेट</label>
                            <select id="pdfImgFormat" class="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none">
                                <option value="png">PNG (Lossless Sharp)</option>
                                <option value="jpg">JPG (High Quality)</option>
                            </select>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <button type="button" id="btnDownloadAllPdfImgs" onclick="window.downloadAllPdfImagesZip()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2.5 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5">
                            <i class="fa-solid fa-file-zipper"></i> Download All as ZIP
                        </button>
                        <button type="button" onclick="document.getElementById('pdfImgFileInput').click()" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2.5 rounded-xl text-xs transition">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                    </div>
                </div>
                <div id="pdfPagesStatusText" class="text-xs font-bold text-indigo-700"></div>
                <div id="pdfPagesContainer" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"></div>
            </div>
        </div>
    `;
};

window.handlePdfToImgUpload = async function(file) {
    if (!file || !window.validateFileSize(file, 100)) return;
    try {
        await window.ensurePdfViewerLoaded();
        const arrayBuffer = await file.arrayBuffer();
        const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        window.pdfToImgState.pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        document.getElementById('pdfImgUploadBox').classList.add('hidden');
        document.getElementById('pdfImgWorkspaceSection').classList.remove('hidden');
        window.renderPdfPagesToImages();
    } catch (err) {
        alert('PDF लोड करने में समस्या आई: ' + err.message);
    }
};

window.renderPdfPagesToImages = async function() {
    const pdfDoc = window.pdfToImgState.pdfDoc;
    const container = document.getElementById('pdfPagesContainer');
    const statusText = document.getElementById('pdfPagesStatusText');
    if (!pdfDoc || !container) return;

    const scale = parseFloat(document.getElementById('pdfRenderDpi')?.value || 3.0);
    const numPages = pdfDoc.numPages;
    statusText.innerText = `कुल ${numPages} पेज मिलें। हाई-DPI स्केल (${scale}x) पर प्रोसेस हो रहा है...`;
    container.innerHTML = '';
    window.pdfToImgState.renderedImages = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/png');
        window.pdfToImgState.renderedImages.push({ pageNum, dataUrl: imgDataUrl });

        const card = document.createElement('div');
        card.className = "bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2";
        card.innerHTML = `
            <div class="space-y-1">
                <span class="text-[10px] font-black text-slate-500 uppercase">Page ${pageNum} of ${numPages}</span>
                <div class="bg-white p-1 rounded-xl border border-slate-200 overflow-hidden">
                    <img src="${imgDataUrl}" class="w-full h-auto object-contain max-h-64 mx-auto rounded">
                </div>
            </div>
            <button type="button" onclick="window.downloadSinglePdfImage(${pageNum})" class="w-full bg-dark-900 hover:bg-black text-royal-300 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1">
                <i class="fa-solid fa-download"></i> Download Page ${pageNum}
            </button>
        `;
        container.appendChild(card);
    }
    statusText.innerText = `✅ सभी ${numPages} पेज सफलतापूर्वक हाई-DPI में रेंडर हो गए हैं!`;
};

window.downloadSinglePdfImage = function(pageNum) {
    const item = window.pdfToImgState.renderedImages.find(i => i.pageNum === pageNum);
    if (!item) return;
    const fmt = document.getElementById('pdfImgFormat')?.value || 'png';
    window.triggerFileDownload(item.dataUrl, `Page_${pageNum}_HighDPI.${fmt}`);
};

window.downloadAllPdfImagesZip = async function() {
    const list = window.pdfToImgState.renderedImages;
    if (list.length === 0) return alert('डाउनलोड करने के लिए कोई इमेज नहीं है!');
    const btn = document.getElementById('btnDownloadAllPdfImgs');
    const origHtml = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';
    try {
        await window.ensurePdfLibrariesLoaded();
        const zip = new window.JSZip();
        const fmt = document.getElementById('pdfImgFormat')?.value || 'png';
        list.forEach(item => { zip.file(`Page_${item.pageNum}.${fmt}`, item.dataUrl.split(',')[1], { base64: true }); });
        const content = await zip.generateAsync({ type: 'blob' });
        window.triggerFileDownload(content, `All_Pages_HighDPI_${Date.now()}.zip`);
    } catch (e) {
        alert('ZIP बनाने में समस्या आई: ' + e.message);
    } finally {
        btn.disabled = false; btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 4: IMAGE TO PDF CONVERTER
// ============================================================================
window.setupImageToPdfTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div class="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center text-lg font-black">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div>
                    <h2 class="text-base md:text-lg font-black text-dark-900">Image to PDF Converter</h2>
                    <p class="text-[11px] font-semibold text-slate-400">एक या अधिक फोटो को क्रमबद्ध तरीके से A4 साइज प्रिंटेबल पीडीएफ में बदलें</p>
                </div>
            </div>

            <div class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('imgPdfFileInput').click()">
                <input type="file" id="imgPdfFileInput" accept="image/*" multiple class="hidden" onchange="window.handleImageToPdfUpload(this.files)">
                <div class="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-sky-200">
                    <i class="fa-solid fa-images"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ फोटो चुनें (एक साथ कई फोटो चुन सकते हैं)</h3>
                <p class="text-xs font-semibold text-slate-400">JPG, PNG</p>
            </div>

            <div id="imgPdfWorkspace" class="hidden space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div class="flex items-center gap-3">
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">पेज ओरिएंटेशन</label>
                            <select id="imgPdfOrientation" class="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none">
                                <option value="portrait" selected>Portrait (सीधा A4)</option>
                                <option value="landscape">Landscape (आड़ा A4)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">मार्जिन (Margin)</label>
                            <select id="imgPdfMargin" class="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none">
                                <option value="15" selected>Standard (15mm)</option>
                                <option value="0">No Margin (Full Page)</option>
                            </select>
                        </div>
                    </div>
                    <button type="button" id="btnGenerateImgPdf" onclick="window.generatePdfFromImages()" class="bg-sky-600 hover:bg-sky-700 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5">
                        <i class="fa-solid fa-file-arrow-down"></i> Convert &amp; Download PDF
                    </button>
                </div>
                <div id="imgPdfListContainer" class="space-y-2"></div>
            </div>
        </div>
    `;
};

window.handleImageToPdfUpload = function(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!window.validateFileSize(file, 100)) continue;
        const reader = new FileReader();
        reader.onload = (e) => {
            window.imgToPdfList.push({ name: file.name, dataUrl: e.target.result });
            window.renderImgToPdfList();
        };
        reader.readAsDataURL(file);
    }
};

window.renderImgToPdfList = function() {
    const ws = document.getElementById('imgPdfWorkspace');
    const container = document.getElementById('imgPdfListContainer');
    if (!ws || !container) return;
    if (window.imgToPdfList.length > 0) ws.classList.remove('hidden');
    else { ws.classList.add('hidden'); return; }

    container.innerHTML = '';
    window.imgToPdfList.forEach((item, index) => {
        container.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm gap-2">
                <div class="flex items-center gap-3 overflow-hidden">
                    <span class="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">${index + 1}</span>
                    <img src="${item.dataUrl}" class="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0">
                    <span class="text-xs font-bold text-slate-800 truncate">${item.name}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="window.moveImgToPdfOrder(${index}, -1)" class="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" onclick="window.moveImgToPdfOrder(${index}, 1)" class="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" onclick="window.removeImgToPdfItem(${index})" class="w-7 h-7 bg-red-50 hover:bg-red-600 text-red-500 hover:text-white rounded-lg text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.moveImgToPdfOrder = function(idx, dir) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= window.imgToPdfList.length) return;
    const temp = window.imgToPdfList[idx];
    window.imgToPdfList[idx] = window.imgToPdfList[targetIdx];
    window.imgToPdfList[targetIdx] = temp;
    window.renderImgToPdfList();
};

window.removeImgToPdfItem = function(idx) {
    window.imgToPdfList.splice(idx, 1);
    window.renderImgToPdfList();
};

window.generatePdfFromImages = async function() {
    if (window.imgToPdfList.length === 0) return alert('कृपया पहले कम से कम 1 फोटो अपलोड करें!');
    const btn = document.getElementById('btnGenerateImgPdf');
    const origHtml = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating PDF...';
    try {
        await window.ensurePdfLibLoaded();
        const { PDFDocument } = window.getPDFLib();
        const pdfDoc = await PDFDocument.create();
        const orientation = document.getElementById('imgPdfOrientation')?.value || 'portrait';
        const margin = parseFloat(document.getElementById('imgPdfMargin')?.value || 15);
        const a4Width = orientation === 'portrait' ? 595.28 : 841.89;
        const a4Height = orientation === 'portrait' ? 841.89 : 595.28;

        for (const item of window.imgToPdfList) {
            const page = pdfDoc.addPage([a4Width, a4Height]);
            const embeddedImage = item.dataUrl.includes('image/png') ? await pdfDoc.embedPng(item.dataUrl) : await pdfDoc.embedJpg(item.dataUrl);
            const scale = Math.min((a4Width - 2 * margin) / embeddedImage.width, (a4Height - 2 * margin) / embeddedImage.height);
            const drawW = embeddedImage.width * scale, drawH = embeddedImage.height * scale;
            page.drawImage(embeddedImage, { x: (a4Width - drawW) / 2, y: (a4Height - drawH) / 2, width: drawW, height: drawH });
        }

        const pdfBytes = await pdfDoc.save();
        window.triggerFileDownload(new Blob([pdfBytes], { type: 'application/pdf' }), `Images_${Date.now()}.pdf`);
    } catch (e) {
        alert('PDF बनाने में त्रुटि: ' + e.message);
    } finally {
        btn.disabled = false; btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 6: MERGE PDF
// ============================================================================
window.setupPdfMergeTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center text-lg font-black">
                    <i class="fa-solid fa-object-group"></i>
                </div>
                <div>
                    <h2 class="text-base md:text-lg font-black text-dark-900">Merge PDF Files (पीडीएफ जोड़ें)</h2>
                    <p class="text-[11px] font-semibold text-slate-400">कई PDF फाइलों को अपनी पसंद के क्रम में जोड़कर एक बनाएं</p>
                </div>
            </div>

            <div class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('pdfMergeFileInput').click()">
                <input type="file" id="pdfMergeFileInput" accept="application/pdf" multiple class="hidden" onchange="window.handlePdfMergeUpload(this.files)">
                <div class="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-purple-200">
                    <i class="fa-solid fa-copy"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ PDF फाइलें चुनें (एक साथ 2 या अधिक फाइलें चुनें)</h3>
                <p class="text-xs font-semibold text-slate-400">2 या अधिक PDF फाइलें जोड़ें</p>
            </div>

            <div id="pdfMergeWorkspace" class="hidden space-y-4">
                <div class="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span id="pdfMergeCountText" class="text-xs font-black text-purple-900">2 फाइलें चुनी गईं</span>
                    <button type="button" id="btnMergePdfs" onclick="window.executePdfMerge()" class="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-2.5 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5">
                        <i class="fa-solid fa-object-group"></i> Merge &amp; Download PDF
                    </button>
                </div>
                <div id="pdfMergeFilesList" class="space-y-2"></div>
            </div>
        </div>
    `;
};

window.handlePdfMergeUpload = async function(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!window.validateFileSize(file, 100)) continue;
        window.pdfMergeList.push({ name: file.name, size: file.size, bytes: await file.arrayBuffer() });
    }
    window.renderPdfMergeList();
};

window.renderPdfMergeList = function() {
    const ws = document.getElementById('pdfMergeWorkspace');
    const container = document.getElementById('pdfMergeFilesList');
    const countEl = document.getElementById('pdfMergeCountText');
    if (!ws || !container) return;
    if (window.pdfMergeList.length > 0) {
        ws.classList.remove('hidden');
        if (countEl) countEl.innerText = `कुल ${window.pdfMergeList.length} फाइलें जोड़ी जाएँगी`;
    } else { ws.classList.add('hidden'); return; }

    container.innerHTML = '';
    window.pdfMergeList.forEach((item, idx) => {
        container.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm gap-2">
                <div class="flex items-center gap-3 overflow-hidden">
                    <span class="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">${idx + 1}</span>
                    <i class="fa-solid fa-file-pdf text-purple-600 text-lg"></i>
                    <div>
                        <p class="text-xs font-bold text-slate-800 truncate">${item.name}</p>
                        <span class="text-[10px] text-slate-400 font-semibold">${(item.size / 1024).toFixed(1)} KB</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="window.movePdfMergeOrder(${idx}, -1)" class="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" onclick="window.movePdfMergeOrder(${idx}, 1)" class="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" onclick="window.removePdfMergeItem(${idx})" class="w-7 h-7 bg-red-50 hover:bg-red-600 text-red-500 hover:text-white rounded-lg text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.movePdfMergeOrder = function(idx, dir) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= window.pdfMergeList.length) return;
    const temp = window.pdfMergeList[idx];
    window.pdfMergeList[idx] = window.pdfMergeList[targetIdx];
    window.pdfMergeList[targetIdx] = temp;
    window.renderPdfMergeList();
};

window.removePdfMergeItem = function(idx) {
    window.pdfMergeList.splice(idx, 1);
    window.renderPdfMergeList();
};

window.executePdfMerge = async function() {
    if (window.pdfMergeList.length < 2) return alert('मर्ज करने के लिए कम से कम 2 PDF फाइलें होना जरूरी है!');
    const btn = document.getElementById('btnMergePdfs');
    const origHtml = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Merging...';
    try {
        await window.ensurePdfLibLoaded();
        const { PDFDocument } = window.getPDFLib();
        const mergedDoc = await PDFDocument.create();
        for (const item of window.pdfMergeList) {
            const docToMerge = await PDFDocument.load(item.bytes.slice(0));
            const copiedPages = await mergedDoc.copyPages(docToMerge, docToMerge.getPageIndices());
            copiedPages.forEach((page) => mergedDoc.addPage(page));
        }
        const mergedBytes = await mergedDoc.save();
        window.triggerFileDownload(new Blob([mergedBytes], { type: 'application/pdf' }), `Merged_Document_${Date.now()}.pdf`);
    } catch (e) {
        alert('मर्ज करने में त्रुटि: ' + e.message);
    } finally {
        btn.disabled = false; btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 7: UNLOCK PDF
// ============================================================================
window.setupPdfUnlockTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4 max-w-lg mx-auto">
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center text-lg font-black">
                    <i class="fa-solid fa-lock-open"></i>
                </div>
                <div>
                    <h2 class="text-base md:text-lg font-black text-dark-900">PDF Password Unlocker</h2>
                    <p class="text-[11px] font-semibold text-slate-400">पासवर्ड हटाकर बिना लॉक वाली सामान्य PDF बनाएं</p>
                </div>
            </div>

            <div id="pdfUnlockUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('pdfUnlockFileInput').click()">
                <input type="file" id="pdfUnlockFileInput" accept="application/pdf" class="hidden" onchange="window.handlePdfUnlockUpload(this.files[0])">
                <div class="w-14 h-14 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-teal-200">
                    <i class="fa-solid fa-file-shield"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">लॉक PDF फाइल यहाँ चुनें</h3>
                <p class="text-xs font-semibold text-slate-400">पासवर्ड प्रोटेक्टेड PDF चुनें</p>
            </div>

            <div id="pdfUnlockFormSection" class="hidden bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div>
                    <label class="block text-xs font-bold text-slate-600 uppercase mb-1">PDF का पासवर्ड दर्ज करें</label>
                    <input type="password" id="pdfUnlockPassInput" placeholder="Password लिखें" class="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold bg-white outline-none">
                </div>
                <button type="button" id="btnUnlockPdf" onclick="window.executePdfUnlock()" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-key"></i> Unlock &amp; Download Clean PDF
                </button>
            </div>
        </div>
    `;
};

window.handlePdfUnlockUpload = async function(file) {
    if (!file || !window.validateFileSize(file, 100)) return;
    window.pdfUnlockFileBytes = await file.arrayBuffer();
    document.getElementById('pdfUnlockUploadBox').classList.add('hidden');
    document.getElementById('pdfUnlockFormSection').classList.remove('hidden');
};

window.executePdfUnlock = async function() {
    const pass = document.getElementById('pdfUnlockPassInput')?.value;
    if (!pass) return alert('कृपया पासवर्ड दर्ज करें!');
    const btn = document.getElementById('btnUnlockPdf');
    const origHtml = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Unlocking PDF...';

    try {
        await window.ensurePdfViewerLoaded();
        await window.ensurePdfLibLoaded();
        const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];

        let pdfDoc;
        try {
            pdfDoc = await pdfjs.getDocument({ data: window.pdfUnlockFileBytes.slice(0), password: pass }).promise;
        } catch (decryptErr) {
            const msg = String(decryptErr?.message || decryptErr || '');
            if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('need')) {
                throw new Error('दर्ज किया गया पासवर्ड गलत है!\n\nकृपया सही पासवर्ड दोबारा चेक करके डालें।');
            }
            throw new Error('PDF डिक्रिप्ट नहीं हो सकी: ' + msg);
        }

        const { PDFDocument } = window.getPDFLib();
        const cleanDoc = await PDFDocument.create();

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.5 });
            const naturalViewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const embeddedImg = await cleanDoc.embedJpg(canvas.toDataURL('image/jpeg', 0.98));
            const newPage = cleanDoc.addPage([naturalViewport.width, naturalViewport.height]);
            newPage.drawImage(embeddedImg, { x: 0, y: 0, width: naturalViewport.width, height: naturalViewport.height });
        }

        const cleanBytes = await cleanDoc.save();
        window.triggerFileDownload(new Blob([cleanBytes], { type: 'application/pdf' }), `Unlocked_Document_${Date.now()}.pdf`);
        setTimeout(() => alert('🎉 सफलता! आपकी PDF का पासवर्ड हमेशा के लिए हटा दिया गया है और अनलॉक PDF डाउनलोड हो गई है।'), 300);
    } catch (e) {
        alert(e.message || 'PDF अनलॉक करने में समस्या आई।');
    } finally {
        btn.disabled = false; btn.innerHTML = origHtml;
    }
};
