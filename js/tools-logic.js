// ============================================================================
// Ojas Tools Studio - Complete Logic Suite (tools-logic.js)
// 100% Client-Side, Multi-CDN Robust Loaders, High-DPI & A4 PDF Editor
// ============================================================================

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB limit

// Global State Objects Initialization
window.ppState = { originalImg: null, processedImageCanvas: null, bgColor: '#ffffff', activeMode: 'wand', brushSize: 20 };
window.bgRemoverState = { img: null, targetColor: '#ffffff', viewZoom: 1.0, undoStack: [] };
window.pdfToImgState = { pdfDoc: null, renderedImages: [] };
window.imgToPdfList = [];
window.pdfEditorState = {
    pdfDoc: null, currentPage: 1, scale: 2.0, activeMode: 'click_edit',
    currentActiveItem: null, boxStartX: 0, boxStartY: 0, isDraggingBox: false,
    pageCanvasMap: {}, pageDimsMap: {}, viewZoom: 1.0, undoStack: []
};
window.pdfMergeList = [];
window.pdfUnlockFileBytes = null;
window.compressorState = { file: null, img: null, resultBlobUrl: null, viewZoom: 1.0 };

// Universal Robust File Downloader
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
            console.error('Invalid download payload:', blobOrDataUrl);
            return;
        }

        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        
        if (typeof link.click === 'function') {
            link.click();
        } else {
            const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
            link.dispatchEvent(evt);
        }

        setTimeout(() => {
            if (link.parentNode) {
                document.body.removeChild(link);
            }
            if (shouldRevoke) {
                URL.revokeObjectURL(url);
            }
        }, 2000);
    } catch (err) {
        console.error('Download error:', err);
        alert('डाउनलोड शुरू करने में समस्या आई: ' + err.message);
    }
};

window.alert = function(message) {
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
    alertModal.querySelector('div').classList.remove('scale-100');
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
        let timer = setTimeout(() => {
            s.onload = null;
            s.onerror = null;
            reject(new Error('Timeout loading ' + url));
        }, timeoutMs);
        s.onload = () => {
            clearTimeout(timer);
            resolve(true);
        };
        s.onerror = () => {
            clearTimeout(timer);
            reject(new Error('Failed to load ' + url));
        };
        document.head.appendChild(s);
    });
}

window.getPDFLib = function() {
    if (window.PDFLib && window.PDFLib.PDFDocument) {
        return window.PDFLib;
    }
    if (window.PDFDocument) {
        return { PDFDocument: window.PDFDocument };
    }
    return null;
};

window.ensurePdfViewerLoaded = async function() {
    if (!window.pdfjsLib && !window['pdfjs-dist/build/pdf']) {
        const pdfjsSources = [
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
            'https://fastly.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
        ];
        for (const src of pdfjsSources) {
            try {
                await dynamicallyLoadScript(src, 4000);
                if (window.pdfjsLib || window['pdfjs-dist/build/pdf']) break;
            } catch (err) {}
        }
    }
    if (!window.pdfjsLib && window['pdfjs-dist/build/pdf']) {
        window.pdfjsLib = window['pdfjs-dist/build/pdf'];
    }
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    if (!window.pdfjsLib) {
        throw new Error('PDF व्यूअर लाइब्रेरी (PDF.js) लोड नहीं हो सकी। कृपया इंटरनेट कनेक्शन चेक करें।');
    }
    return true;
};

