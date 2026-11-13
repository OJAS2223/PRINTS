// ============================================================================
// FILE: js/tools-pdf-editor.js
// True A4 PDF Text & Stamp Editor (In-Place Edit, Content-Aware Inpaint, Undo/Zoom)
// ============================================================================

window.pdfEditorState = {
    pdfDoc: null,
    currentPage: 1,
    scale: 2.0,
    activeMode: 'click_edit',
    currentActiveItem: null,
    boxStartX: 0,
    boxStartY: 0,
    isDraggingBox: false,
    pageCanvasMap: {},
    pageDimsMap: {},
    viewZoom: 1.0,
    undoStack: []
};

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

            <div id="pdfEditUploadBox" class="p-6 rounded-3xl dropzone-box text-center space-y-2 bg-slate-50 cursor-pointer" onclick="document.getElementById('pdfEditFileInput').click()">
                <input type="file" id="pdfEditFileInput" accept="application/pdf" class="hidden" onchange="window.handlePdfEditorUpload(this.files[0])">
                <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-rose-200">
                    <i class="fa-solid fa-file-pen"></i>
                </div>
                <h3 class="text-sm font-black text-slate-800">यहाँ PDF फाइल अपलोड करें</h3>
                <p class="text-xs font-semibold text-slate-400">एडिट करने के लिए PDF चुनें</p>
            </div>

            <div id="pdfEditWorkspace" class="hidden space-y-4">
                <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <button type="button" onclick="window.navPdfEditPage(-1)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold" title="पिछला पेज"><i class="fa-solid fa-chevron-left"></i></button>
                        <span id="pdfEditPageIndicator" class="text-xs font-black text-slate-800">Page 1 / 1</span>
                        <button type="button" onclick="window.navPdfEditPage(1)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold" title="अगला पेज"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>

                    <div class="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-sm">
                        <button type="button" onclick="window.zoomPdfEditor(-0.2)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-black" title="Zoom Out (-)"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                        <span id="pdfEditZoomText" class="text-xs font-black text-slate-800 px-1 min-w-[40px] text-center">100%</span>
                        <button type="button" onclick="window.zoomPdfEditor(0.2)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-black" title="Zoom In (+)"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                        <button type="button" onclick="window.resetPdfEditorZoom()" class="text-[10px] font-bold text-slate-400 hover:text-slate-800 px-1.5 py-1 rounded hover:bg-slate-100 ml-0.5">Reset</button>
                    </div>

                    <button type="button" id="btnUndoPdfEdit" onclick="window.undoPdfEditorAction()" class="px-3 py-2 rounded-xl text-xs font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5 shadow-sm" title="Undo (पिछला बदलाव वापस लें)">
                        <i class="fa-solid fa-rotate-left text-amber-500"></i> <span>Undo</span>
                    </button>

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

                <div class="bg-slate-300/80 p-3 md:p-6 rounded-3xl flex justify-center items-start overflow-auto min-h-[650px]">
                    <div id="a4DeskWrapper" class="a4-desk-sheet rounded-lg overflow-hidden relative shadow-a4 bg-white border border-slate-300">
                        <canvas id="pdfEditCanvas" class="block bg-white w-full h-auto"></canvas>
                        <div id="pdfTextOverlayLayer" class="absolute inset-0 z-20 pointer-events-auto"></div>
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

