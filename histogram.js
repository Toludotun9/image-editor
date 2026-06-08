/* Prism RGB & Luminance Histogram Generator */

class PrismHistogram {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resize();
            // Listen for resize to ensure canvas drawing buffers match CSS dimensions
            window.addEventListener('resize', () => this.resize());
        }
    }
    
    /**
     * Update internal resolution to match container dimensions.
     */
    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
    }
    
    /**
     * Scans source canvas, accumulates channel distributions, and draws curve overlays.
     * @param {HTMLCanvasElement} sourceCanvas - Canvas to sample data from.
     */
    update(sourceCanvas) {
        if (!this.canvas || !sourceCanvas) return;
        
        const srcCtx = sourceCanvas.getContext('2d');
        if (!srcCtx) return;
        
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        if (w === 0 || h === 0) return;
        
        let imgData;
        try {
            imgData = srcCtx.getImageData(0, 0, w, h);
        } catch (e) {
            console.warn("Histogram reading aborted (likely cross-origin/empty canvas):", e);
            return;
        }
        
        const data = imgData.data;
        const len = data.length;
        
        // 256 indices for Red, Green, Blue, and Luminance
        const rHist = new Uint32Array(256);
        const gHist = new Uint32Array(256);
        const bHist = new Uint32Array(256);
        const lHist = new Uint32Array(256);
        
        // Downsample pixels to keep execution under 1-2ms on any image size.
        // target ~30,000 pixel readings, which is statistically solid
        const targetSamples = 30000;
        const totalPixels = w * h;
        const step = Math.max(1, Math.floor(totalPixels / targetSamples)) * 4; // *4 for RGBA spacing
        
        for (let i = 0; i < len; i += step) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Rec 709 weights for perceived luminance
            const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            
            rHist[r]++;
            gHist[g]++;
            bHist[b]++;
            lHist[l]++;
        }
        
        // Find max peak to scale the Y-axis.
        // We skip first and last bins (black/white clippings) to prevent graph scaling compression.
        let maxPeak = 0;
        for (let i = 2; i < 254; i++) {
            if (rHist[i] > maxPeak) maxPeak = rHist[i];
            if (gHist[i] > maxPeak) maxPeak = gHist[i];
            if (bHist[i] > maxPeak) maxPeak = bPeak = bHist[i];
            if (lHist[i] > maxPeak) maxPeak = lHist[i];
        }
        
        if (maxPeak === 0) maxPeak = 1;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const dpr = window.devicePixelRatio || 1;
        
        ctx.clearRect(0, 0, width, height);
        
        // Use screen blending mode to allow color curves to overlap beautifully
        ctx.globalCompositeOperation = 'screen';
        
        // Helper to render curves
        const renderCurve = (hist, strokeColor, fillColor) => {
            ctx.beginPath();
            ctx.moveTo(0, height);
            
            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * width;
                const valueRatio = hist[i] / maxPeak;
                // Clamp max height to leave 6px padding at the top
                const y = height - (Math.min(1.1, valueRatio) * (height - 8 * dpr));
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(width, height);
            ctx.closePath();
            
            ctx.fillStyle = fillColor;
            ctx.fill();
            
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.2 * dpr;
            ctx.stroke();
        };
        
        // Render layers
        renderCurve(rHist, '#ef4444', 'rgba(239, 68, 68, 0.18)');
        renderCurve(gHist, '#10b981', 'rgba(16, 185, 129, 0.18)');
        renderCurve(bHist, '#2563eb', 'rgba(37, 99, 235, 0.18)');
        renderCurve(lHist, '#f1f5f9', 'rgba(241, 245, 249, 0.12)');
        
        // Restore canvas settings
        ctx.globalCompositeOperation = 'source-over';
    }
}