window.ensurePdfLibLoaded = async function() {
    if (!window.getPDFLib()) {
        const pdfLibSources = [
            'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
            'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
            'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
            'https://fastly.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
        ];
        for (const src of pdfLibSources) {
            try {
                await dynamicallyLoadScript(src, 4000);
                if (window.getPDFLib()) break;
            } catch (err) {}
        }
    }
    if (!window.getPDFLib()) {
        throw new Error('PDF जनरेटर लाइब्रेरी (PDF-Lib) लोड नहीं हो सकी। कृपया इंटरनेट कनेक्शन या AdBlocker सेटिंग्स चेक करें।');
    }
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

window.currentActiveTool = null;

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
            console.error('Error rendering tool workspace:', err);
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

window.switchWorkspaceTool = function(toolId) {
    window.openToolWorkspace(toolId);
};

window.filterToolsCategory = function(cat) {
    const cards = document.querySelectorAll('#toolsCardsContainer .tool-card');
    const btns = ['all', 'photo', 'pdf'];
    btns.forEach(b => {
        const el = document.getElementById(`catBtn-${b}`);
        if (!el) return;
        if (b === cat) {
            el.className = "px-3.5 py-1.5 rounded-xl text-xs font-black bg-dark-900 text-royal-300 shadow-sm border border-royal-500/40 transition";
        } else {
            el.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-200 border border-slate-200 transition";
        }
    });

    cards.forEach(card => {
        const itemCat = card.getAttribute('data-category') || '';
        if (cat === 'all' || itemCat.includes(cat)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.filterToolsBySearch = function(query) {
    const q = String(query).trim().toLowerCase();
    const cards = document.querySelectorAll('#toolsCardsContainer .tool-card');
    cards.forEach(card => {
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const text = card.innerText.toLowerCase();
        if (!q || title.includes(q) || text.includes(q)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.renderToolWorkspaceContent = function(toolId, container) {
    switch (toolId) {
        case 'passport_photo':
            window.setupPassportPhotoTool(container);
            break;
        case 'bg_remover':
            window.setupBgRemoverTool(container);
            break;
        case 'pdf_to_img':
            window.setupPdfToImageTool(container);
            break;
        case 'img_to_pdf':
            window.setupImageToPdfTool(container);
            break;
        case 'pdf_editor':
            window.setupPdfEditorTool(container);
            break;
        case 'pdf_merge':
            window.setupPdfMergeTool(container);
            break;
        case 'pdf_unlock':
            window.setupPdfUnlockTool(container);
            break;
        case 'img_compress':
            window.setupImageCompressorTool(container);
            break;
        default:
            container.innerHTML = '<div class="p-6 text-center text-red-500 font-bold">Unknown Tool</div>';
    }
};

window.setupPassportPhotoTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-lg font-black">
                        <i class="fa-solid fa-id-badge"></i>
                    </div>
                    <div>
                        <h2 class="text-base md:text-lg font-black text-dark-900">पासपोर्ट साइज फोटो मेकर (Passport Photo Studio)</h2>
                        <p class="text-[11px] font-semibold text-slate-400">3.5 × 4.5 cm स्टैंडर्ड साइज • वाइट, लाइट पिंक, लाइट रेड व कस्टम BG • A4 टॉप-रो 6 फोटो</p>
                    </div>
                </div>
            </div>

            <div id="ppUploadSection" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('ppFileInput').click()">
                <input type="file" id="ppFileInput" accept="image/*" class="hidden" onchange="window.handlePassportPhotoUpload(this.files[0])">
                <div class="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-amber-200">
                    <i class="fa-solid fa-camera"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ अपनी फोटो अपलोड करें</h3>
                <p class="text-xs font-semibold text-slate-400">JPG, PNG, WEBP</p>
            </div>

            <div id="ppEditorSection" class="hidden grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div class="lg:col-span-5 space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                        <div class="flex justify-between items-center mb-1.5">
                            <label class="text-[11px] font-black text-slate-700 uppercase">1. बैकग्राउंड का रंग</label>
                            <span class="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black">Color Applied</span>
                        </div>
                        <div class="grid grid-cols-4 gap-1.5">
                            <button type="button" onclick="window.setPassportBgColor('#ffffff', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-black bg-white text-dark-900 border-2 border-amber-400 flex items-center justify-center gap-1 shadow-sm">
                                <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-white"></span> White
                            </button>
                            <button type="button" onclick="window.setPassportBgColor('#ffd1dc', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1">
                                <span class="w-3.5 h-3.5 rounded-full border border-pink-300 bg-[#ffd1dc]"></span> Lt. Pink
                            </button>
                            <button type="button" onclick="window.setPassportBgColor('#ffcccc', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1">
                                <span class="w-3.5 h-3.5 rounded-full border border-red-300 bg-[#ffcccc]"></span> Lt. Red
                            </button>
                            <button type="button" onclick="window.setPassportBgColor('#b9dcff', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1">
                                <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-sky-200"></span> Blue
                            </button>
                            <button type="button" onclick="window.setPassportBgColor('#f3f4f6', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1">
                                <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-slate-200"></span> Gray
                            </button>
                            <button type="button" onclick="window.setPassportBgColor('#cc0000', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1">
                                <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-red-600"></span> Red
                            </button>
                            <button type="button" onclick="window.setPassportBgColor('original', this)" class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1">
                                <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-slate-400"></span> Orig
                            </button>
                            <label class="pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1 cursor-pointer">
                                <input type="color" id="ppCustomColorPicker" value="#ffffff" onchange="window.setPassportBgColor(this.value, null)" class="w-3.5 h-3.5 p-0 border-0 rounded cursor-pointer">
                                <span>Custom</span>
                            </label>
                        </div>
                    </div>

                    <div class="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div class="flex justify-between items-center text-[11px] font-bold text-slate-600">
                            <span>सेंसिटिविटी:</span>
                            <span id="ppBgTolVal" class="text-amber-600 font-black">35</span>
                        </div>
                        <input type="range" id="ppBgTolerance" min="10" max="80" value="35" oninput="window.updatePassportTolerance(this.value)" class="w-full accent-amber-500 cursor-pointer">
                        <div class="flex items-center gap-2 pt-1">
                            <button type="button" onclick="window.togglePassportMagicWand()" id="btnPpMagicWand" class="flex-1 bg-amber-400 text-dark-950 border border-amber-500 py-1.5 px-2 rounded-lg text-[11px] font-black shadow-sm flex items-center justify-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> मैजिक वैंड
                            </button>
                            <button type="button" onclick="window.togglePassportWhiteBrush()" id="btnPpWhiteBrush" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1">
                                <i class="fa-solid fa-paintbrush text-royal-600"></i> टच-अप ब्रश
                            </button>
                        </div>
                    </div>

                    <div class="space-y-2.5 p-3 bg-white rounded-xl border border-slate-200">
                        <div>
                            <div class="flex justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                                <span>Zoom:</span>
                                <span id="ppZoomVal">1.0x</span>
                            </div>
                            <input type="range" id="ppZoomSlider" min="0.5" max="3" step="0.05" value="1" oninput="window.renderPassportStudio()" class="w-full accent-amber-500 cursor-pointer">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Vertical</label>
                                <input type="range" id="ppPanYSlider" min="-250" max="250" step="2" value="0" oninput="window.renderPassportStudio()" class="w-full accent-amber-500 cursor-pointer">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Horizontal</label>
                                <input type="range" id="ppPanXSlider" min="-250" max="250" step="2" value="0" oninput="window.renderPassportStudio()" class="w-full accent-amber-500 cursor-pointer">
                            </div>
                        </div>
                    </div>

                    <div class="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">प्रिंट शीट लेआउट</label>
                            <select id="ppSheetLayout" onchange="window.renderPassportStudio()" class="w-full p-2.5 border-2 border-amber-300 rounded-xl text-xs font-black bg-amber-50/40 text-amber-950 outline-none cursor-pointer">
                                <option value="sheet_a4_row1" selected>⭐ A4 1 लाइन - 6 फोटो</option>
                                <option value="sheet_a4_row2">A4 2 लाइन - 12 फोटो</option>
                                <option value="sheet_a4_row3">A4 3 लाइन - 18 फोटो</option>
                                <option value="sheet_a4_full">A4 फुल शीट - 30 फोटो</option>
                                <option value="sheet_4x6">4 × 6 Inch Sheet - 8 फोटो</option>
                                <option value="single">Single Photo (3.5 × 4.5 cm)</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2 pt-1">
                        <button type="button" onclick="window.downloadPassportPdf()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-file-pdf"></i> Download PDF
                        </button>
                        <button type="button" onclick="window.downloadPassportOutput('jpg')" class="bg-dark-900 hover:bg-black text-royal-300 font-black py-3 rounded-xl text-xs transition shadow-glow flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-download"></i> JPG Image
                        </button>
                        <button type="button" onclick="window.printPassportCanvas()" class="bg-amber-500 hover:bg-amber-600 text-dark-950 font-black py-3 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-print"></i> Direct Print
                        </button>
                    </div>
                </div>

                <div class="lg:col-span-7 bg-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center min-h-[500px] overflow-auto">
                    <canvas id="ppMainCanvas" class="bg-white shadow-xl rounded-lg max-w-full h-auto border border-slate-300"></canvas>
                </div>
            </div>
        </div>
    `;
};

window.ppState = {
    originalImg: null,
    processedImageCanvas: null,
    bgColor: '#ffffff',
    activeMode: 'wand',
    brushSize: 20
};

window.hexToRgb = function(hex) {
    if (!hex || hex === 'original') return { r: 255, g: 255, b: 255 };
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        return {
            r: parseInt(cleanHex[0] + cleanHex[0], 16),
            g: parseInt(cleanHex[1] + cleanHex[1], 16),
            b: parseInt(cleanHex[2] + cleanHex[2], 16)
        };
    }
    const val = parseInt(cleanHex, 16);
    return {
        r: (val >> 16) & 255,
        g: (val >> 8) & 255,
        b: val & 255
    };
};

window.handlePassportPhotoUpload = function(file) {
    if (!file || !window.validateFileSize(file, 100)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.ppState.originalImg = img;
            document.getElementById('ppUploadSection').classList.add('hidden');
            document.getElementById('ppEditorSection').classList.remove('hidden');
            window.processPassportWhiteBackground();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.setPassportBgColor = function(color, btnEl) {
    window.ppState.bgColor = color;
    document.querySelectorAll('.pp-bg-btn').forEach(b => {
        b.className = "pp-bg-btn p-2 rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1";
    });
    if (btnEl) btnEl.className = "pp-bg-btn p-2 rounded-xl text-[11px] font-black bg-white text-dark-900 border-2 border-amber-400 flex items-center justify-center gap-1 shadow-sm";
    window.processPassportWhiteBackground();
};

window.updatePassportTolerance = function(val) {
    const el = document.getElementById('ppBgTolVal');
    if (el) el.innerText = val;
    window.processPassportWhiteBackground();
};

window.processPassportWhiteBackground = function() {
    const img = window.ppState.originalImg;
    if (!img) return;

    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (window.ppState.bgColor === 'original') {
        window.ppState.processedImageCanvas = off;
        window.renderPassportStudio();
        return;
    }

    const imgData = ctx.getImageData(0, 0, off.width, off.height);
    const d = imgData.data;
    const w = off.width, h = off.height;
    const tol = parseInt(document.getElementById('ppBgTolerance')?.value || 35);
    const tolSq = tol * tol * 3;

    let sampleR = 0, sampleG = 0, sampleB = 0, samplesCount = 0;
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 40))) {
        for (let y = 0; y < Math.min(h * 0.15, 35); y += 3) {
            const idx = (y * w + x) * 4;
            sampleR += d[idx]; sampleG += d[idx + 1]; sampleB += d[idx + 2];
            samplesCount++;
        }
    }
    const bgR = Math.round(sampleR / samplesCount);
    const bgG = Math.round(sampleG / samplesCount);
    const bgB = Math.round(sampleB / samplesCount);

    const targetRgb = window.hexToRgb(window.ppState.bgColor || '#ffffff');
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dist = (r - bgR) * (r - bgR) + (g - bgG) * (g - bgG) + (b - bgB) * (b - bgB);
        if (dist <= tolSq) {
            d[i] = targetRgb.r; d[i + 1] = targetRgb.g; d[i + 2] = targetRgb.b;
        }
    }

    ctx.putImageData(imgData, 0, 0);
    window.ppState.processedImageCanvas = off;
    window.renderPassportStudio();
};

window.renderPassportStudio = function() {
    const canvas = document.getElementById('ppMainCanvas');
    if (!canvas || !window.ppState.processedImageCanvas) return;

    const img = window.ppState.processedImageCanvas;
    const zoom = parseFloat(document.getElementById('ppZoomSlider')?.value || 1);
    const panX = parseFloat(document.getElementById('ppPanXSlider')?.value || 0);
    const panY = parseFloat(document.getElementById('ppPanYSlider')?.value || 0);
    const layout = document.getElementById('ppSheetLayout')?.value || 'sheet_a4_row1';

    const photoW = 413, photoH = 531;
    const singleCanvas = document.createElement('canvas');
    singleCanvas.width = photoW; singleCanvas.height = photoH;
    const sCtx = singleCanvas.getContext('2d');

    sCtx.fillStyle = window.ppState.bgColor === 'original' ? '#ffffff' : (window.ppState.bgColor || '#ffffff');
    sCtx.fillRect(0, 0, photoW, photoH);

    sCtx.save();
    sCtx.translate(photoW / 2 + panX, photoH / 2 + panY);
    sCtx.scale(zoom, zoom);
    const imgAspect = img.width / img.height;
    let drawW = photoW, drawH = photoW / imgAspect;
    if (drawH < photoH) { drawH = photoH; drawW = photoH * imgAspect; }
    sCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    sCtx.restore();

    sCtx.strokeStyle = '#cccccc';
    sCtx.lineWidth = 2;
    sCtx.strokeRect(1, 1, photoW - 2, photoH - 2);

    const ctx = canvas.getContext('2d');
    if (layout === 'single') {
        canvas.width = photoW; canvas.height = photoH;
        ctx.drawImage(singleCanvas, 0, 0);
    } else {
        canvas.width = 2480; canvas.height = 3508;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const a4PhotoW = 385, a4PhotoH = 495, gapX = 16, gapY = 24, startX = 45, startY = 70;
        let totalRows = 1;
        if (layout === 'sheet_a4_row2') totalRows = 2;
        else if (layout === 'sheet_a4_row3') totalRows = 3;
        else if (layout === 'sheet_a4_full') totalRows = 5;

        for (let row = 0; row < totalRows; row++) {
            for (let col = 0; col < 6; col++) {
                const x = startX + col * (a4PhotoW + gapX);
                const y = startY + row * (a4PhotoH + gapY);
                ctx.drawImage(singleCanvas, x, y, a4PhotoW, a4PhotoH);
                ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1;
                ctx.strokeRect(x - 1, y - 1, a4PhotoW + 2, a4PhotoH + 2);
            }
        }
    }
};

window.downloadPassportOutput = function(format = 'jpg') {
    const canvas = document.getElementById('ppMainCanvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    window.triggerFileDownload(dataUrl, `Passport_Photos_${Date.now()}.${format}`);
};

window.downloadPassportPdf = async function() {
    const canvas = document.getElementById('ppMainCanvas');
    if (!canvas) return;
    try {
        await window.ensurePdfLibLoaded();
        const { PDFDocument } = window.getPDFLib();
        const pdfDoc = await PDFDocument.create();
        const embeddedImg = await pdfDoc.embedJpg(canvas.toDataURL('image/jpeg', 0.98));
        const page = pdfDoc.addPage([595.28, 841.89]);
        page.drawImage(embeddedImg, { x: 0, y: 0, width: 595.28, height: 841.89 });
        const pdfBytes = await pdfDoc.save();
        window.triggerFileDownload(new Blob([pdfBytes], { type: 'application/pdf' }), `Passport_Photos_${Date.now()}.pdf`);
    } catch (e) {
        alert('PDF बनाने में त्रुटि: ' + e.message);
    }
};

window.printPassportCanvas = function() {
    const canvas = document.getElementById('ppMainCanvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    const win = window.open('', '_blank');
    win.document.write(`<html><body onload="window.print();window.close();"><img src="${dataUrl}" style="max-width:100%;" /></body></html>`);
    win.document.close();
};

// ============================================================================
// TOOL 2: BACKGROUND REMOVER & WHITE BG CONVERTER (bg_remover)
// ============================================================================
window.setupBgRemoverTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-lg font-black">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                    <h2 class="text-base md:text-lg font-black text-dark-900">स्मार्ट बैकग्राउंड रिमूवर &amp; वाइट BG कनवर्टर</h2>
                    <p class="text-[11px] font-semibold text-slate-400">फोटो का बैकग्राउंड तुरंत शुद्ध सफेद (#FFFFFF), पारदर्शी या स्काई-ब्लू बनाएं</p>
                </div>
            </div>

            <!-- Upload Area -->
            <div id="bgUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('bgFileInput').click()">
                <input type="file" id="bgFileInput" accept="image/*" class="hidden" onchange="window.handleBgRemoverUpload(this.files[0])">
                <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-emerald-200">
                    <i class="fa-solid fa-image"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ इमेज अपलोड करें (क्लिक करें या ड्रैग करें)</h3>
                <p class="text-xs font-semibold text-slate-400">JPG, PNG, WEBP</p>
            </div>

            <!-- Result Workspace -->
            <div id="bgWorkspaceSection" class="hidden space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-bold text-slate-600 uppercase">नया बैकग्राउंड:</span>
                        <button type="button" onclick="window.applyBgColor('#ffffff', this)" class="bg-mode-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-dark-900 border-2 border-emerald-500 shadow-sm flex items-center gap-1.5">
                            <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-white"></span> Pure White
                        </button>
                        <button type="button" onclick="window.applyBgColor('transparent', this)" class="bg-mode-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5">
                            <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-slate-200"></span> Transparent
                        </button>
                        <button type="button" onclick="window.applyBgColor('#99ccff', this)" class="bg-mode-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5">
                            <span class="w-3.5 h-3.5 rounded-full border border-slate-300 bg-sky-300"></span> Sky Blue
                        </button>

                        <!-- Zoom Controls -->
                        <div class="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm ml-1">
                            <span class="text-[10px] font-bold text-slate-400 mr-0.5">Zoom:</span>
                            <button type="button" onclick="window.zoomBgRemover(-0.25)" class="w-6 h-6 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-slate-100 rounded" title="Zoom Out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                            <span id="bgZoomText" class="text-xs font-black text-slate-800 min-w-[34px] text-center">100%</span>
                            <button type="button" onclick="window.zoomBgRemover(0.25)" class="w-6 h-6 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-slate-100 rounded" title="Zoom In"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                            <button type="button" onclick="window.resetBgZoom()" class="text-[10px] text-slate-400 hover:text-slate-700 ml-0.5">Reset</button>
                        </div>

                        <!-- Undo Button -->
                        <button type="button" onclick="window.undoBgRemover()" class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 flex items-center gap-1 shadow-sm" title="Undo">
                            <i class="fa-solid fa-rotate-left text-amber-500"></i> Undo
                        </button>
                    </div>

                    <div class="flex items-center gap-2">
                        <label class="text-xs font-bold text-slate-600">टॉलरेंस (Sensitivity):</label>
                        <input type="range" id="bgTolerance" min="5" max="80" value="32" oninput="window.processBgRemoval()" class="w-28 accent-emerald-600 cursor-pointer">
                        <span id="bgTolVal" class="text-xs font-bold text-slate-700">32</span>
                    </div>

                    <button type="button" onclick="window.downloadBgResult()" class="bg-dark-900 hover:bg-black text-royal-300 font-black px-5 py-2.5 rounded-xl text-xs shadow-glow transition flex items-center gap-1.5">
                        <i class="fa-solid fa-download"></i> Download HD Image
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                        <h4 class="text-xs font-black text-slate-500 uppercase mb-2">मूल फोटो (Original)</h4>
                        <img id="bgOriginalImg" class="max-h-96 mx-auto rounded-xl object-contain shadow-sm">
                    </div>
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                        <h4 class="text-xs font-black text-emerald-600 uppercase mb-2">प्रोसेस्ड फोटो (White/No BG)</h4>
                        <div class="bg-slate-200 p-2 rounded-xl inline-block">
                            <canvas id="bgResultCanvas" class="max-h-96 mx-auto rounded-lg shadow-sm"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.bgRemoverState = {
    img: null,
    targetColor: '#ffffff'
};

window.handleBgRemoverUpload = function(file) {
    if (!file) return;
    if (!window.validateFileSize(file, 100)) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.bgRemoverState.img = img;
            document.getElementById('bgOriginalImg').src = img.src;
            document.getElementById('bgUploadBox').classList.add('hidden');
            document.getElementById('bgWorkspaceSection').classList.remove('hidden');
            window.processBgRemoval();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.applyBgColor = function(color, btnEl) {
    if (!window.bgRemoverState.undoStack) window.bgRemoverState.undoStack = [];
    window.bgRemoverState.undoStack.push(window.bgRemoverState.targetColor);
    window.bgRemoverState.targetColor = color;
    document.querySelectorAll('.bg-mode-btn').forEach(b => {
        b.className = "bg-mode-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5";
    });
    if (btnEl) btnEl.className = "bg-mode-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-dark-900 border-2 border-emerald-500 shadow-sm flex items-center gap-1.5";
    window.processBgRemoval();
};

window.processBgRemoval = function() {
    const img = window.bgRemoverState.img;
    const canvas = document.getElementById('bgResultCanvas');
    if (!img || !canvas) return;

    const tol = parseInt(document.getElementById('bgTolerance')?.value || 32);
    const tolValEl = document.getElementById('bgTolVal');
    if (tolValEl) tolValEl.innerText = tol;

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    // Sample perimeter background
    let avgR = 0, avgG = 0, avgB = 0, count = 0;
    for (let x = 0; x < w; x += 10) {
        const idx = x * 4;
        avgR += d[idx]; avgG += d[idx + 1]; avgB += d[idx + 2];
        count++;
    }
    avgR = Math.round(avgR / count);
    avgG = Math.round(avgG / count);
    avgB = Math.round(avgB / count);

    const isTrans = window.bgRemoverState.targetColor === 'transparent';
    let repR = 255, repG = 255, repB = 255;
    if (window.bgRemoverState.targetColor === '#99ccff') { repR = 153; repG = 204; repB = 255; }
    const tolSq = tol * tol * 3;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dist = (r - avgR) * (r - avgR) + (g - avgG) * (g - avgG) + (b - avgB) * (b - avgB);
        if (dist <= tolSq) {
            if (isTrans) {
                d[i + 3] = 0;
            } else {
                d[i] = repR; d[i + 1] = repG; d[i + 2] = repB; d[i + 3] = 255;
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);
};

window.downloadBgResult = function() {
    const canvas = document.getElementById('bgResultCanvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    window.triggerFileDownload(dataUrl, `Clean_Photo_${Date.now()}.png`);
};

// ============================================================================
// TOOL 3: PDF TO HIGH-RES IMAGE (300 to 800 DPI Scale Rendering)
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

            <!-- Upload Zone -->
            <div id="pdfImgUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('pdfImgFileInput').click()">
                <input type="file" id="pdfImgFileInput" accept="application/pdf" class="hidden" onchange="window.handlePdfToImgUpload(this.files[0])">
                <div class="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-indigo-200">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ अपनी PDF फाइल अपलोड करें</h3>
                <p class="text-xs font-semibold text-slate-400">केवल PDF फाइल</p>
            </div>

            <!-- Conversion Options & Output -->
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

                <!-- Rendered Pages Grid -->
                <div id="pdfPagesContainer" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"></div>
            </div>
        </div>
    `;
};

window.pdfToImgState = {
    pdfDoc: null,
    renderedImages: []
};

window.handlePdfToImgUpload = async function(file) {
    if (!file) return;
    if (!window.validateFileSize(file, 100)) return;

    try {
        await window.ensurePdfViewerLoaded();
        const arrayBuffer = await file.arrayBuffer();
        const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        window.pdfToImgState.pdfDoc = await loadingTask.promise;

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
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

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
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';

    try {
        await window.ensurePdfLibrariesLoaded();
        const zip = new window.JSZip();
        const fmt = document.getElementById('pdfImgFormat')?.value || 'png';

        list.forEach(item => {
            const base64Data = item.dataUrl.split(',')[1];
            zip.file(`Page_${item.pageNum}.${fmt}`, base64Data, { base64: true });
        });

        const content = await zip.generateAsync({ type: 'blob' });
        window.triggerFileDownload(content, `All_Pages_HighDPI_${Date.now()}.zip`);
    } catch (e) {
        alert('ZIP बनाने में समस्या आई: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 4: IMAGE TO PDF CONVERTER (img_to_pdf)
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

            <!-- Upload Area -->
            <div class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('imgPdfFileInput').click()">
                <input type="file" id="imgPdfFileInput" accept="image/*" multiple class="hidden" onchange="window.handleImageToPdfUpload(this.files)">
                <div class="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-sky-200">
                    <i class="fa-solid fa-images"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ फोटो चुनें (एक साथ कई फोटो चुन सकते हैं)</h3>
                <p class="text-xs font-semibold text-slate-400">JPG, PNG</p>
            </div>

            <!-- Image Reorder & Settings Workspace -->
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

                <!-- Thumbnails List -->
                <div id="imgPdfListContainer" class="space-y-2"></div>
            </div>
        </div>
    `;
};

window.imgToPdfList = [];

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

    if (window.imgToPdfList.length > 0) {
        ws.classList.remove('hidden');
    } else {
        ws.classList.add('hidden');
        return;
    }

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
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating PDF...';

    try {
        await window.ensurePdfLibLoaded();
        const pdfLib = window.getPDFLib();
        if (!pdfLib || !pdfLib.PDFDocument) {
            throw new Error('PDF-Lib लाइब्रेरी उपलब्ध नहीं है। कृपया पेज रिफ्रेश करें।');
        }
        const { PDFDocument } = pdfLib;
        const pdfDoc = await PDFDocument.create();
        const orientation = document.getElementById('imgPdfOrientation')?.value || 'portrait';
        const margin = parseFloat(document.getElementById('imgPdfMargin')?.value || 15);

        const a4Width = orientation === 'portrait' ? 595.28 : 841.89;
        const a4Height = orientation === 'portrait' ? 841.89 : 595.28;

        for (const item of window.imgToPdfList) {
            const page = pdfDoc.addPage([a4Width, a4Height]);
            const isPng = item.dataUrl.includes('image/png');
            let embeddedImage;

            if (isPng) {
                embeddedImage = await pdfDoc.embedPng(item.dataUrl);
            } else {
                embeddedImage = await pdfDoc.embedJpg(item.dataUrl);
            }

            const imgW = embeddedImage.width;
            const imgH = embeddedImage.height;
            const availW = a4Width - 2 * margin;
            const availH = a4Height - 2 * margin;

            const scale = Math.min(availW / imgW, availH / imgH);
            const drawW = imgW * scale;
            const drawH = imgH * scale;

            const x = (a4Width - drawW) / 2;
            const y = (a4Height - drawH) / 2;

            page.drawImage(embeddedImage, {
                x: x, y: y, width: drawW, height: drawH
            });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        window.triggerFileDownload(blob, `Images_${Date.now()}.pdf`);
    } catch (e) {
        alert('PDF बनाने में त्रुटि: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 5: TRUE A4 PDF TEXT & STAMP EDITOR (Precise In-Place Edit, Zero-Zoom Shift)
// ============================================================================
window.setupPdfEditorTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-lg font-black">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </div>
                    <div>
                        <h2 class="text-base md:text-lg font-black text-dark-900">PDF Text &amp; A4 Editor (इन-प्लेस टेक्स्ट एडिटर)</h2>
                        <p class="text-[11px] font-semibold text-slate-400">शब्द/लाइन पर क्लिक करके उसी जगह एडिट करें • बैकग्राउंड 100% सेम रहेगा, कोई ज़ूम या पिक्सल शिफ्ट नहीं</p>
                    </div>
                </div>
            </div>

            <!-- Upload Box -->
            <div id="pdfEditUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('pdfEditFileInput').click()">
                <input type="file" id="pdfEditFileInput" accept="application/pdf" class="hidden" onchange="window.handlePdfEditorUpload(this.files[0])">
                <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-rose-200">
                    <i class="fa-solid fa-file-pen"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ PDF फाइल अपलोड करें</h3>
                <p class="text-xs font-semibold text-slate-400">एडिट करने के लिए PDF चुनें</p>
            </div>

            <!-- Full Workspace -->
            <div id="pdfEditWorkspace" class="hidden space-y-4">
                
                <!-- Modern Top Toolbar -->
                <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    
                    <!-- Page Navigation -->
                    <div class="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <button type="button" onclick="window.navPdfEditPage(-1)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold" title="पिछला पेज"><i class="fa-solid fa-chevron-left"></i></button>
                        <span id="pdfEditPageIndicator" class="text-xs font-black text-slate-800">Page 1 / 1</span>
                        <button type="button" onclick="window.navPdfEditPage(1)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold" title="अगला पेज"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>

                    <!-- Zoom Controls -->
                    <div class="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-sm">
                        <button type="button" onclick="window.zoomPdfEditor(-0.2)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-black" title="Zoom Out (-)"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                        <span id="pdfEditZoomText" class="text-xs font-black text-slate-800 px-1 min-w-[40px] text-center">100%</span>
                        <button type="button" onclick="window.zoomPdfEditor(0.2)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-black" title="Zoom In (+)"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                        <button type="button" onclick="window.resetPdfEditorZoom()" class="text-[10px] font-bold text-slate-400 hover:text-slate-800 px-1.5 py-1 rounded hover:bg-slate-100 ml-0.5">Reset</button>
                    </div>

                    <!-- Undo Button -->
                    <button type="button" id="btnUndoPdfEdit" onclick="window.undoPdfEditorAction()" class="px-3 py-2 rounded-xl text-xs font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5 shadow-sm" title="Undo (पिछला बदलाव वापस लें)">
                        <i class="fa-solid fa-rotate-left text-amber-500"></i> <span>Undo</span>
                    </button>

                    <!-- Editor Modes -->
                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" onclick="window.setPdfEditorMode('click_edit')" id="btnEditModeClick" class="px-3 py-2 rounded-xl text-xs font-black bg-dark-900 text-royal-300 border border-royal-400 shadow-sm flex items-center gap-1.5">
                            <i class="fa-solid fa-i-cursor"></i> शब्द पर क्लिक करके एडिट करें
                        </button>
                        <button type="button" onclick="window.setPdfEditorMode('box_replace')" id="btnEditModeBox" class="px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5">
                            <i class="fa-solid fa-vector-square text-indigo-500"></i> लाइन/एरिया खींचकर बदलें
                        </button>
                        <button type="button" onclick="window.setPdfEditorMode('whiteout')" id="btnEditModeWhiteout" class="px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5">
                            <i class="fa-solid fa-eraser text-rose-500"></i> इरेज़र (व्हाइटआउट)
                        </button>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                        <button type="button" id="btnSavePdfEditor" onclick="window.saveAndDownloadEditedPdf()" class="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer z-30">
                            <i class="fa-solid fa-download text-sm"></i> <span>डाउनलोड PDF (Save &amp; Download)</span>
                        </button>
                    </div>
                </div>

                <div id="pdfEditGuideBanner" class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                    <i class="fa-solid fa-circle-info text-amber-600 text-sm"></i>
                    <span>💡 <strong>क्लिक-टू-एडिट एक्टिव:</strong> पेज पर किसी भी नाम या शब्द पर क्लिक करें। उसी जगह बॉक्स खुलेगा, नया टेक्स्ट लिखें और <strong>Enter</strong> दबाएं — बैकग्राउंड बिल्कुल सेम रहेगा और पुराना टेक्स्ट साफ होकर नया छप जाएगा!</span>
                </div>

                <!-- True A4 Desk Canvas Workspace (Preserves natural page ratio & zero-zoom shift) -->
                <div class="bg-slate-300/80 p-3 md:p-6 rounded-3xl flex justify-center items-start overflow-auto min-h-[650px]">
                    <div id="a4DeskWrapper" class="a4-desk-sheet rounded-lg overflow-hidden relative shadow-a4 bg-white border border-slate-300">
                        <!-- Main PDF Render Canvas -->
                        <canvas id="pdfEditCanvas" class="block bg-white w-full h-auto"></canvas>
                        <!-- Interactive Clickable Text Overlay Layer (Locked 1:1 with canvas) -->
                        <div id="pdfTextOverlayLayer" class="absolute inset-0 z-20 pointer-events-auto"></div>
                        <!-- In-Place Editable Input Popup (Dynamically Placed Over Clicked Word) -->
                        <div id="inPlaceEditorPopup" class="hidden absolute z-40 bg-white p-2.5 rounded-xl shadow-2xl border-2 border-royal-500 space-y-2 max-w-sm">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-[10px] font-black uppercase text-royal-600">Edit Text In-Place</span>
                                <button type="button" onclick="window.cancelInPlaceEdit()" class="text-slate-400 hover:text-red-500 text-xs"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <input type="text" id="inPlaceTextInput" class="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-royal-500 bg-slate-50">
                            <div class="flex items-center justify-between gap-2 pt-1">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] font-bold text-slate-500">Size:</span>
                                    <input type="number" id="inPlaceFontSize" value="16" min="8" max="72" class="w-12 p-1 border border-slate-300 rounded text-xs font-bold text-center">
                                    <input type="color" id="inPlaceTextColor" value="#000000" class="w-6 h-6 p-0 rounded border border-slate-300 cursor-pointer" title="Font Color">
                                </div>
                                <button type="button" onclick="window.applyInPlaceEdit()" class="bg-dark-900 hover:bg-black text-royal-300 px-3 py-1.5 rounded-lg text-xs font-black shadow transition">
                                    ✓ Apply (Enter)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;
};

window.pdfEditorState = {
    pdfDoc: null,
    currentPage: 1,
    scale: 2.0,
    activeMode: 'click_edit',
    currentActiveItem: null,
    boxStartX: 0,
    boxStartY: 0,
    isDraggingBox: false,
    pageCanvasMap: {}, // Cached modified canvas data URLs per page
    pageDimsMap: {}    // Original page point dimensions [width, height]
};

// Color Sampler: Samples true backdrop color right next to text
// Content-Aware Background Preservation & Inpainting (Photo & Texture Safe)
window.inpaintCanvasBackground = function(ctx, startX, startY, width, height, onlyTextStrokes = true) {
    const canvas = ctx.canvas;
    const cw = canvas.width;
    const ch = canvas.height;

    const x0 = Math.max(0, Math.floor(startX));
    const y0 = Math.max(0, Math.floor(startY));
    const x1 = Math.min(cw, Math.ceil(startX + width));
    const y1 = Math.min(ch, Math.ceil(startY + height));
    const boxW = x1 - x0;
    const boxH = y1 - y0;

    if (boxW <= 0 || boxH <= 0) return;

    // Sample clean background reference rows directly above and below the text box
    const sampleYTop = Math.max(0, y0 - 2);
    const sampleYBot = Math.min(ch - 1, y1 + 1);

    const imgData = ctx.getImageData(x0, y0, boxW, boxH);
    const d = imgData.data;

    const topRowData = ctx.getImageData(x0, sampleYTop, boxW, 1).data;
    const botRowData = ctx.getImageData(x0, sampleYBot, boxW, 1).data;

    for (let bx = 0; bx < boxW; bx++) {
        const topIdx = bx * 4;
        const tR = topRowData[topIdx];
        const tG = topRowData[topIdx + 1];
        const tB = topRowData[topIdx + 2];

        const bR = botRowData[topIdx];
        const bG = botRowData[topIdx + 1];
        const bB = botRowData[topIdx + 2];

        for (let by = 0; by < boxH; by++) {
            const idx = (by * boxW + bx) * 4;
            const t = boxH > 1 ? (by / (boxH - 1)) : 0;

            // Interpolate underlying background pixel vertically column-by-column
            const bgR = Math.round((1 - t) * tR + t * bR);
            const bgG = Math.round((1 - t) * tG + t * bG);
            const bgB = Math.round((1 - t) * tB + t * bB);

            if (!onlyTextStrokes) {
                // Reconstruct full background seamlessly without solid white
                d[idx] = bgR;
                d[idx + 1] = bgG;
                d[idx + 2] = bgB;
            } else {
                const curR = d[idx];
                const curG = d[idx + 1];
                const curB = d[idx + 2];

                // Check difference between current pixel and underlying background
                const diff = Math.abs(curR - bgR) + Math.abs(curG - bgG) + Math.abs(curB - bgB);

                // If pixel is text stroke / dark ink, blend it smoothly into the background photo/color
                if (diff > 22) {
                    const alpha = Math.min(1.0, (diff - 18) / 24);
                    d[idx] = Math.round((1 - alpha) * curR + alpha * bgR);
                    d[idx + 1] = Math.round((1 - alpha) * curG + alpha * bgG);
                    d[idx + 2] = Math.round((1 - alpha) * curB + alpha * bgB);
                }
                // If diff <= 22, it is already the natural photo/texture background! Kept 100% untouched!
            }
        }
    }

    ctx.putImageData(imgData, x0, y0);
};

window.sampleCanvasBackground = function(ctx, x, y, w, h) {
    try {
        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
        const checkPoints = [
            [x, Math.max(0, y - 4)],
            [x + w / 2, Math.max(0, y - 4)],
            [Math.min(canvasW - 1, x + w), Math.max(0, y - 4)],
            [Math.max(0, x - 4), y + h / 2],
            [Math.min(canvasW - 1, x + w + 4), y + h / 2]
        ];

        let totR = 0, totG = 0, totB = 0, validSamples = 0;
        checkPoints.forEach(([px, py]) => {
            const cx = Math.max(0, Math.min(canvasW - 1, Math.round(px)));
            const cy = Math.max(0, Math.min(canvasH - 1, Math.round(py)));
            const pixel = ctx.getImageData(cx, cy, 1, 1).data;
            // Ignore dark ink strokes
            if (pixel[0] > 160 || pixel[1] > 160 || pixel[2] > 160) {
                totR += pixel[0];
                totG += pixel[1];
                totB += pixel[2];
                validSamples++;
            }
        });

        if (validSamples > 0) {
            return `rgb(${Math.round(totR / validSamples)}, ${Math.round(totG / validSamples)}, ${Math.round(totB / validSamples)})`;
        }
    } catch (e) {}
    return '#ffffff';
};

window.handlePdfEditorUpload = async function(file) {
    if (!file) return;
    if (!window.validateFileSize(file, 100)) return;

    try {
        await window.ensurePdfViewerLoaded();
        const arrayBuffer = await file.arrayBuffer();
        // Clone ArrayBuffer so PDF.js web worker transfer does not detach originalPdfBytes!
        window.pdfEditorState.originalPdfBytes = arrayBuffer.slice(0);
        const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        window.pdfEditorState.pdfDoc = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;
        window.pdfEditorState.currentPage = 1;
        window.pdfEditorState.pageCanvasMap = {};
        window.pdfEditorState.pageDimsMap = {};

        document.getElementById('pdfEditUploadBox').classList.add('hidden');
        document.getElementById('pdfEditWorkspace').classList.remove('hidden');
        window.renderPdfEditorA4Page();
    } catch (e) {
        alert('PDF लोड नहीं हो पाई: ' + e.message);
    }
};

window.setPdfEditorMode = function(mode) {
    window.pdfEditorState.activeMode = mode;
    const clickBtn = document.getElementById('btnEditModeClick');
    const boxBtn = document.getElementById('btnEditModeBox');
    const whiteoutBtn = document.getElementById('btnEditModeWhiteout');
    const banner = document.getElementById('pdfEditGuideBanner');

    const defaultClass = "px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5";
    const activeClass = "px-3 py-2 rounded-xl text-xs font-black bg-dark-900 text-royal-300 border border-royal-400 shadow-sm flex items-center gap-1.5";

    if (clickBtn) clickBtn.className = mode === 'click_edit' ? activeClass : defaultClass;
    if (boxBtn) boxBtn.className = mode === 'box_replace' ? activeClass : defaultClass;
    if (whiteoutBtn) whiteoutBtn.className = mode === 'whiteout' ? activeClass : defaultClass;

    if (mode === 'click_edit') {
        banner.innerHTML = `<i class="fa-solid fa-circle-info text-amber-600 text-sm"></i><span>💡 <strong>क्लिक-टू-एडिट एक्टिव:</strong> किसी भी शब्द पर क्लिक करके वहीं बदलें।</span>`;
    } else if (mode === 'box_replace') {
        banner.innerHTML = `<i class="fa-solid fa-vector-square text-indigo-600 text-sm"></i><span>📐 <strong>बॉक्स रिप्लेस एक्टिव:</strong> माउस से किसी भी लाइन या एरिया पर बॉक्स खींचें, नया टेक्स्ट लिखें।</span>`;
    } else if (mode === 'whiteout') {
        banner.innerHTML = `<i class="fa-solid fa-eraser text-rose-600 text-sm"></i><span>🧹 <strong>व्हाइटआउट (इरेज़र) एक्टिव:</strong> जिस भाग को मिटाना चाहते हैं, उसपर माउस से बॉक्स खींचें।</span>`;
    }
};

window.renderPdfEditorA4Page = async function() {
    const pdfDoc = window.pdfEditorState.pdfDoc;
    const pageNum = window.pdfEditorState.currentPage;
    const canvas = document.getElementById('pdfEditCanvas');
    const overlay = document.getElementById('pdfTextOverlayLayer');
    const wrapper = document.getElementById('a4DeskWrapper');
    if (!pdfDoc || !canvas || !overlay || !wrapper) return;

    document.getElementById('pdfEditPageIndicator').innerText = `Page ${pageNum} of ${pdfDoc.numPages}`;

    const page = await pdfDoc.getPage(pageNum);
    const scale = window.pdfEditorState.scale;
    const viewport = page.getViewport({ scale: scale });
    const naturalViewport = page.getViewport({ scale: 1.0 });

    // Store natural point dimensions for 1:1 PDF export
    window.pdfEditorState.pageDimsMap[pageNum] = [naturalViewport.width, naturalViewport.height];

    // Lock wrapper aspect ratio to natural page ratio: ZERO ZOOM SHIFT!
    wrapper.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    wrapper.style.maxWidth = Math.min(840, Math.round(viewport.width / (scale / 1.15))) + 'px';

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    // If this page was already modified, restore cached image to keep edits intact!
    if (window.pdfEditorState.pageCanvasMap[pageNum]) {
        const cachedImg = new Image();
        cachedImg.onload = () => {
            ctx.drawImage(cachedImg, 0, 0);
            window.buildInteractiveTextOverlay(page, viewport, scale);
        };
        cachedImg.src = window.pdfEditorState.pageCanvasMap[pageNum];
    } else {
        // Otherwise render page freshly from PDF
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        window.buildInteractiveTextOverlay(page, viewport, scale);
    }
};

window.buildInteractiveTextOverlay = async function(page, viewport, scale) {
    const overlay = document.getElementById('pdfTextOverlayLayer');
    const canvas = document.getElementById('pdfEditCanvas');
    if (!overlay || !canvas) return;

    overlay.innerHTML = '';
    const textContent = await page.getTextContent();
    const items = textContent.items;

    items.forEach((item) => {
        if (!item.str || !item.str.trim()) return;

        const tx = item.transform[4];
        const ty = item.transform[5];
        const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

        const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
        const fontSizeCanvas = fontSize * scale;
        const itemW = item.width * scale;
        const itemH = fontSizeCanvas * 1.25;

        // Bounding box: from baseline vy upward by fontSize
        const boxLeftPercent = (vx / viewport.width) * 100;
        const boxTopPercent = ((vy - fontSizeCanvas * 0.95) / viewport.height) * 100;
        const boxWidthPercent = (itemW / viewport.width) * 100;
        const boxHeightPercent = (itemH / viewport.height) * 100;

        const div = document.createElement('div');
        div.className = 'pdf-text-highlight';
        div.style.left = boxLeftPercent + '%';
        div.style.top = boxTopPercent + '%';
        div.style.width = Math.max(boxWidthPercent, 0.5) + '%';
        div.style.height = boxHeightPercent + '%';
        div.title = `Click to edit: "${item.str}"`;

        div.onclick = (e) => {
            e.stopPropagation();
            if (window.pdfEditorState.activeMode !== 'click_edit') return;
            window.openInPlaceEditor(item, vx, vy, itemW, itemH, fontSize);
        };

        overlay.appendChild(div);
    });

    // Box Dragging Support
    overlay.onmousedown = (e) => {
        if (window.pdfEditorState.activeMode === 'click_edit') return;
        const rect = overlay.getBoundingClientRect();
        window.pdfEditorState.isDraggingBox = true;
        window.pdfEditorState.boxStartX = (e.clientX - rect.left) * (canvas.width / rect.width);
        window.pdfEditorState.boxStartY = (e.clientY - rect.top) * (canvas.height / rect.height);
    };

    overlay.onmouseup = (e) => {
        if (!window.pdfEditorState.isDraggingBox) return;
        window.pdfEditorState.isDraggingBox = false;
        const rect = overlay.getBoundingClientRect();
        const endX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const endY = (e.clientY - rect.top) * (canvas.height / rect.height);

        const startX = window.pdfEditorState.boxStartX;
        const startY = window.pdfEditorState.boxStartY;
        const boxX = Math.min(startX, endX);
        const boxY = Math.min(startY, endY);
        const boxW = Math.abs(endX - startX);
        const boxH = Math.abs(endY - startY);

        if (boxW < 8 || boxH < 8) return;
        const ctx = canvas.getContext('2d');

        if (window.pdfEditorState.activeMode === 'whiteout') {
            window.savePdfEditorUndoState();
            window.inpaintCanvasBackground(ctx, boxX, boxY, boxW, boxH, false);
            // Cache page state
            window.pdfEditorState.pageCanvasMap[window.pdfEditorState.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
        } else if (window.pdfEditorState.activeMode === 'box_replace') {
            const newText = prompt('इस चुने हुए एरिया के लिए नया टेक्स्ट लिखें:', '');
            if (newText !== null && newText.trim()) {
                window.savePdfEditorUndoState();
            window.inpaintCanvasBackground(ctx, boxX, boxY, boxW, boxH, false);

                ctx.fillStyle = '#000000';
                const fSize = Math.max(14, Math.round(boxH * 0.72));
                ctx.font = `bold ${fSize}px Arial, sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.fillText(newText.trim(), boxX + 4, boxY + boxH / 2);
                window.pdfEditorState.pageCanvasMap[window.pdfEditorState.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
            }
        }
    };
};

window.openInPlaceEditor = function(item, vx, vy, itemW, itemH, fontSize) {
    const popup = document.getElementById('inPlaceEditorPopup');
    const input = document.getElementById('inPlaceTextInput');
    const sizeInp = document.getElementById('inPlaceFontSize');
    if (!popup || !input) return;

    window.pdfEditorState.currentActiveItem = { item, vx, vy, itemW, itemH, fontSize };

    input.value = item.str;
    sizeInp.value = Math.round(fontSize * 1.05);

    const canvas = document.getElementById('pdfEditCanvas');
    const leftPercent = (vx / canvas.width) * 100;
    const topPercent = ((vy + 8) / canvas.height) * 100;

    popup.style.left = Math.min(leftPercent, 65) + '%';
    popup.style.top = Math.min(topPercent, 80) + '%';
    popup.classList.remove('hidden');

    input.focus();
    input.select();

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            window.applyInPlaceEdit();
        } else if (e.key === 'Escape') {
            window.cancelInPlaceEdit();
        }
    };
};

window.cancelInPlaceEdit = function() {
    const popup = document.getElementById('inPlaceEditorPopup');
    if (popup) popup.classList.add('hidden');
    window.pdfEditorState.currentActiveItem = null;
};

// In-Place Text Replacement: Seamless background matching & exact baseline rendering
window.applyInPlaceEdit = function() {
    const state = window.pdfEditorState.currentActiveItem;
    const input = document.getElementById('inPlaceTextInput');
    const sizeInp = document.getElementById('inPlaceFontSize');
    const colorInp = document.getElementById('inPlaceTextColor');
    const canvas = document.getElementById('pdfEditCanvas');

    if (!state || !input || !canvas) return;

    const newStr = input.value.trim();
    const fSize = parseInt(sizeInp.value) || 16;
    const color = colorInp.value || '#000000';
    const ctx = canvas.getContext('2d');
    const scale = window.pdfEditorState.scale;

    const { vx, vy, itemW } = state;
    const fontSizeCanvas = fSize * scale;

    // 1. Sample exact background color surrounding the text box
    const eraseTop = Math.max(0, vy - fontSizeCanvas * 1.05);
    const eraseHeight = fontSizeCanvas * 1.35;
    const eraseLeft = Math.max(0, vx - 2);

    ctx.font = `bold ${fontSizeCanvas}px Arial, sans-serif`;
    const newMetrics = ctx.measureText(newStr);
    const eraseWidth = Math.max(itemW + 6, newMetrics.width + 6);

    // 1. Content-Aware Background Preservation: Erase ONLY text strokes, keep photo/texture intact!
    window.savePdfEditorUndoState();
    window.inpaintCanvasBackground(ctx, eraseLeft, eraseTop, eraseWidth, eraseHeight, true);

    // 3. Draw newly edited text at exact original baseline
    if (newStr) {
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSizeCanvas}px Arial, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(newStr, vx, vy);
    }

    // Cache page state so changes persist when paging
    window.pdfEditorState.pageCanvasMap[window.pdfEditorState.currentPage] = canvas.toDataURL('image/jpeg', 0.98);

    window.cancelInPlaceEdit();
};


// ================= ZOOM & UNDO CONTROLS ENGINE =================
window.pdfEditorState.viewZoom = 1.0;
window.pdfEditorState.undoStack = [];

window.savePdfEditorUndoState = function() {
    const canvas = document.getElementById('pdfEditCanvas');
    if (!canvas) return;
    if (!window.pdfEditorState.undoStack) window.pdfEditorState.undoStack = [];
    if (window.pdfEditorState.undoStack.length >= 25) window.pdfEditorState.undoStack.shift();
    window.pdfEditorState.undoStack.push({
        page: window.pdfEditorState.currentPage,
        dataUrl: canvas.toDataURL('image/jpeg', 0.98)
    });
};

window.undoPdfEditorAction = function() {
    const stack = window.pdfEditorState.undoStack;
    if (!stack || stack.length === 0) {
        return alert('वापस जाने के लिए कोई पिछला बदलाव (Undo Step) नहीं है।');
    }
    const lastState = stack.pop();
    const canvas = document.getElementById('pdfEditCanvas');
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        window.pdfEditorState.pageCanvasMap[window.pdfEditorState.currentPage] = lastState.dataUrl;
    };
    img.src = lastState.dataUrl;
};

window.zoomPdfEditor = function(delta) {
    let z = (window.pdfEditorState.viewZoom || 1.0) + delta;
    if (z < 0.4) z = 0.4;
    if (z > 3.0) z = 3.0;
    z = Math.round(z * 10) / 10;
    window.pdfEditorState.viewZoom = z;
    const wrapper = document.getElementById('a4DeskWrapper');
    const zoomText = document.getElementById('pdfEditZoomText');
    if (wrapper) {
        wrapper.style.transform = `scale(${z})`;
        wrapper.style.transformOrigin = 'top center';
    }
    if (zoomText) zoomText.innerText = Math.round(z * 100) + '%';
};

window.resetPdfEditorZoom = function() {
    window.pdfEditorState.viewZoom = 1.0;
    const wrapper = document.getElementById('a4DeskWrapper');
    const zoomText = document.getElementById('pdfEditZoomText');
    if (wrapper) {
        wrapper.style.transform = 'scale(1)';
        wrapper.style.transformOrigin = 'top center';
    }
    if (zoomText) zoomText.innerText = '100%';
};

// Background Remover Zoom & Undo
window.bgRemoverState.viewZoom = 1.0;
window.bgRemoverState.undoStack = [];

window.zoomBgRemover = function(delta) {
    let z = (window.bgRemoverState.viewZoom || 1.0) + delta;
    if (z < 0.5) z = 0.5;
    if (z > 3.0) z = 3.0;
    z = Math.round(z * 10) / 10;
    window.bgRemoverState.viewZoom = z;
    const canvas = document.getElementById('bgResultCanvas');
    const origImg = document.getElementById('bgOriginalImg');
    const zoomText = document.getElementById('bgZoomText');
    if (canvas) canvas.style.transform = `scale(${z})`;
    if (origImg) origImg.style.transform = `scale(${z})`;
    if (zoomText) zoomText.innerText = Math.round(z * 100) + '%';
};

window.resetBgZoom = function() {
    window.bgRemoverState.viewZoom = 1.0;
    const canvas = document.getElementById('bgResultCanvas');
    const origImg = document.getElementById('bgOriginalImg');
    const zoomText = document.getElementById('bgZoomText');
    if (canvas) canvas.style.transform = 'scale(1)';
    if (origImg) origImg.style.transform = 'scale(1)';
    if (zoomText) zoomText.innerText = '100%';
};

window.undoBgRemover = function() {
    const stack = window.bgRemoverState.undoStack;
    if (!stack || stack.length === 0) return alert('कोई पिछला बदलाव नहीं है।');
    const prev = stack.pop();
    window.bgRemoverState.targetColor = prev;
    window.processBgRemoval();
};

// Compressor Zoom
window.compressorState.viewZoom = 1.0;

window.zoomCompressor = function(delta) {
    let z = (window.compressorState.viewZoom || 1.0) + delta;
    if (z < 0.5) z = 0.5;
    if (z > 3.0) z = 3.0;
    z = Math.round(z * 10) / 10;
    window.compressorState.viewZoom = z;
    const orig = document.getElementById('compOriginalPreview');
    const res = document.getElementById('compResultPreview');
    const zoomText = document.getElementById('compZoomText');
    if (orig) orig.style.transform = `scale(${z})`;
    if (res) res.style.transform = `scale(${z})`;
    if (zoomText) zoomText.innerText = Math.round(z * 100) + '%';
};

window.resetCompressorZoom = function() {
    window.compressorState.viewZoom = 1.0;
    const orig = document.getElementById('compOriginalPreview');
    const res = document.getElementById('compResultPreview');
    const zoomText = document.getElementById('compZoomText');
    if (orig) orig.style.transform = 'scale(1)';
    if (res) res.style.transform = 'scale(1)';
    if (zoomText) zoomText.innerText = '100%';
};

window.navPdfEditPage = function(dir) {
    const state = window.pdfEditorState;
    const next = state.currentPage + dir;
    if (next < 1 || next > state.pdfDoc.numPages) return;

    // Cache current page before switching
    const canvas = document.getElementById('pdfEditCanvas');
    if (canvas) {
        state.pageCanvasMap[state.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
    }

    state.currentPage = next;
    window.renderPdfEditorA4Page();
};

// Save & Download: Preserves exact original page dimensions and unedited pages!
window.saveAndDownloadEditedPdf = async function() {
    const state = window.pdfEditorState;
    if (!state || !state.pdfDoc) {
        return alert('कृपया पहले कोई PDF फाइल अपलोड करें!');
    }

    const canvas = document.getElementById('pdfEditCanvas');
    if (canvas) {
        state.pageCanvasMap[state.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
    }

    const btn = document.getElementById('btnSavePdfEditor');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...'; }

    try {
        await window.ensurePdfLibLoaded();
        const pdfLib = window.getPDFLib();
        if (!pdfLib || !pdfLib.PDFDocument) {
            throw new Error('PDF-Lib लाइब्रेरी उपलब्ध नहीं है। कृपया पेज रिफ्रेश करें।');
        }
        const { PDFDocument } = pdfLib;

        let newDoc;
        try {
            // Attempt lossless vector merge with original PDF
            const origDoc = await PDFDocument.load(state.originalPdfBytes.slice(0));
            newDoc = await PDFDocument.create();

            for (let p = 1; p <= state.pdfDoc.numPages; p++) {
                const origPage = origDoc.getPage(p - 1);
                const origW = origPage.getWidth(), origH = origPage.getHeight();

                if (state.pageCanvasMap[p]) {
                    const embeddedImg = await newDoc.embedJpg(state.pageCanvasMap[p]);
                    const newPage = newDoc.addPage([origW, origH]);
                    newPage.drawImage(embeddedImg, { x: 0, y: 0, width: origW, height: origH });
                } else {
                    const [copiedPage] = await newDoc.copyPages(origDoc, [p - 1]);
                    newDoc.addPage(copiedPage);
                }
            }
        } catch (vectorLoadErr) {
            console.warn('Vector PDF load fallback to high-DPI canvas stream:', vectorLoadErr);
            // Universal fallback: renders directly from PDF.js onto crisp canvas pages!
            newDoc = await PDFDocument.create();
            for (let p = 1; p <= state.pdfDoc.numPages; p++) {
                const dims = (state.pageDimsMap && state.pageDimsMap[p]) ? state.pageDimsMap[p] : [595.28, 841.89];
                let pageImg = state.pageCanvasMap[p];
                if (!pageImg) {
                    const page = await state.pdfDoc.getPage(p);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const c = document.createElement('canvas');
                    c.width = viewport.width; c.height = viewport.height;
                    await page.render({ canvasContext: c.getContext('2d'), viewport: viewport }).promise;
                    pageImg = c.toDataURL('image/jpeg', 0.96);
                }
                const embedded = await newDoc.embedJpg(pageImg);
                const newP = newDoc.addPage(dims);
                newP.drawImage(embedded, { x: 0, y: 0, width: dims[0], height: dims[1] });
            }
        }

        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        window.triggerFileDownload(blob, `Edited_Document_${Date.now()}.pdf`);
        setTimeout(() => alert('🎉 सफलता! आपकी एडिट की गई PDF फाइल डाउनलोड हो गई है।'), 350);
    } catch (e) {
        console.error('Save PDF Error:', e);
        alert('PDF सेव करने में समस्या आई: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
};

// ============================================================================
// TOOL 6: MERGE PDF (pdf_merge)
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

window.pdfMergeList = [];

window.handlePdfMergeUpload = async function(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!window.validateFileSize(file, 100)) continue;
        const arrayBuffer = await file.arrayBuffer();
        window.pdfMergeList.push({ name: file.name, size: file.size, bytes: arrayBuffer });
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
    } else {
        ws.classList.add('hidden');
        return;
    }

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
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Merging...';

    try {
        await window.ensurePdfLibLoaded();
        const pdfLib = window.getPDFLib();
        if (!pdfLib || !pdfLib.PDFDocument) {
            throw new Error('PDF-Lib लाइब्रेरी उपलब्ध नहीं है। कृपया पेज रिफ्रेश करें।');
        }
        const { PDFDocument } = pdfLib;
        const mergedDoc = await PDFDocument.create();

        for (const item of window.pdfMergeList) {
            const docToMerge = await PDFDocument.load(item.bytes.slice(0));
            const copiedPages = await mergedDoc.copyPages(docToMerge, docToMerge.getPageIndices());
            copiedPages.forEach((page) => mergedDoc.addPage(page));
        }

        const mergedBytes = await mergedDoc.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        window.triggerFileDownload(blob, `Merged_Document_${Date.now()}.pdf`);
    } catch (e) {
        alert('मर्ज करने में त्रुटि: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 7: UNLOCK PDF (pdf_unlock)
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

window.pdfUnlockFileBytes = null;

window.handlePdfUnlockUpload = async function(file) {
    if (!file) return;
    if (!window.validateFileSize(file, 100)) return;

    window.pdfUnlockFileBytes = await file.arrayBuffer();
    document.getElementById('pdfUnlockUploadBox').classList.add('hidden');
    document.getElementById('pdfUnlockFormSection').classList.remove('hidden');
};

window.executePdfUnlock = async function() {
    const pass = document.getElementById('pdfUnlockPassInput')?.value;
    if (!pass) return alert('कृपया पासवर्ड दर्ज करें!');
    const btn = document.getElementById('btnUnlockPdf');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Unlocking PDF...';

    try {
        await window.ensurePdfViewerLoaded();
        await window.ensurePdfLibLoaded();
        const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];

        // 1. Decrypt using PDF.js engine with password support
        let pdfDoc;
        try {
            const loadingTask = pdfjs.getDocument({
                data: window.pdfUnlockFileBytes.slice(0),
                password: pass
            });
            pdfDoc = await loadingTask.promise;
        } catch (decryptErr) {
            const msg = String(decryptErr?.message || decryptErr || '');
            if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('need')) {
                throw new Error('दर्ज किया गया पासवर्ड गलत है!\n\nकृपया सही पासवर्ड दोबारा चेक करके डालें।');
            }
            throw new Error('PDF डिक्रिप्ट नहीं हो सकी: ' + msg);
        }

        // 2. Re-create clean unencrypted PDF via PDFLib
        const pdfLib = window.getPDFLib();
        if (!pdfLib || !pdfLib.PDFDocument) {
            throw new Error('PDF-Lib लाइब्रेरी उपलब्ध नहीं है। कृपया पेज रिफ्रेश करें।');
        }
        const { PDFDocument } = pdfLib;
        const cleanDoc = await PDFDocument.create();

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.5 });
            const naturalViewport = page.getViewport({ scale: 1.0 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const embeddedImg = await cleanDoc.embedJpg(imgData);

            const newPage = cleanDoc.addPage([naturalViewport.width, naturalViewport.height]);
            newPage.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: naturalViewport.width,
                height: naturalViewport.height
            });
        }

        const cleanBytes = await cleanDoc.save();
        const blob = new Blob([cleanBytes], { type: 'application/pdf' });
        window.triggerFileDownload(blob, `Unlocked_Document_${Date.now()}.pdf`);
        setTimeout(() => alert('🎉 सफलता! आपकी PDF का पासवर्ड हमेशा के लिए हटा दिया गया है और अनलॉक PDF डाउनलोड हो गई है।'), 300);
    } catch (e) {
        alert(e.message || 'PDF अनलॉक करने में समस्या आई।');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};

// ============================================================================
// TOOL 8: SMART IMAGE COMPRESSOR (img_compress - Target KB Presets)
// ============================================================================
window.setupImageCompressorTool = function(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div class="w-10 h-10 rounded-xl bg-royal-50 text-royal-600 border border-royal-200 flex items-center justify-center text-lg font-black">
                    <i class="fa-solid fa-file-zipper"></i>
                </div>
                <div>
                    <h2 class="text-base md:text-lg font-black text-dark-900">Smart Image Compressor (सरकारी फॉर्म्स के लिए)</h2>
                    <p class="text-[11px] font-semibold text-slate-400">टारगेट 20KB, 50KB, 100KB में इमेज कंप्रेस करें बिना शार्पनेस खोए</p>
                </div>
            </div>

            <div id="compUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('compFileInput').click()">
                <input type="file" id="compFileInput" accept="image/*" class="hidden" onchange="window.handleCompressorUpload(this.files[0])">
                <div class="w-14 h-14 bg-royal-100 text-royal-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-royal-200">
                    <i class="fa-solid fa-compress"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ इमेज अपलोड करें</h3>
                <p class="text-xs font-semibold text-slate-400">JPG, PNG, WEBP</p>
            </div>

            <div id="compWorkspaceSection" class="hidden space-y-4">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div>
                                <span class="text-xs font-bold text-slate-400 block uppercase">मूल साइज (Original):</span>
                                <span id="compOrigSizeText" class="text-base font-black text-dark-900">0 KB</span>
                            </div>
                            <div class="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm ml-2">
                                <span class="text-[10px] font-bold text-slate-400 mr-0.5">Zoom:</span>
                                <button type="button" onclick="window.zoomCompressor(-0.25)" class="w-6 h-6 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-slate-100 rounded"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                                <span id="compZoomText" class="text-xs font-black text-slate-800 min-w-[34px] text-center">100%</span>
                                <button type="button" onclick="window.zoomCompressor(0.25)" class="w-6 h-6 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-slate-100 rounded"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                                <button type="button" onclick="window.resetCompressorZoom()" class="text-[10px] text-slate-400 hover:text-slate-700 ml-0.5">Reset</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="text-xs font-black text-slate-600 uppercase mr-1">क्विक प्रीसेट्स:</span>
                            <button type="button" onclick="window.setCompressPreset(20)" class="comp-preset-btn px-2.5 py-1 rounded-lg text-xs font-black bg-white border border-slate-200">&lt; 20 KB (Sign)</button>
                            <button type="button" onclick="window.setCompressPreset(50)" class="comp-preset-btn px-2.5 py-1 rounded-lg text-xs font-black bg-amber-400 text-dark-950">&lt; 50 KB (Photo)</button>
                            <button type="button" onclick="window.setCompressPreset(100)" class="comp-preset-btn px-2.5 py-1 rounded-lg text-xs font-black bg-white border border-slate-200">&lt; 100 KB</button>
                            <button type="button" onclick="window.setCompressPreset(200)" class="comp-preset-btn px-2.5 py-1 rounded-lg text-xs font-black bg-white border border-slate-200">&lt; 200 KB</button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">कस्टम टारगेट साइज (Target KB)</label>
                            <div class="flex gap-2">
                                <input type="number" id="compTargetKb" value="50" min="10" max="9000" class="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-black bg-white outline-none">
                                <button type="button" onclick="window.executeSmartCompression()" class="bg-dark-900 hover:bg-black text-royal-300 font-black px-4 py-2.5 rounded-xl text-xs shadow-sm">
                                    Compress Now
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                            <div>
                                <span class="text-[10px] font-black text-green-700 uppercase block">कंप्रेस्ड साइज (Result):</span>
                                <span id="compResultSizeText" class="text-sm font-black text-green-800">--</span>
                            </div>
                            <button type="button" id="btnDownloadCompressed" onclick="window.downloadCompressedImage()" class="bg-green-600 hover:bg-green-700 text-white font-black px-4 py-2 rounded-xl text-xs transition shadow-sm">
                                <i class="fa-solid fa-download mr-1"></i> Download
                            </button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                        <span class="text-xs font-bold text-slate-400 block mb-2">Original Preview</span>
                        <img id="compOriginalPreview" class="max-h-80 mx-auto rounded-lg object-contain shadow-sm">
                    </div>
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                        <span class="text-xs font-bold text-green-700 block mb-2">Compressed Preview</span>
                        <img id="compResultPreview" class="max-h-80 mx-auto rounded-lg object-contain shadow-sm">
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.compressorState = {
    file: null,
    img: null,
    resultBlobUrl: null,
    viewZoom: 1.0
};

window.handleCompressorUpload = function(file) {
    if (!file) return;
    if (!window.validateFileSize(file, 100)) return;

    window.compressorState.file = file;
    const origSizeKb = (file.size / 1024).toFixed(1);
    document.getElementById('compOrigSizeText').innerText = `${origSizeKb} KB (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.compressorState.img = img;
            document.getElementById('compOriginalPreview').src = img.src;
            document.getElementById('compUploadBox').classList.add('hidden');
            document.getElementById('compWorkspaceSection').classList.remove('hidden');
            window.executeSmartCompression();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.setCompressPreset = function(kb) {
    document.getElementById('compTargetKb').value = kb;
    document.querySelectorAll('.comp-preset-btn').forEach(b => {
        b.className = "comp-preset-btn px-2.5 py-1 rounded-lg text-xs font-black bg-white border border-slate-200 text-slate-700";
    });
    window.executeSmartCompression();
};

window.executeSmartCompression = async function() {
    const img = window.compressorState.img;
    if (!img) return;

    const targetKb = parseFloat(document.getElementById('compTargetKb')?.value || 50);
    const targetBytes = targetKb * 1024;

    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    let quality = 0.92;
    let resultBlob = null;

    for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resultBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        if (resultBlob.size <= targetBytes || (width < 300 && quality < 0.3)) {
            break;
        }

        if (quality > 0.4) {
            quality -= 0.15;
        } else {
            width = Math.round(width * 0.85);
            height = Math.round(height * 0.85);
        }
    }

    if (resultBlob) {
        const resultSizeKb = (resultBlob.size / 1024).toFixed(1);
        const reduction = (100 - (resultBlob.size / window.compressorState.file.size) * 100).toFixed(0);
        document.getElementById('compResultSizeText').innerText = `${resultSizeKb} KB (${reduction}% कम हुआ)`;

        if (window.compressorState.resultBlobUrl) {
            URL.revokeObjectURL(window.compressorState.resultBlobUrl);
        }
        window.compressorState.resultBlobUrl = URL.createObjectURL(resultBlob);
        document.getElementById('compResultPreview').src = window.compressorState.resultBlobUrl;
    }
};

window.downloadCompressedImage = function() {
    if (!window.compressorState.resultBlobUrl) return alert('पहले इमेज कंप्रेस करें!');
    window.triggerFileDownload(window.compressorState.resultBlobUrl, `Compressed_${Date.now()}.jpg`);
};

