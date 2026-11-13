// ============================================================================
// FILE: js/tools-photo.js
// Passport Photo Studio (Magic Wand + Touch-Up Brush + 4x6 8-Photo Sheet),
// Background Remover & Smart Image Compressor
// ============================================================================

window.ppState = {
    originalImg: null,
    processedImageCanvas: null,
    bgColor: '#ffffff',
    activeMode: 'wand',
    brushSize: 20,
    isBrushing: false
};
window.bgRemoverState = { img: null, targetColor: '#ffffff', viewZoom: 1.0, undoStack: [] };
window.compressorState = { file: null, img: null, resultBlobUrl: null, viewZoom: 1.0 };

// ============================================================================
// TOOL 1: PASSPORT PHOTO STUDIO
// ============================================================================
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
                        <p class="text-[11px] font-semibold text-slate-400">3.5 × 4.5 cm स्टैंडर्ड साइज • मैजिक वैंड &amp; टच-अप ब्रश • A4 &amp; 4×6 (8 फोटो) शीट</p>
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
                            <span>सेंसिटिविटी (Tolerance):</span>
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
                        <p id="ppToolHintText" class="text-[10px] font-semibold text-slate-400">फोटो के बैकग्राउंड पर क्लिक करें या टच-अप ब्रश से साफ करें।</p>
                    </div>

                    <div class="space-y-2.5 p-3 bg-white rounded-xl border border-slate-200">
                        <div>
                            <div class="flex justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                                <span>Zoom:</span>
                                <span id="ppZoomVal">1.0x</span>
                            </div>
                            <input type="range" id="ppZoomSlider" min="0.5" max="3" step="0.05" value="1" oninput="document.getElementById('ppZoomVal').innerText=parseFloat(this.value).toFixed(2)+'x'; window.renderPassportStudio()" class="w-full accent-amber-500 cursor-pointer">
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
                    <canvas id="ppMainCanvas" class="bg-white shadow-xl rounded-lg max-w-full h-auto border border-slate-300 cursor-crosshair"></canvas>
                </div>
            </div>
        </div>
    `;
    window.bindPassportCanvasEvents();
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
    return { r: (val >> 16) & 255, g: (val >> 8) & 255, b: val & 255 };
};

window.togglePassportMagicWand = function() {
    window.ppState.activeMode = 'wand';
    const wandBtn = document.getElementById('btnPpMagicWand');
    const brushBtn = document.getElementById('btnPpWhiteBrush');
    const hint = document.getElementById('ppToolHintText');
    if (wandBtn) wandBtn.className = "flex-1 bg-amber-400 text-dark-950 border border-amber-500 py-1.5 px-2 rounded-lg text-[11px] font-black shadow-sm flex items-center justify-center gap-1";
    if (brushBtn) brushBtn.className = "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1";
    if (hint) hint.innerText = 'मैजिक वैंड एक्टिव: कैनवास पर बैकग्राउंड के किसी भी हिस्से पर क्लिक करें।';
};

window.togglePassportWhiteBrush = function() {
    window.ppState.activeMode = 'brush';
    const wandBtn = document.getElementById('btnPpMagicWand');
    const brushBtn = document.getElementById('btnPpWhiteBrush');
    const hint = document.getElementById('ppToolHintText');
    if (brushBtn) brushBtn.className = "flex-1 bg-amber-400 text-dark-950 border border-amber-500 py-1.5 px-2 rounded-lg text-[11px] font-black shadow-sm flex items-center justify-center gap-1";
    if (wandBtn) wandBtn.className = "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1";
    if (hint) hint.innerText = 'टच-अप ब्रश एक्टिव: पहले फोटो पर माउस/उंगली से दाग-धब्बे या किनारे साफ करें।';
};

window.bindPassportCanvasEvents = function() {
    const canvas = document.getElementById('ppMainCanvas');
    if (!canvas) return;

    const getSourceCoords = (clientX, clientY) => {
        const proc = window.ppState.processedImageCanvas;
        if (!proc) return null;
        const rect = canvas.getBoundingClientRect();
        const cx = (clientX - rect.left) * (canvas.width / rect.width);
        const cy = (clientY - rect.top) * (canvas.height / rect.height);
        const layout = document.getElementById('ppSheetLayout')?.value || 'sheet_a4_row1';
        const zoom = parseFloat(document.getElementById('ppZoomSlider')?.value || 1);
        const panX = parseFloat(document.getElementById('ppPanXSlider')?.value || 0);
        const panY = parseFloat(document.getElementById('ppPanYSlider')?.value || 0);
        const photoW = 413, photoH = 531;

        let localX = cx, localY = cy;
        if (layout === 'sheet_4x6') {
            const pW = 410, pH = 528, gX = 28, gY = 42, sX = 38, sY = 51;
            const col = Math.floor((cx - sX) / (pW + gX));
            const row = Math.floor((cy - sY) / (pH + gY));
            if (col < 0 || col > 3 || row < 0 || row > 1) return null;
            localX = ((cx - (sX + col * (pW + gX))) / pW) * photoW;
            localY = ((cy - (sY + row * (pH + gY))) / pH) * photoH;
        } else if (layout !== 'single') {
            const a4W = 385, a4H = 495, gX = 16, gY = 24, sX = 45, sY = 70;
            const col = Math.floor((cx - sX) / (a4W + gX));
            const row = Math.floor((cy - sY) / (a4H + gY));
            if (col < 0 || col > 5 || row < 0 || row > 4) return null;
            localX = ((cx - (sX + col * (a4W + gX))) / a4W) * photoW;
            localY = ((cy - (sY + row * (a4H + gY))) / a4H) * photoH;
        }

        const imgAspect = proc.width / proc.height;
        let drawW = photoW, drawH = photoW / imgAspect;
        if (drawH < photoH) { drawH = photoH; drawW = photoH * imgAspect; }

        const relX = (localX - (photoW / 2 + panX)) / zoom;
        const relY = (localY - (photoH / 2 + panY)) / zoom;
        const imgX = Math.round(((relX + drawW / 2) / drawW) * proc.width);
        const imgY = Math.round(((relY + drawH / 2) / drawH) * proc.height);
        if (imgX < 0 || imgY < 0 || imgX >= proc.width || imgY >= proc.height) return null;
        return { x: imgX, y: imgY };
    };

    const applyBrushAt = (pt) => {
        const proc = window.ppState.processedImageCanvas;
        if (!proc || !pt) return;
        const ctx = proc.getContext('2d');
        const fillCol = window.ppState.bgColor === 'original' ? '#ffffff' : (window.ppState.bgColor || '#ffffff');
        ctx.fillStyle = fillCol;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(8, Math.round(proc.width * 0.025)), 0, Math.PI * 2);
        ctx.fill();
        window.renderPassportStudio();
    };

    const applyWandAt = (pt) => {
        const proc = window.ppState.processedImageCanvas;
        if (!proc || !pt) return;
        const ctx = proc.getContext('2d');
        const imgData = ctx.getImageData(0, 0, proc.width, proc.height);
        const d = imgData.data;
        const idx = (pt.y * proc.width + pt.x) * 4;
        const refR = d[idx], refG = d[idx + 1], refB = d[idx + 2];
        const tol = parseInt(document.getElementById('ppBgTolerance')?.value || 35);
        const tolSq = tol * tol * 3;
        const targetRgb = window.hexToRgb(window.ppState.bgColor === 'original' ? '#ffffff' : (window.ppState.bgColor || '#ffffff'));

        for (let i = 0; i < d.length; i += 4) {
            const dr = d[i] - refR, dg = d[i + 1] - refG, db = d[i + 2] - refB;
            if (dr * dr + dg * dg + db * db <= tolSq) {
                d[i] = targetRgb.r; d[i + 1] = targetRgb.g; d[i + 2] = targetRgb.b;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        window.renderPassportStudio();
    };

    canvas.onmousedown = (e) => {
        const pt = getSourceCoords(e.clientX, e.clientY);
        if (!pt) return;
        if (window.ppState.activeMode === 'brush') {
            window.ppState.isBrushing = true;
            applyBrushAt(pt);
        } else {
            applyWandAt(pt);
        }
    };
    canvas.onmousemove = (e) => {
        if (!window.ppState.isBrushing || window.ppState.activeMode !== 'brush') return;
        const pt = getSourceCoords(e.clientX, e.clientY);
        if (pt) applyBrushAt(pt);
    };
    window.addEventListener('mouseup', () => { window.ppState.isBrushing = false; });
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
    off.width = img.width; off.height = img.height;
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
    const bgR = Math.round(sampleR / (samplesCount || 1));
    const bgG = Math.round(sampleG / (samplesCount || 1));
    const bgB = Math.round(sampleB / (samplesCount || 1));

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
    } else if (layout === 'sheet_4x6') {
        // 6x4 Inch Landscape at 300 DPI = 1800 x 1200 px (4 columns x 2 rows = 8 photos)
        canvas.width = 1800; canvas.height = 1200;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const pW = 410, pH = 528, gapX = 28, gapY = 42, startX = 38, startY = 51;
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                const x = startX + col * (pW + gapX);
                const y = startY + row * (pH + gapY);
                ctx.drawImage(singleCanvas, x, y, pW, pH);
                ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1;
                ctx.strokeRect(x - 1, y - 1, pW + 2, pH + 2);
            }
        }
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
    const layout = document.getElementById('ppSheetLayout')?.value || 'sheet_a4_row1';
    try {
        await window.ensurePdfLibLoaded();
        const { PDFDocument } = window.getPDFLib();
        const pdfDoc = await PDFDocument.create();
        const embeddedImg = await pdfDoc.embedJpg(canvas.toDataURL('image/jpeg', 0.98));
        const pageDims = layout === 'sheet_4x6' ? [432, 288] : [595.28, 841.89];
        const page = pdfDoc.addPage(pageDims);
        page.drawImage(embeddedImg, { x: 0, y: 0, width: pageDims[0], height: pageDims[1] });
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
// TOOL 2: BACKGROUND REMOVER & WHITE BG CONVERTER
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

            <div id="bgUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('bgFileInput').click()">
                <input type="file" id="bgFileInput" accept="image/*" class="hidden" onchange="window.handleBgRemoverUpload(this.files[0])">
                <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-emerald-200">
                    <i class="fa-solid fa-image"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ इमेज अपलोड करें (क्लिक करें या ड्रैग करें)</h3>
                <p class="text-xs font-semibold text-slate-400">JPG, PNG, WEBP</p>
            </div>

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

                        <div class="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm ml-1">
                            <span class="text-[10px] font-bold text-slate-400 mr-0.5">Zoom:</span>
                            <button type="button" onclick="window.zoomBgRemover(-0.25)" class="w-6 h-6 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-slate-100 rounded" title="Zoom Out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                            <span id="bgZoomText" class="text-xs font-black text-slate-800 min-w-[34px] text-center">100%</span>
                            <button type="button" onclick="window.zoomBgRemover(0.25)" class="w-6 h-6 flex items-center justify-center font-bold text-xs text-slate-700 hover:bg-slate-100 rounded" title="Zoom In"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                            <button type="button" onclick="window.resetBgZoom()" class="text-[10px] text-slate-400 hover:text-slate-700 ml-0.5">Reset</button>
                        </div>

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

window.handleBgRemoverUpload = function(file) {
    if (!file || !window.validateFileSize(file, 100)) return;
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

    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;

    let avgR = 0, avgG = 0, avgB = 0, count = 0;
    for (let x = 0; x < w; x += 10) {
        const idx = x * 4;
        avgR += d[idx]; avgG += d[idx + 1]; avgB += d[idx + 2];
        count++;
    }
    avgR = Math.round(avgR / (count || 1));
    avgG = Math.round(avgG / (count || 1));
    avgB = Math.round(avgB / (count || 1));

    const isTrans = window.bgRemoverState.targetColor === 'transparent';
    let repR = 255, repG = 255, repB = 255;
    if (window.bgRemoverState.targetColor === '#99ccff') { repR = 153; repG = 204; repB = 255; }
    const tolSq = tol * tol * 3;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dist = (r - avgR) * (r - avgR) + (g - avgG) * (g - avgG) + (b - avgB) * (b - avgB);
        if (dist <= tolSq) {
            if (isTrans) d[i + 3] = 0;
            else { d[i] = repR; d[i + 1] = repG; d[i + 2] = repB; d[i + 3] = 255; }
        }
    }
    ctx.putImageData(imgData, 0, 0);
};

window.downloadBgResult = function() {
    const canvas = document.getElementById('bgResultCanvas');
    if (!canvas) return;
    window.triggerFileDownload(canvas.toDataURL('image/png'), `Clean_Photo_${Date.now()}.png`);
};

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
    window.bgRemoverState.targetColor = stack.pop();
    window.processBgRemoval();
};

// ============================================================================
// TOOL 8: SMART IMAGE COMPRESSOR
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

window.handleCompressorUpload = function(file) {
    if (!file || !window.validateFileSize(file, 100)) return;
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
    let width = img.width, height = img.height, quality = 0.92, resultBlob = null;

    for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resultBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        if (resultBlob.size <= targetBytes || (width < 300 && quality < 0.3)) break;
        if (quality > 0.4) quality -= 0.15;
        else { width = Math.round(width * 0.85); height = Math.round(height * 0.85); }
    }

    if (resultBlob) {
        const resultSizeKb = (resultBlob.size / 1024).toFixed(1);
        const reduction = (100 - (resultBlob.size / window.compressorState.file.size) * 100).toFixed(0);
        document.getElementById('compResultSizeText').innerText = `${resultSizeKb} KB (${reduction}% कम हुआ)`;
        if (window.compressorState.resultBlobUrl) URL.revokeObjectURL(window.compressorState.resultBlobUrl);
        window.compressorState.resultBlobUrl = URL.createObjectURL(resultBlob);
        document.getElementById('compResultPreview').src = window.compressorState.resultBlobUrl;
    }
};

window.downloadCompressedImage = function() {
    if (!window.compressorState.resultBlobUrl) return alert('पहले इमेज कंप्रेस करें!');
    window.triggerFileDownload(window.compressorState.resultBlobUrl, `Compressed_${Date.now()}.jpg`);
};

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
