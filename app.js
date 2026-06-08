/* Prism Application Controller (with User Authentication & SQLite Storage) */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // Application State
    // ----------------------------------------------------
    let state = JSON.parse(JSON.stringify(PRISM_DEFAULT_STATE));
    let undoStack = [];
    let redoStack = [];
    const maxStackSize = 35;

    let originalImage = null;
    let fileName = "";
    let fileType = "image/jpeg";
    
    // Zoom and Pan states
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    
    // UI state flags
    let isDraggingSlider = false;
    let currentHslColor = 'red'; // Active color channel band
    let isCompareMode = false;
    let splitPercent = 50;
    let isDraggingSplit = false;
    
    // Full-stack Authentication & Project states
    let authToken = localStorage.getItem('prism_token') || null;
    let loggedInUser = localStorage.getItem('prism_user') || null;
    let currentProjectId = null;
    let authMode = 'login'; // 'login' or 'signup'

    // Elements Cache
    const el = {
        undo: document.getElementById('btn-undo'),
        redo: document.getElementById('btn-redo'),
        compare: document.getElementById('btn-compare'),
        reset: document.getElementById('btn-reset'),
        uploadTrigger: document.getElementById('btn-upload-trigger'),
        imageLoader: document.getElementById('image-loader'),
        loadSample: document.getElementById('btn-load-sample'),
        loadSampleCenter: document.getElementById('btn-load-sample-center'),
        exportTrigger: document.getElementById('btn-export-trigger'),
        
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Adjustments Sliders
        exposure: document.getElementById('exposure'),
        contrast: document.getElementById('contrast'),
        clarity: document.getElementById('clarity'),
        saturation: document.getElementById('saturation'),
        temperature: document.getElementById('temperature'),
        tint: document.getElementById('tint'),
        vignette: document.getElementById('vignette'),
        blur: document.getElementById('blur'),
        sharpen: document.getElementById('sharpen'),
        
        // HSL Controls
        bandBtns: document.querySelectorAll('.band-btn'),
        bandTitle: document.querySelector('.band-title'),
        hslH: document.getElementById('hsl-h'),
        hslS: document.getElementById('hsl-s'),
        hslL: document.getElementById('hsl-l'),
        
        // Creative Controls
        glitch: document.getElementById('glitch'),
        chromatic: document.getElementById('chromatic'),
        halftone: document.getElementById('halftone'),
        asciiToggle: document.getElementById('ascii-toggle'),
        asciiSize: document.getElementById('ascii-size'),
        duotoneToggle: document.getElementById('duotone-toggle'),
        duotoneShadow: document.getElementById('duotone-shadow'),
        duotoneHighlight: document.getElementById('duotone-highlight'),
        duotonePresetBtns: document.querySelectorAll('.duotone-preset-btn'),
        
        // Workspace
        workspace: document.getElementById('workspace-container'),
        dropzone: document.getElementById('dropzone'),
        viewport: document.getElementById('canvas-viewport'),
        wrapper: document.getElementById('canvas-wrapper'),
        originalCanvas: document.getElementById('original-canvas'),
        displayCanvas: document.getElementById('display-canvas'),
        splitLine: document.getElementById('split-line'),
        
        // Viewport Control
        zoomOut: document.getElementById('btn-zoom-out'),
        zoomIn: document.getElementById('btn-zoom-in'),
        zoomDisplay: document.getElementById('zoom-factor'),
        fitScreen: document.getElementById('btn-fit-screen'),
        
        // Sidebar Right
        presetCards: document.querySelectorAll('.preset-card'),
        pipelineList: document.getElementById('applied-pipeline-list'),
        
        // Status Bar
        statusFilename: document.getElementById('status-filename'),
        statusResolution: document.getElementById('status-resolution'),
        
        // Export Modal
        exportModal: document.getElementById('export-modal'),
        closeExport: document.getElementById('btn-close-export'),
        cancelExport: document.getElementById('btn-cancel-export'),
        confirmExport: document.getElementById('btn-confirm-export'),
        exportFormat: document.getElementById('export-format'),
        exportQualityWrapper: document.getElementById('jpeg-quality-wrapper'),
        exportQuality: document.getElementById('export-quality'),
        valExportQuality: document.getElementById('val-export-quality'),
        exportScale: document.getElementById('export-scale'),
        lblScale1x: document.getElementById('lbl-scale-1x'),
        lblScale2x: document.getElementById('lbl-scale-2x'),
        lblScale05x: document.getElementById('lbl-scale-05x'),
        exportInfoFilename: document.getElementById('export-info-filename'),
        exportInfoDetails: document.getElementById('export-info-details'),

        // Authentication Elements
        authUnauthenticated: document.getElementById('auth-unauthenticated'),
        authAuthenticated: document.getElementById('auth-authenticated'),
        btnSignupTrigger: document.getElementById('btn-signup-trigger'),
        btnLoginTrigger: document.getElementById('btn-login-trigger'),
        userDisplayName: document.getElementById('user-display-name'),
        btnCloudSave: document.getElementById('btn-cloud-save'),
        btnMyGallery: document.getElementById('btn-my-gallery'),
        btnLogout: document.getElementById('btn-logout'),

        // Auth Modal
        authModal: document.getElementById('auth-modal'),
        btnCloseAuth: document.getElementById('btn-close-auth'),
        authForm: document.getElementById('auth-form'),
        authUsername: document.getElementById('auth-username'),
        authPassword: document.getElementById('auth-password'),
        authErrorMsg: document.getElementById('auth-error-msg'),
        btnSubmitAuth: document.getElementById('btn-submit-auth'),
        linkSwitchAuth: document.getElementById('link-switch-auth'),
        authSwitchPrompt: document.getElementById('auth-switch-prompt'),
        authModalTitle: document.getElementById('auth-modal-title'),

        // Gallery Modal
        galleryModal: document.getElementById('gallery-modal'),
        btnCloseGallery: document.getElementById('btn-close-gallery'),
        galleryGridList: document.getElementById('gallery-grid-list')
    };

    // Instantiate Histogram Analyst
    const histogram = new PrismHistogram('histogram-canvas');

    // Initialize Auth Display States
    updateAuthUI();

    // ----------------------------------------------------
    // Tab Controller
    // ----------------------------------------------------
    el.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.tabBtns.forEach(b => b.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // ----------------------------------------------------
    // Image Loader Handlers
    // ----------------------------------------------------
    el.uploadTrigger.addEventListener('click', () => el.imageLoader.click());
    el.imageLoader.addEventListener('change', handleFileSelect);
    
    // Sample Generators
    el.loadSample.addEventListener('click', loadSampleImage);
    el.loadSampleCenter.addEventListener('click', loadSampleImage);
    
    // Drag & Drop
    el.workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.dropzone.classList.add('dragover');
    });
    
    el.workspace.addEventListener('dragleave', () => {
        el.dropzone.classList.remove('dragover');
    });
    
    el.workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        el.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            loadFile(e.dataTransfer.files[0]);
        }
    });

    // Clipboard Paste Listener
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") === 0) {
                const blob = item.getAsFile();
                fileName = "clipboard-image.png";
                loadFile(blob);
                break;
            }
        }
    });

    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            loadFile(e.target.files[0]);
        }
    }

    function loadFile(file) {
        if (!file.type.match('image.*')) {
            alert('Please select a valid image file.');
            return;
        }
        
        fileName = file.name;
        fileType = file.type;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                initializeWorkspaceImage(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Generates a premium sunset landscape vector style as stock demo
     */
    function loadSampleImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // 1. Sky sunset gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0, '#0d0d26');
        skyGrad.addColorStop(0.3, '#1f133d');
        skyGrad.addColorStop(0.6, '#6b204f');
        skyGrad.addColorStop(0.8, '#d95a53');
        skyGrad.addColorStop(1, '#ffaf7b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 2. Stars
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 60; i++) {
            const sx = Math.random() * canvas.width;
            const sy = Math.random() * (canvas.height * 0.5);
            const size = Math.random() * 2 + 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Glowing sun
        const sunX = canvas.width * 0.7;
        const sunY = canvas.height * 0.52;
        const sunRadius = 130;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        sunGrad.addColorStop(0, '#ffffff');
        sunGrad.addColorStop(0.2, '#fff275');
        sunGrad.addColorStop(0.6, '#ff8e53');
        sunGrad.addColorStop(1, 'rgba(255, 142, 83, 0)');
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fillStyle = sunGrad;
        ctx.fill();

        // 4. Background mountain silhouettes
        ctx.fillStyle = '#220b33';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * 0.75);
        ctx.lineTo(250, canvas.height * 0.58);
        ctx.lineTo(550, canvas.height * 0.68);
        ctx.lineTo(950, canvas.height * 0.52);
        ctx.lineTo(1350, canvas.height * 0.65);
        ctx.lineTo(1650, canvas.height * 0.55);
        ctx.lineTo(canvas.width, canvas.height * 0.75);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();

        // 5. Midground mountains
        ctx.fillStyle = '#160524';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * 0.85);
        ctx.lineTo(400, canvas.height * 0.65);
        ctx.lineTo(800, canvas.height * 0.75);
        ctx.lineTo(1200, canvas.height * 0.62);
        ctx.lineTo(canvas.width, canvas.height * 0.82);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();

        // 6. Foreground lake with reflection
        const waterGrad = ctx.createLinearGradient(0, canvas.height * 0.75, 0, canvas.height);
        waterGrad.addColorStop(0, '#10031c');
        waterGrad.addColorStop(0.5, '#2c0c38');
        waterGrad.addColorStop(1, '#08010f');
        ctx.fillStyle = waterGrad;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * 0.75);
        ctx.bezierCurveTo(canvas.width * 0.25, canvas.height * 0.72, canvas.width * 0.75, canvas.height * 0.78, canvas.width, canvas.height * 0.75);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();

        // Sun reflection path
        const reflGrad = ctx.createLinearGradient(sunX - 100, 0, sunX + 100, 0);
        reflGrad.addColorStop(0, 'rgba(255,142,83,0)');
        reflGrad.addColorStop(0.5, 'rgba(255,242,117,0.4)');
        reflGrad.addColorStop(1, 'rgba(255,142,83,0)');
        ctx.fillStyle = reflGrad;
        
        for (let y = canvas.height * 0.76; y < canvas.height; y += 14) {
            const wRatio = (y - canvas.height * 0.76) / (canvas.height * 0.24);
            const w = 80 + wRatio * 250;
            const h = 4 + Math.random() * 4;
            ctx.fillRect(sunX - w/2, y, w, h);
        }

        // Silhouette pine trees in foreground corner
        ctx.fillStyle = '#05010a';
        const drawTree = (tx, ty, tSize) => {
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - tSize * 0.3, ty + tSize);
            ctx.lineTo(tx - tSize * 0.15, ty + tSize);
            ctx.lineTo(tx - tSize * 0.45, ty + tSize * 2);
            ctx.lineTo(tx - tSize * 0.2, ty + tSize * 2);
            ctx.lineTo(tx - tSize * 0.6, ty + tSize * 3.5);
            ctx.lineTo(tx + tSize * 0.6, ty + tSize * 3.5);
            ctx.lineTo(tx + tSize * 0.2, ty + tSize * 2);
            ctx.lineTo(tx + tSize * 0.45, ty + tSize * 2);
            ctx.lineTo(tx + tSize * 0.15, ty + tSize);
            ctx.lineTo(tx + tSize * 0.3, ty + tSize);
            ctx.closePath();
            ctx.fill();
            // trunk
            ctx.fillRect(tx - tSize * 0.08, ty + tSize * 3.5, tSize * 0.16, tSize * 0.6);
        };
        
        drawTree(120, canvas.height * 0.6, 65);
        drawTree(60, canvas.height * 0.65, 80);
        drawTree(180, canvas.height * 0.68, 50);

        fileName = "Prism-Sunset-Sample.png";
        fileType = "image/png";
        currentProjectId = null; // New project ID clear
        
        const sampleImg = new Image();
        sampleImg.onload = () => {
            initializeWorkspaceImage(sampleImg);
        };
        sampleImg.src = canvas.toDataURL('image/png');
    }

    /**
     * Set up canvases and workspace UI layout once image element is loaded
     */
    function initializeWorkspaceImage(img) {
        originalImage = img;
        
        // 1. Copy image onto the offscreen original canvas (preserves pixel dimensions)
        el.originalCanvas.width = img.naturalWidth;
        el.originalCanvas.height = img.naturalHeight;
        const origCtx = el.originalCanvas.getContext('2d');
        origCtx.drawImage(img, 0, 0);
        
        // 2. Set backing size of display canvas
        el.displayCanvas.width = img.naturalWidth;
        el.displayCanvas.height = img.naturalHeight;
        
        // 3. Switch workspace displays
        el.dropzone.style.display = 'none';
        el.viewport.style.display = 'flex';
        el.exportTrigger.removeAttribute('disabled');
        
        // 4. Update status information
        el.statusFilename.textContent = fileName;
        el.statusResolution.textContent = `${img.naturalWidth} x ${img.naturalHeight} px`;
        
        // Reset navigation transforms and center canvas
        resetPanZoom();
        
        // Clear history stack
        undoStack = [];
        redoStack = [];
        updateHistoryButtons();
        
        // Reset parameters to default original
        loadPresetState('original');

        // Update auth buttons state
        updateAuthUI();
    }

    // ----------------------------------------------------
    // Rendering Engine (Preview vs Full Resolution)
    // ----------------------------------------------------
    /**
     * Executes filters pipeline.
     */
    function renderCanvas(lowRes = false) {
        if (!originalImage) return;
        
        const srcW = originalImage.naturalWidth;
        const srcH = originalImage.naturalHeight;
        
        let targetW = srcW;
        let targetH = srcH;
        
        // If slider is moving, process a downscaled thumbnail (max 900px wide) for fluid 60FPS drags
        if (lowRes) {
            const maxDimension = 900;
            if (srcW > maxDimension || srcH > maxDimension) {
                if (srcW > srcH) {
                    targetW = maxDimension;
                    targetH = Math.round((srcH / srcW) * maxDimension);
                } else {
                    targetH = maxDimension;
                    targetW = Math.round((srcW / srcH) * maxDimension);
                }
            }
        }
        
        // 1. Create a temporary source canvas of appropriate resolution
        const tempSource = document.createElement('canvas');
        tempSource.width = targetW;
        tempSource.height = targetH;
        const tempCtx = tempSource.getContext('2d');
        tempCtx.drawImage(el.originalCanvas, 0, 0, targetW, targetH);
        
        // 2. Set matching bounds on the display canvas
        if (el.displayCanvas.width !== targetW || el.displayCanvas.height !== targetH) {
            el.displayCanvas.width = targetW;
            el.displayCanvas.height = targetH;
            
            if (isCompareMode) {
                el.originalCanvas.style.width = '100%';
                el.originalCanvas.style.height = '100%';
            }
        }
        
        // 3. Compile core image processing adjustments onto display canvas
        applyPrismFilters(tempSource, el.displayCanvas, state);
        
        // 4. Update real-time histogram and visual pipeline
        histogram.update(el.displayCanvas);
        renderPipelineLog();
        
        // 5. Update compare clip paths if compare toggled
        updateCompareClip();
    }

    // ----------------------------------------------------
    // Canvas Pan & Zoom Controller
    // ----------------------------------------------------
    function updateCanvasTransform() {
        el.wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
        el.zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }

    function resetPanZoom() {
        if (!originalImage) return;
        
        const viewportWidth = el.viewport.clientWidth;
        const viewportHeight = el.viewport.clientHeight;
        const imgWidth = originalImage.naturalWidth;
        const imgHeight = originalImage.naturalHeight;
        
        const scaleX = (viewportWidth - 80) / imgWidth;
        const scaleY = (viewportHeight - 80) / imgHeight;
        zoomLevel = Math.min(1.0, Math.min(scaleX, scaleY));
        
        panX = 0;
        panY = 0;
        
        updateCanvasTransform();
    }

    el.zoomIn.addEventListener('click', () => adjustZoom(1.2));
    el.zoomOut.addEventListener('click', () => adjustZoom(0.8));
    el.fitScreen.addEventListener('click', resetPanZoom);

    function adjustZoom(factor) {
        zoomLevel = Math.max(0.1, Math.min(10, zoomLevel * factor));
        updateCanvasTransform();
    }

    // Scroll Zoom
    el.viewport.addEventListener('wheel', (e) => {
        if (!originalImage) return;
        e.preventDefault();
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        adjustZoom(zoomFactor);
    }, { passive: false });

    // Workspace Drag Panning
    el.viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.split-handle') || !originalImage) return;
        
        isPanning = true;
        el.viewport.style.cursor = 'grabbing';
        panStart.x = e.clientX - panX;
        panStart.y = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
            updateCanvasTransform();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            el.viewport.style.cursor = 'grab';
        }
    });

    // Window Resize Recenter
    window.addEventListener('resize', () => {
        if (originalImage) {
            updateCanvasTransform();
        }
    });

    // ----------------------------------------------------
    // Compare Mode (Draggable Split Screen)
    // ----------------------------------------------------
    el.compare.addEventListener('click', toggleCompareMode);

    function toggleCompareMode() {
        if (!originalImage) return;
        
        isCompareMode = !isCompareMode;
        el.compare.classList.toggle('active', isCompareMode);
        
        if (isCompareMode) {
            el.originalCanvas.style.display = 'block';
            el.originalCanvas.style.position = 'absolute';
            el.originalCanvas.style.top = '0';
            el.originalCanvas.style.left = '0';
            el.originalCanvas.style.width = '100%';
            el.originalCanvas.style.height = '100%';
            el.originalCanvas.style.zIndex = '1';
            
            el.displayCanvas.style.position = 'relative';
            el.displayCanvas.style.zIndex = '2';
            
            el.splitLine.style.display = 'block';
            splitPercent = 50;
            updateCompareClip();
        } else {
            el.originalCanvas.style.display = 'none';
            el.displayCanvas.style.clipPath = 'none';
            el.splitLine.style.display = 'none';
        }
    }

    function updateCompareClip() {
        if (!isCompareMode) return;
        el.displayCanvas.style.clipPath = `inset(0 0 0 ${splitPercent}%)`;
        el.splitLine.style.left = `${splitPercent}%`;
    }

    // Draggable splitter handle
    el.splitLine.addEventListener('mousedown', (e) => {
        isDraggingSplit = true;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingSplit && originalImage) {
            const wrapperRect = el.wrapper.getBoundingClientRect();
            const relativeX = e.clientX - wrapperRect.left;
            let percent = (relativeX / wrapperRect.width) * 100;
            splitPercent = Math.max(0, Math.min(100, percent));
            updateCompareClip();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingSplit) isDraggingSplit = false;
    });

    // ----------------------------------------------------
    // Control Sliders and Inputs Listeners
    // ----------------------------------------------------
    function registerSlider(id, stateKey, isHsl = false) {
        const slider = el[id];
        const valLabel = document.getElementById(`val-${id}`);
        if (!slider) return;
        
        slider.addEventListener('input', (e) => {
            isDraggingSlider = true;
            const val = parseFloat(e.target.value);
            
            if (isHsl) {
                state.hsl[currentHslColor][stateKey] = val;
            } else {
                state[stateKey] = val;
            }
            
            if (valLabel) {
                valLabel.textContent = val > 0 ? `+${val}` : val;
            }
            
            renderCanvas(true); // Low-res fast preview
        });
        
        slider.addEventListener('change', () => {
            isDraggingSlider = false;
            pushHistoryState();
            renderCanvas(false); // Render clean full-res quality
        });
    }

    // Register basic adjustments
    registerSlider('exposure', 'exposure');
    registerSlider('contrast', 'contrast');
    registerSlider('clarity', 'clarity');
    registerSlider('saturation', 'saturation');
    registerSlider('temperature', 'temperature');
    registerSlider('tint', 'tint');
    registerSlider('vignette', 'vignette');
    registerSlider('blur', 'blur');
    registerSlider('sharpen', 'sharpen');

    // Register HSL adjustments
    registerSlider('hslH', 'h', true);
    registerSlider('hslS', 's', true);
    registerSlider('hslL', 'l', true);

    // Register Creative sliders
    registerSlider('glitch', 'glitch');
    registerSlider('chromatic', 'chromatic');
    registerSlider('halftone', 'halftone');

    // HSL Color Band Button Selectors
    el.bandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.bandBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentHslColor = btn.getAttribute('data-color');
            el.bandTitle.textContent = `${currentHslColor} Channel Controls`;
            
            const data = state.hsl[currentHslColor];
            
            el.hslH.value = data.h;
            document.getElementById('val-hsl-h').textContent = data.h > 0 ? `+${data.h}` : data.h;
            
            el.hslS.value = data.s;
            document.getElementById('val-hsl-s').textContent = data.s > 0 ? `+${data.s}` : data.s;
            
            el.hslL.value = data.l;
            document.getElementById('val-hsl-l').textContent = data.l > 0 ? `+${data.l}` : data.l;
        });
    });

    // ASCII matrix mode toggle
    el.asciiToggle.addEventListener('change', (e) => {
        state.asciiToggle = e.target.checked;
        
        const controlWrapper = document.querySelector('.ascii-control');
        if (state.asciiToggle) {
            controlWrapper.style.opacity = '1';
            controlWrapper.style.pointerEvents = 'auto';
        } else {
            controlWrapper.style.opacity = '0.4';
            controlWrapper.style.pointerEvents = 'none';
        }
        
        pushHistoryState();
        renderCanvas(false);
    });

    // ASCII font sizing
    el.asciiSize.addEventListener('input', (e) => {
        state.asciiSize = parseInt(e.target.value);
        document.getElementById('val-ascii-size').textContent = `${state.asciiSize}px`;
        renderCanvas(true);
    });
    el.asciiSize.addEventListener('change', () => {
        pushHistoryState();
        renderCanvas(false);
    });

    // Duotone filter toggle
    el.duotoneToggle.addEventListener('change', (e) => {
        state.duotoneToggle = e.target.checked;
        
        const controlWrapper = document.querySelector('.duotone-controls');
        if (state.duotoneToggle) {
            controlWrapper.style.opacity = '1';
            controlWrapper.style.pointerEvents = 'auto';
        } else {
            controlWrapper.style.opacity = '0.4';
            controlWrapper.style.pointerEvents = 'none';
        }
        
        pushHistoryState();
        renderCanvas(false);
    });

    // Duotone color inputs
    el.duotoneShadow.addEventListener('input', (e) => {
        state.duotoneShadow = e.target.value;
        e.target.parentElement.style.backgroundColor = e.target.value;
        renderCanvas(true);
    });
    el.duotoneShadow.addEventListener('change', () => {
        pushHistoryState();
        renderCanvas(false);
    });

    el.duotoneHighlight.addEventListener('input', (e) => {
        state.duotoneHighlight = e.target.value;
        e.target.parentElement.style.backgroundColor = e.target.value;
        renderCanvas(true);
    });
    el.duotoneHighlight.addEventListener('change', () => {
        pushHistoryState();
        renderCanvas(false);
    });

    // Duotone color palettes presets
    el.duotonePresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const shadow = btn.getAttribute('data-s');
            const highlight = btn.getAttribute('data-h');
            
            state.duotoneShadow = shadow;
            state.duotoneHighlight = highlight;
            
            el.duotoneShadow.value = shadow;
            el.duotoneShadow.parentElement.style.backgroundColor = shadow;
            el.duotoneHighlight.value = highlight;
            el.duotoneHighlight.parentElement.style.backgroundColor = highlight;
            
            pushHistoryState();
            renderCanvas(false);
        });
    });

    // ----------------------------------------------------
    // Presets Manager
    // ----------------------------------------------------
    el.presetCards.forEach(card => {
        card.addEventListener('click', () => {
            el.presetCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const presetId = card.getAttribute('data-preset');
            loadPresetState(presetId);
        });
    });

    function loadPresetState(presetId) {
        if (!originalImage) return;
        
        const preset = PRISM_PRESETS[presetId] || PRISM_PRESETS.original;
        state = JSON.parse(JSON.stringify(preset));
        
        syncSlidersToState();
        pushHistoryState();
        renderCanvas(false);
    }

    function syncSlidersToState() {
        const updateSliderVal = (id, val) => {
            const slider = el[id];
            if (slider) slider.value = val;
            const valLabel = document.getElementById(`val-${id}`);
            if (valLabel) valLabel.textContent = val > 0 ? `+${val}` : val;
        };
        
        updateSliderVal('exposure', state.exposure);
        updateSliderVal('contrast', state.contrast);
        updateSliderVal('clarity', state.clarity);
        updateSliderVal('saturation', state.saturation);
        updateSliderVal('temperature', state.temperature);
        updateSliderVal('tint', state.tint);
        updateSliderVal('vignette', state.vignette);
        updateSliderVal('blur', state.blur);
        updateSliderVal('sharpen', state.sharpen);
        
        // Active HSL
        const hslData = state.hsl[currentHslColor];
        updateSliderVal('hslH', hslData.h);
        updateSliderVal('hslS', hslData.s);
        updateSliderVal('hslL', hslData.l);
        
        // Creative Panel
        updateSliderVal('glitch', state.glitch);
        updateSliderVal('chromatic', state.chromatic);
        updateSliderVal('halftone', state.halftone);
        
        el.asciiToggle.checked = state.asciiToggle;
        document.querySelector('.ascii-control').style.opacity = state.asciiToggle ? '1' : '0.4';
        document.querySelector('.ascii-control').style.pointerEvents = state.asciiToggle ? 'auto' : 'none';
        updateSliderVal('asciiSize', state.asciiSize);
        document.getElementById('val-ascii-size').textContent = `${state.asciiSize}px`;
        
        el.duotoneToggle.checked = state.duotoneToggle;
        document.querySelector('.duotone-controls').style.opacity = state.duotoneToggle ? '1' : '0.4';
        document.querySelector('.duotone-controls').style.pointerEvents = state.duotoneToggle ? 'auto' : 'none';
        
        el.duotoneShadow.value = state.duotoneShadow;
        el.duotoneShadow.parentElement.style.backgroundColor = state.duotoneShadow;
        el.duotoneHighlight.value = state.duotoneHighlight;
        el.duotoneHighlight.parentElement.style.backgroundColor = state.duotoneHighlight;
    }

    // ----------------------------------------------------
    // History Actions (Undo / Redo / Reset)
    // ----------------------------------------------------
    el.undo.addEventListener('click', undoAction);
    el.redo.addEventListener('click', redoAction);
    el.reset.addEventListener('click', resetAllAdjustments);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undoAction();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redoAction();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            resetPanZoom();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '=') {
            e.preventDefault();
            adjustZoom(1.2);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            adjustZoom(0.8);
        }
    });

    function pushHistoryState() {
        undoStack.push(JSON.stringify(state));
        if (undoStack.length > maxStackSize) {
            undoStack.shift();
        }
        redoStack = [];
        updateHistoryButtons();
    }

    function undoAction() {
        if (undoStack.length === 0) return;
        
        redoStack.push(JSON.stringify(state));
        state = JSON.parse(undoStack.pop());
        
        syncSlidersToState();
        updateHistoryButtons();
        renderCanvas(false);
    }

    function redoAction() {
        if (redoStack.length === 0) return;
        
        undoStack.push(JSON.stringify(state));
        state = JSON.parse(redoStack.pop());
        
        syncSlidersToState();
        updateHistoryButtons();
        renderCanvas(false);
    }

    function updateHistoryButtons() {
        el.undo.disabled = undoStack.length === 0;
        el.redo.disabled = redoStack.length === 0;
    }

    function resetAllAdjustments() {
        if (!originalImage) return;
        
        if (confirm("Reset all slider values and effects to original state?")) {
            loadPresetState('original');
            el.presetCards.forEach(c => c.classList.remove('active'));
            document.querySelector('[data-preset="original"]').classList.add('active');
        }
    }

    // ----------------------------------------------------
    // Dynamic Applied Adjustment Log (Right Panel Pipeline)
    // ----------------------------------------------------
    function renderPipelineLog() {
        el.pipelineList.innerHTML = '';
        const items = [];
        
        const addLog = (name, val) => {
            items.push(`<div class="pipeline-item"><span class="pipeline-item-name">${name}</span><span class="pipeline-item-val">${val}</span></div>`);
        };
        
        if (state.exposure !== 0) addLog('Exposure', state.exposure > 0 ? `+${state.exposure}%` : `${state.exposure}%`);
        if (state.contrast !== 0) addLog('Contrast', state.contrast > 0 ? `+${state.contrast}%` : `${state.contrast}%`);
        if (state.clarity !== 0) addLog('Clarity Boost', `+${state.clarity}%`);
        if (state.saturation !== 0) addLog('Saturation', state.saturation > 0 ? `+${state.saturation}%` : `${state.saturation}%`);
        if (state.temperature !== 0) addLog('Color Temp', state.temperature > 0 ? `+${state.temperature}` : `${state.temperature}`);
        if (state.tint !== 0) addLog('Color Tint', state.tint > 0 ? `+${state.tint}` : `${state.tint}`);
        if (state.vignette !== 0) addLog('Vignetting', `+${state.vignette}%`);
        if (state.blur !== 0) addLog('Lens Blur', `+${state.blur}%`);
        if (state.sharpen !== 0) addLog('Sharpening', `+${state.sharpen}%`);
        
        for (const band in state.hsl) {
            const { h, s, l } = state.hsl[band];
            if (h !== 0 || s !== 0 || l !== 0) {
                let tags = [];
                if (h !== 0) tags.push(`H: ${h > 0 ? '+' : ''}${h}`);
                if (s !== 0) tags.push(`S: ${s > 0 ? '+' : ''}${s}`);
                if (l !== 0) tags.push(`L: ${l > 0 ? '+' : ''}${l}`);
                addLog(`HSL: ${band.toUpperCase()}`, tags.join(' | '));
            }
        }
        
        if (state.glitch !== 0) addLog('Matrix Glitch', `${state.glitch}%`);
        if (state.chromatic !== 0) addLog('RGB Aberration', `${state.chromatic}%`);
        if (state.halftone !== 0) addLog('Halftone Grid', `${state.halftone}%`);
        if (state.duotoneToggle) addLog('Duotone Map', `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${state.duotoneShadow}"></span> to <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${state.duotoneHighlight}"></span>`);
        if (state.asciiToggle) addLog('ASCII Matrix', `Grid ${state.asciiSize}px`);
        
        if (items.length === 0) {
            el.pipelineList.innerHTML = '<div class="pipeline-empty">No active adjustments</div>';
        } else {
            el.pipelineList.innerHTML = items.join('');
        }
    }

    // ----------------------------------------------------
    // User Authentication Integration
    // ----------------------------------------------------
    el.btnSignupTrigger.addEventListener('click', () => openAuthModal('signup'));
    el.btnLoginTrigger.addEventListener('click', () => openAuthModal('login'));
    el.btnCloseAuth.addEventListener('click', closeAuthModal);
    el.btnLogout.addEventListener('click', executeLogout);
    
    el.linkSwitchAuth.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(authMode === 'login' ? 'signup' : 'login');
    });

    el.btnSubmitAuth.addEventListener('click', submitAuthForm);

    // Close Auth modal on background click
    el.authModal.addEventListener('click', (e) => {
        if (e.target === el.authModal) closeAuthModal();
    });

    function updateAuthUI() {
        if (authToken) {
            el.authUnauthenticated.style.display = 'none';
            el.authAuthenticated.style.display = 'flex';
            el.userDisplayName.textContent = loggedInUser;
            
            // Enable save if originalImage loaded
            if (originalImage) {
                el.btnCloudSave.removeAttribute('disabled');
            } else {
                el.btnCloudSave.setAttribute('disabled', 'true');
            }
        } else {
            el.authUnauthenticated.style.display = 'flex';
            el.authAuthenticated.style.display = 'none';
            el.btnCloudSave.setAttribute('disabled', 'true');
        }
    }

    function openAuthModal(mode) {
        authMode = mode;
        el.authUsername.value = '';
        el.authPassword.value = '';
        el.authErrorMsg.style.display = 'none';
        
        if (authMode === 'login') {
            el.authModalTitle.textContent = 'Log In';
            el.authSwitchPrompt.innerHTML = `Don't have an account? <a href="#" id="link-switch-auth">Sign up</a>`;
        } else {
            el.authModalTitle.textContent = 'Sign Up';
            el.authSwitchPrompt.innerHTML = `Already have an account? <a href="#" id="link-switch-auth">Log in</a>`;
        }

        // Re-wire dynamic switch element after rendering HTML
        document.getElementById('link-switch-auth').addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal(authMode === 'login' ? 'signup' : 'login');
        });

        el.authModal.classList.add('active');
    }

    function closeAuthModal() {
        el.authModal.classList.remove('active');
    }

    function submitAuthForm() {
        const username = el.authUsername.value.trim();
        const password = el.authPassword.value;
        
        if (!username || !password) {
            showAuthError('Please fill in all inputs.');
            return;
        }

        const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
        
        // Set loading button
        const originalBtnText = el.btnSubmitAuth.textContent;
        el.btnSubmitAuth.disabled = true;
        el.btnSubmitAuth.textContent = 'Processing...';

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            el.btnSubmitAuth.disabled = false;
            el.btnSubmitAuth.textContent = originalBtnText;

            if (data.success) {
                if (authMode === 'login') {
                    // Save JWT credentials locally
                    authToken = data.token;
                    loggedInUser = data.username;
                    localStorage.setItem('prism_token', data.token);
                    localStorage.setItem('prism_user', data.username);
                    
                    updateAuthUI();
                    closeAuthModal();
                } else {
                    // Signed up, redirect to login view
                    alert('Registration successful! Please log in with your credentials.');
                    openAuthModal('login');
                }
            } else {
                showAuthError(data.error || 'Authentication failed.');
            }
        })
        .catch(err => {
            el.btnSubmitAuth.disabled = false;
            el.btnSubmitAuth.textContent = originalBtnText;
            showAuthError('Network communication failure. Make sure server is running.');
            console.error('Auth error:', err);
        });
    }

    function showAuthError(msg) {
        el.authErrorMsg.textContent = msg;
        el.authErrorMsg.style.display = 'block';
    }

    function executeLogout() {
        authToken = null;
        loggedInUser = null;
        currentProjectId = null;
        localStorage.removeItem('prism_token');
        localStorage.removeItem('prism_user');
        
        updateAuthUI();
        alert('You have logged out.');
    }

    // ----------------------------------------------------
    // SQLite Cloud Saves API
    // ----------------------------------------------------
    el.btnCloudSave.addEventListener('click', executeCloudSave);

    function executeCloudSave() {
        if (!originalImage || !authToken) return;

        const defaultProjName = currentProjectId ? fileName : (fileName || 'Untitled Project');
        const projName = prompt('Enter a name to save this project state to SQLite:', defaultProjName);
        
        if (projName === null) return; // Cancelled
        const trimmedName = projName.trim() || 'Untitled Project';

        // 1. Set save button state
        const originalBtnContent = el.btnCloudSave.innerHTML;
        el.btnCloudSave.disabled = true;
        el.btnCloudSave.innerHTML = `<svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg> Saving...`;

        // 2. Build display thumb
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 320;
        thumbCanvas.height = 200;
        const thumbCtx = thumbCanvas.getContext('2d');
        const aspect = el.displayCanvas.width / el.displayCanvas.height;
        let tw = 320;
        let th = 200;
        if (aspect > 320 / 200) {
            th = 320 / aspect;
        } else {
            tw = 200 * aspect;
        }
        // Draw centered thumbnail
        thumbCtx.fillStyle = '#0f1624';
        thumbCtx.fillRect(0, 0, 320, 200);
        thumbCtx.drawImage(el.displayCanvas, 160 - tw/2, 100 - th/2, tw, th);
        const thumbnailBase64 = thumbCanvas.toDataURL('image/jpeg', 0.85);

        // 3. Compile payloads
        const payload = {
            id: currentProjectId || undefined,
            name: trimmedName,
            image_data: el.originalCanvas.toDataURL('image/jpeg', 0.90), // Store high quality compressed source
            state: JSON.stringify(state),
            thumbnail: thumbnailBase64
        };

        // 4. Send save request
        fetch('/api/projects/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            el.btnCloudSave.disabled = false;
            el.btnCloudSave.innerHTML = originalBtnContent;

            if (data.success) {
                currentProjectId = data.projectId;
                fileName = trimmedName;
                el.statusFilename.textContent = fileName;
                alert(data.message || 'Project saved successfully!');
            } else {
                alert('Cloud save error: ' + (data.error || 'Unknown server error'));
            }
        })
        .catch(err => {
            el.btnCloudSave.disabled = false;
            el.btnCloudSave.innerHTML = originalBtnContent;
            alert('Failed to save. Ensure server connection is active.');
            console.error('Save error:', err);
        });
    }

    // ----------------------------------------------------
    // Project Gallery Dashboard Manager
    // ----------------------------------------------------
    el.btnMyGallery.addEventListener('click', openGalleryModal);
    el.btnCloseGallery.addEventListener('click', closeGalleryModal);

    // Close gallery modal on background click
    el.galleryModal.addEventListener('click', (e) => {
        if (e.target === el.galleryModal) closeGalleryModal();
    });

    function openGalleryModal() {
        if (!authToken) return;
        
        // Fetch projects list
        el.galleryGridList.innerHTML = '<div class="gallery-empty">Loading saved projects...</div>';
        el.galleryModal.classList.add('active');

        fetch('/api/projects', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderGalleryGrid(data.projects);
            } else {
                el.galleryGridList.innerHTML = `<div class="gallery-empty">Error: ${data.error || 'Could not load projects'}</div>`;
            }
        })
        .catch(err => {
            el.galleryGridList.innerHTML = '<div class="gallery-empty">Error connecting to server.</div>';
            console.error('Gallery load error:', err);
        });
    }

    function closeGalleryModal() {
        el.galleryModal.classList.remove('active');
    }

    function renderGalleryGrid(projects) {
        el.galleryGridList.innerHTML = '';
        
        if (projects.length === 0) {
            el.galleryGridList.innerHTML = '<div class="gallery-empty">No projects saved yet. Edit an image and click Cloud Save!</div>';
            return;
        }

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.setAttribute('data-id', project.id);
            
            const dateStr = new Date(project.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            card.innerHTML = `
                <div class="gallery-card-thumb" style="background-image: url('${project.thumbnail}')"></div>
                <div class="gallery-card-info">
                    <span class="gallery-card-name" title="${project.name}">${project.name}</span>
                    <span class="gallery-card-date">${dateStr}</span>
                </div>
                <div class="gallery-card-actions">
                    <button class="gallery-card-delete-btn" title="Delete project" data-id="${project.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;

            // Load project click handler (skips delete clicks)
            card.addEventListener('click', (e) => {
                if (e.target.closest('.gallery-card-delete-btn')) return;
                loadSavedProject(project.id);
            });

            // Delete project click handler
            card.querySelector('.gallery-card-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSavedProject(project.id, card);
            });

            el.galleryGridList.appendChild(card);
        });
    }

    function loadSavedProject(id) {
        closeGalleryModal();
        
        // Show loading state
        el.statusFilename.textContent = 'Loading project from server...';
        
        fetch(`/api/projects/${id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.project) {
                const proj = data.project;
                
                const img = new Image();
                img.onload = () => {
                    fileName = proj.name;
                    currentProjectId = proj.id;
                    
                    // Set inputs state
                    state = JSON.parse(proj.state);
                    
                    // Draw image to canvas and render
                    initializeWorkspaceImage(img);
                };
                img.src = proj.image_data;
            } else {
                alert('Load error: ' + (data.error || 'Project not found'));
                el.statusFilename.textContent = fileName || 'No image loaded';
            }
        })
        .catch(err => {
            alert('Failed to load project from server.');
            el.statusFilename.textContent = fileName || 'No image loaded';
            console.error('Project loading failure:', err);
        });
    }

    function deleteSavedProject(id, cardElement) {
        if (!confirm('Are you sure you want to permanently delete this project from your cloud gallery?')) return;

        fetch(`/api/projects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Animate and remove element
                cardElement.style.transform = 'scale(0.8)';
                cardElement.style.opacity = '0';
                setTimeout(() => {
                    cardElement.remove();
                    // If no cards left, show empty state
                    if (el.galleryGridList.children.length === 0) {
                        el.galleryGridList.innerHTML = '<div class="gallery-empty">No projects saved yet. Edit an image and click Cloud Save!</div>';
                    }
                }, 200);
                
                // If currently loaded project was deleted, disconnect link
                if (currentProjectId === id) {
                    currentProjectId = null;
                }
            } else {
                alert('Deletion failed: ' + (data.error || 'Server rejected request'));
            }
        })
        .catch(err => {
            alert('Delete connection failure.');
            console.error('Delete error:', err);
        });
    }

    // ----------------------------------------------------
    // Export Manager (Modal Dialog and File Downloads)
    // ----------------------------------------------------
    el.exportTrigger.addEventListener('click', openExportModal);
    el.closeExport.addEventListener('click', closeExportModal);
    el.cancelExport.addEventListener('click', closeExportModal);
    el.confirmExport.addEventListener('click', executeImageExport);
    
    el.exportFormat.addEventListener('change', updateExportMetaUI);
    el.exportQuality.addEventListener('input', (e) => {
        el.valExportQuality.textContent = `${e.target.value}%`;
        updateExportMetaUI();
    });
    el.exportScale.addEventListener('change', updateExportMetaUI);
    
    // Close modal on click outside box
    el.exportModal.addEventListener('click', (e) => {
        if (e.target === el.exportModal) closeExportModal();
    });

    function openExportModal() {
        if (!originalImage) return;
        
        const w = originalImage.naturalWidth;
        const h = originalImage.naturalHeight;
        
        el.lblScale1x.textContent = `${w} x ${h} px`;
        el.lblScale2x.textContent = `${w * 2} x ${h * 2} px (Ultra HD)`;
        el.lblScale05x.textContent = `${Math.round(w * 0.5)} x ${Math.round(h * 0.5)} px`;
        
        updateExportMetaUI();
        el.exportModal.classList.add('active');
    }

    function closeExportModal() {
        el.exportModal.classList.remove('active');
    }

    function updateExportMetaUI() {
        if (!originalImage) return;
        
        const scale = parseFloat(el.exportScale.value);
        const format = el.exportFormat.value;
        const quality = el.exportQuality.value;
        
        if (format === 'image/png') {
            el.exportQualityWrapper.style.display = 'none';
        } else {
            el.exportQualityWrapper.style.display = 'flex';
        }
        
        const ext = format === 'image/jpeg' ? '.jpg' : (format === 'image/webp' ? '.webp' : '.png');
        const rootName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        const newFileName = `${rootName}_edited${ext}`;
        
        el.exportInfoFilename.textContent = newFileName;
        
        const finalW = Math.round(originalImage.naturalWidth * scale);
        const finalH = Math.round(originalImage.naturalHeight * scale);
        const formatLabel = format === 'image/jpeg' ? 'JPEG' : (format === 'image/webp' ? 'WebP' : 'PNG');
        const qualityLabel = format !== 'image/png' ? ` • ${quality}% Quality` : ' • Lossless';
        
        el.exportInfoDetails.textContent = `${formatLabel}${qualityLabel} • Scale: ${scale}x (${finalW} x ${finalH} px)`;
    }

    /**
     * Final high-resolution filter compilation and download trigger
     */
    function executeImageExport() {
        if (!originalImage) return;
        
        const scale = parseFloat(el.exportScale.value);
        const format = el.exportFormat.value;
        const quality = parseInt(el.exportQuality.value) / 100;
        
        const finalW = Math.round(originalImage.naturalWidth * scale);
        const finalH = Math.round(originalImage.naturalHeight * scale);
        
        const originalBtnContent = el.confirmExport.innerHTML;
        el.confirmExport.disabled = true;
        el.confirmExport.innerHTML = `<svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg> Processing...`;
        
        setTimeout(() => {
            try {
                const exportSource = document.createElement('canvas');
                exportSource.width = finalW;
                exportSource.height = finalH;
                const srcCtx = exportSource.getContext('2d');
                srcCtx.drawImage(el.originalCanvas, 0, 0, finalW, finalH);
                
                const exportDest = document.createElement('canvas');
                exportDest.width = finalW;
                exportDest.height = finalH;
                
                applyPrismFilters(exportSource, exportDest, state);
                
                exportDest.toBlob((blob) => {
                    if (blob) {
                        const link = document.createElement('a');
                        link.download = el.exportInfoFilename.textContent;
                        link.href = URL.createObjectURL(blob);
                        
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        URL.revokeObjectURL(link.href);
                    }
                    
                    el.confirmExport.disabled = false;
                    el.confirmExport.innerHTML = originalBtnContent;
                    closeExportModal();
                    
                }, format, format !== 'image/png' ? quality : undefined);
                
            } catch(e) {
                console.error("Export compilation error:", e);
                alert("An error occurred compiling the export file: " + e.message);
                el.confirmExport.disabled = false;
                el.confirmExport.innerHTML = originalBtnContent;
            }
        }, 80);
    }
});