window.inpaintCanvasBackground = function(ctx, startX, startY, width, height, onlyTextStrokes = true) {
    const canvas = ctx.canvas;
    const cw = canvas.width, ch = canvas.height;
    const x0 = Math.max(0, Math.floor(startX)), y0 = Math.max(0, Math.floor(startY));
    const x1 = Math.min(cw, Math.ceil(startX + width)), y1 = Math.min(ch, Math.ceil(startY + height));
    const boxW = x1 - x0, boxH = y1 - y0;
    if (boxW <= 0 || boxH <= 0) return;

    const sampleYTop = Math.max(0, y0 - 2);
    const sampleYBot = Math.min(ch - 1, y1 + 1);
    const imgData = ctx.getImageData(x0, y0, boxW, boxH);
    const d = imgData.data;
    const topRowData = ctx.getImageData(x0, sampleYTop, boxW, 1).data;
    const botRowData = ctx.getImageData(x0, sampleYBot, boxW, 1).data;

    for (let bx = 0; bx < boxW; bx++) {
        const topIdx = bx * 4;
        const tR = topRowData[topIdx], tG = topRowData[topIdx + 1], tB = topRowData[topIdx + 2];
        const bR = botRowData[topIdx], bG = botRowData[topIdx + 1], bB = botRowData[topIdx + 2];
        for (let by = 0; by < boxH; by++) {
            const idx = (by * boxW + bx) * 4;
            const t = boxH > 1 ? (by / (boxH - 1)) : 0;
            const bgR = Math.round((1 - t) * tR + t * bR);
            const bgG = Math.round((1 - t) * tG + t * bG);
            const bgB = Math.round((1 - t) * tB + t * bB);
            if (!onlyTextStrokes) {
                d[idx] = bgR; d[idx + 1] = bgG; d[idx + 2] = bgB;
            } else {
                const curR = d[idx], curG = d[idx + 1], curB = d[idx + 2];
                const diff = Math.abs(curR - bgR) + Math.abs(curG - bgG) + Math.abs(curB - bgB);
                if (diff > 22) {
                    const alpha = Math.min(1.0, (diff - 18) / 24);
                    d[idx] = Math.round((1 - alpha) * curR + alpha * bgR);
                    d[idx + 1] = Math.round((1 - alpha) * curG + alpha * bgG);
                    d[idx + 2] = Math.round((1 - alpha) * curB + alpha * bgB);
                }
            }
        }
    }
    ctx.putImageData(imgData, x0, y0);
};

window.sampleCanvasBackground = function(ctx, x, y, w, h) {
    try {
        const canvasW = ctx.canvas.width, canvasH = ctx.canvas.height;
        const checkPoints = [
            [x, Math.max(0, y - 4)], [x + w / 2, Math.max(0, y - 4)],
            [Math.min(canvasW - 1, x + w), Math.max(0, y - 4)],
            [Math.max(0, x - 4), y + h / 2], [Math.min(canvasW - 1, x + w + 4), y + h / 2]
        ];
        let totR = 0, totG = 0, totB = 0, validSamples = 0;
        checkPoints.forEach(([px, py]) => {
            const pixel = ctx.getImageData(Math.max(0, Math.min(canvasW - 1, Math.round(px))), Math.max(0, Math.min(canvasH - 1, Math.round(py))), 1, 1).data;
            if (pixel[0] > 160 || pixel[1] > 160 || pixel[2] > 160) {
                totR += pixel[0]; totG += pixel[1]; totB += pixel[2]; validSamples++;
            }
        });
        if (validSamples > 0) return `rgb(${Math.round(totR / validSamples)}, ${Math.round(totG / validSamples)}, ${Math.round(totB / validSamples)})`;
    } catch (e) {}
    return '#ffffff';
};

window.handlePdfEditorUpload = async function(file) {
    if (!file || !window.validateFileSize(file, 100)) return;
    try {
        await window.ensurePdfViewerLoaded();
        const arrayBuffer = await file.arrayBuffer();
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

    if (mode === 'click_edit') banner.innerHTML = `<i class="fa-solid fa-circle-info text-amber-600 text-sm"></i><span>💡 <strong>क्लिक-टू-एडिट एक्टिव:</strong> किसी भी शब्द पर क्लिक करके वहीं बदलें।</span>`;
    else if (mode === 'box_replace') banner.innerHTML = `<i class="fa-solid fa-vector-square text-indigo-600 text-sm"></i><span>📐 <strong>बॉक्स रिप्लेस एक्टिव:</strong> माउस से किसी भी लाइन या एरिया पर बॉक्स खींचें, नया टेक्स्ट लिखें।</span>`;
    else if (mode === 'whiteout') banner.innerHTML = `<i class="fa-solid fa-eraser text-rose-600 text-sm"></i><span>🧹 <strong>व्हाइटआउट (इरेज़र) एक्टिव:</strong> जिस भाग को मिटाना चाहते हैं, उसपर माउस से बॉक्स खींचें।</span>`;
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
    const viewport = page.getViewport({ scale });
    const naturalViewport = page.getViewport({ scale: 1.0 });

    window.pdfEditorState.pageDimsMap[pageNum] = [naturalViewport.width, naturalViewport.height];
    wrapper.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    wrapper.style.maxWidth = Math.min(840, Math.round(viewport.width / (scale / 1.15))) + 'px';

    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (window.pdfEditorState.pageCanvasMap[pageNum]) {
        const cachedImg = new Image();
        cachedImg.onload = () => { ctx.drawImage(cachedImg, 0, 0); window.buildInteractiveTextOverlay(page, viewport, scale); };
        cachedImg.src = window.pdfEditorState.pageCanvasMap[pageNum];
    } else {
        await page.render({ canvasContext: ctx, viewport }).promise;
        window.buildInteractiveTextOverlay(page, viewport, scale);
    }
};

window.buildInteractiveTextOverlay = async function(page, viewport, scale) {
    const overlay = document.getElementById('pdfTextOverlayLayer');
    const canvas = document.getElementById('pdfEditCanvas');
    if (!overlay || !canvas) return;
    overlay.innerHTML = '';
    const textContent = await page.getTextContent();

    textContent.items.forEach((item) => {
        if (!item.str || !item.str.trim()) return;
        const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
        const fontSizeCanvas = fontSize * scale;
        const itemW = item.width * scale;
        const itemH = fontSizeCanvas * 1.25;

        const div = document.createElement('div');
        div.className = 'pdf-text-highlight';
        div.style.left = ((vx / viewport.width) * 100) + '%';
        div.style.top = (((vy - fontSizeCanvas * 0.95) / viewport.height) * 100) + '%';
        div.style.width = Math.max((itemW / viewport.width) * 100, 0.5) + '%';
        div.style.height = ((itemH / viewport.height) * 100) + '%';
        div.title = `Click to edit: "${item.str}"`;
        div.onclick = (e) => {
            e.stopPropagation();
            if (window.pdfEditorState.activeMode !== 'click_edit') return;
            window.openInPlaceEditor(item, vx, vy, itemW, itemH, fontSize);
        };
        overlay.appendChild(div);
    });

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
        const boxX = Math.min(window.pdfEditorState.boxStartX, endX);
        const boxY = Math.min(window.pdfEditorState.boxStartY, endY);
        const boxW = Math.abs(endX - window.pdfEditorState.boxStartX);
        const boxH = Math.abs(endY - window.pdfEditorState.boxStartY);
        if (boxW < 8 || boxH < 8) return;

        const ctx = canvas.getContext('2d');
        if (window.pdfEditorState.activeMode === 'whiteout') {
            window.savePdfEditorUndoState();
            window.inpaintCanvasBackground(ctx, boxX, boxY, boxW, boxH, false);
            window.pdfEditorState.pageCanvasMap[window.pdfEditorState.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
        } else if (window.pdfEditorState.activeMode === 'box_replace') {
            const newText = prompt('इस चुने हुए एरिया के लिए नया टेक्स्ट लिखें:', '');
            if (newText !== null && newText.trim()) {
                window.savePdfEditorUndoState();
                window.inpaintCanvasBackground(ctx, boxX, boxY, boxW, boxH, false);
                ctx.fillStyle = '#000000';
                ctx.font = `bold ${Math.max(14, Math.round(boxH * 0.72))}px Arial, sans-serif`;
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
    popup.style.left = Math.min((vx / canvas.width) * 100, 65) + '%';
    popup.style.top = Math.min(((vy + 8) / canvas.height) * 100, 80) + '%';
    popup.classList.remove('hidden');
    input.focus(); input.select();
    input.onkeydown = (e) => {
        if (e.key === 'Enter') window.applyInPlaceEdit();
        else if (e.key === 'Escape') window.cancelInPlaceEdit();
    };
};

window.cancelInPlaceEdit = function() {
    const popup = document.getElementById('inPlaceEditorPopup');
    if (popup) popup.classList.add('hidden');
    window.pdfEditorState.currentActiveItem = null;
};

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

    const eraseTop = Math.max(0, vy - fontSizeCanvas * 1.05);
    const eraseHeight = fontSizeCanvas * 1.35;
    const eraseLeft = Math.max(0, vx - 2);
    ctx.font = `bold ${fontSizeCanvas}px Arial, sans-serif`;
    const eraseWidth = Math.max(itemW + 6, ctx.measureText(newStr).width + 6);

    window.savePdfEditorUndoState();
    window.inpaintCanvasBackground(ctx, eraseLeft, eraseTop, eraseWidth, eraseHeight, true);

    if (newStr) {
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSizeCanvas}px Arial, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(newStr, vx, vy);
    }

    window.pdfEditorState.pageCanvasMap[window.pdfEditorState.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
    window.cancelInPlaceEdit();
};

window.savePdfEditorUndoState = function() {
    const canvas = document.getElementById('pdfEditCanvas');
    if (!canvas) return;
    if (!window.pdfEditorState.undoStack) window.pdfEditorState.undoStack = [];
    if (window.pdfEditorState.undoStack.length >= 25) window.pdfEditorState.undoStack.shift();
    window.pdfEditorState.undoStack.push({ page: window.pdfEditorState.currentPage, dataUrl: canvas.toDataURL('image/jpeg', 0.98) });
};

window.undoPdfEditorAction = function() {
    const stack = window.pdfEditorState.undoStack;
    if (!stack || stack.length === 0) return alert('वापस जाने के लिए कोई पिछला बदलाव (Undo Step) नहीं है।');
    const lastState = stack.pop();
    const canvas = document.getElementById('pdfEditCanvas');
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
        canvas.getContext('2d').drawImage(img, 0, 0);
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
    if (wrapper) { wrapper.style.transform = `scale(${z})`; wrapper.style.transformOrigin = 'top center'; }
    if (zoomText) zoomText.innerText = Math.round(z * 100) + '%';
};

window.resetPdfEditorZoom = function() {
    window.pdfEditorState.viewZoom = 1.0;
    const wrapper = document.getElementById('a4DeskWrapper');
    const zoomText = document.getElementById('pdfEditZoomText');
    if (wrapper) { wrapper.style.transform = 'scale(1)'; wrapper.style.transformOrigin = 'top center'; }
    if (zoomText) zoomText.innerText = '100%';
};

window.navPdfEditPage = function(dir) {
    const state = window.pdfEditorState;
    const next = state.currentPage + dir;
    if (next < 1 || next > state.pdfDoc.numPages) return;
    const canvas = document.getElementById('pdfEditCanvas');
    if (canvas) state.pageCanvasMap[state.currentPage] = canvas.toDataURL('image/jpeg', 0.98);
    state.currentPage = next;
    window.renderPdfEditorA4Page();
};

window.saveAndDownloadEditedPdf = async function() {
    const state = window.pdfEditorState;
    if (!state || !state.pdfDoc) return alert('कृपया पहले कोई PDF फाइल अपलोड करें!');
    const canvas = document.getElementById('pdfEditCanvas');
    if (canvas) state.pageCanvasMap[state.currentPage] = canvas.toDataURL('image/jpeg', 0.98);

    const btn = document.getElementById('btnSavePdfEditor');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...'; }

    try {
        await window.ensurePdfLibLoaded();
        const pdfLib = window.getPDFLib();
        if (!pdfLib || !pdfLib.PDFDocument) throw new Error('PDF-Lib लाइब्रेरी उपलब्ध नहीं है। कृपया पेज रिफ्रेश करें।');
        const { PDFDocument } = pdfLib;

        let newDoc;
        try {
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
            newDoc = await PDFDocument.create();
            for (let p = 1; p <= state.pdfDoc.numPages; p++) {
                const dims = (state.pageDimsMap && state.pageDimsMap[p]) ? state.pageDimsMap[p] : [595.28, 841.89];
                let pageImg = state.pageCanvasMap[p];
                if (!pageImg) {
                    const page = await state.pdfDoc.getPage(p);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const c = document.createElement('canvas');
                    c.width = viewport.width; c.height = viewport.height;
                    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
                    pageImg = c.toDataURL('image/jpeg', 0.96);
                }
                const embedded = await newDoc.embedJpg(pageImg);
                const newP = newDoc.addPage(dims);
                newP.drawImage(embedded, { x: 0, y: 0, width: dims[0], height: dims[1] });
            }
        }

        const pdfBytes = await newDoc.save();
        window.triggerFileDownload(new Blob([pdfBytes], { type: 'application/pdf' }), `Edited_Document_${Date.now()}.pdf`);
        setTimeout(() => alert('🎉 सफलता! आपकी एडिट की गई PDF फाइल डाउनलोड हो गई है।'), 350);
    } catch (e) {
        alert('PDF सेव करने में समस्या आई: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
};
