/* Dotun Core Image-Processing Filter Pipeline (ES6 Module) */

/**
 * Converts RGB values to HSL spectrum.
 * @returns {number[]} [Hue (0-360), Saturation (0-100), Lightness (0-100)]
 */
export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Converts HSL back to RGB.
 * @returns {number[]} [Red (0-255), Green (0-255), Blue (0-255)]
 */
export function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [
        Math.max(0, Math.min(255, Math.round(r * 255))),
        Math.max(0, Math.min(255, Math.round(g * 255))),
        Math.max(0, Math.min(255, Math.round(b * 255)))
    ];
}

/**
 * Creates a Duotone Shadow-Highlight lookup table.
 */
export function createDuotoneLUT(shadowHex, highlightHex) {
    const parseHex = (hex) => {
        const cleaned = hex.replace('#', '');
        return {
            r: parseInt(cleaned.substring(0, 2), 16) || 0,
            g: parseInt(cleaned.substring(2, 4), 16) || 0,
            b: parseInt(cleaned.substring(4, 6), 16) || 0
        };
    };
    const shadow = parseHex(shadowHex);
    const highlight = parseHex(highlightHex);
    const lut = new Uint8Array(256 * 3);
    
    for (let i = 0; i < 256; i++) {
        const ratio = i / 255;
        lut[i * 3]     = Math.max(0, Math.min(255, Math.round(shadow.r + ratio * (highlight.r - shadow.r))));
        lut[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(shadow.g + ratio * (highlight.g - shadow.g))));
        lut[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(shadow.b + ratio * (highlight.b - shadow.b))));
    }
    return lut;
}

/**
 * 3x3 Convolution filter algorithm for Image Sharpening.
 */
export function applySharpenConvolution(srcData, dstData, w, h, strength) {
    const factor = strength / 100;
    const kCenter = 1 + 4 * factor;
    const kEdge = -factor;
    
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            
            let r = 0, g = 0, b = 0;
            
            const nIdx = [
                (y - 1) * w + x,     // Top
                y * w + (x - 1),     // Left
                y * w + (x + 1),     // Right
                (y + 1) * w + x      // Bottom
            ].map(v => v * 4);
            
            r = srcData[idx] * kCenter + 
                (srcData[nIdx[0]] + srcData[nIdx[1]] + srcData[nIdx[2]] + srcData[nIdx[3]]) * kEdge;
            g = srcData[idx + 1] * kCenter + 
                (srcData[nIdx[0] + 1] + srcData[nIdx[1] + 1] + srcData[nIdx[2] + 1] + srcData[nIdx[3] + 1]) * kEdge;
            b = srcData[idx + 2] * kCenter + 
                (srcData[nIdx[0] + 2] + srcData[nIdx[1] + 2] + srcData[nIdx[2] + 2] + srcData[nIdx[3] + 2]) * kEdge;
            
            dstData[idx]     = r < 0 ? 0 : (r > 255 ? 255 : r);
            dstData[idx + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
            dstData[idx + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
            dstData[idx + 3] = srcData[idx + 3]; // Maintain opacity
        }
    }
}

/**
 * Main application filter compiler. Processes CPU and canvas operations.
 */
export function applyDotunFilters(sourceCanvas, targetCanvas, state) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    if (w === 0 || h === 0) return;
    
    if (targetCanvas.width !== w || targetCanvas.height !== h) {
        targetCanvas.width = w;
        targetCanvas.height = h;
    }
    
    const srcCtx = sourceCanvas.getContext('2d');
    const dstCtx = targetCanvas.getContext('2d');
    
    dstCtx.clearRect(0, 0, w, h);
    
    let srcImgData;
    try {
        srcImgData = srcCtx.getImageData(0, 0, w, h);
    } catch (e) {
        console.error("Filter read failure:", e);
        return;
    }
    
    const srcData = srcImgData.data;
    const dstImgData = dstCtx.createImageData(w, h);
    const dstData = dstImgData.data;
    
    const len = srcData.length;
    
    const exposureFactor = Math.pow(2, state.exposure / 50);
    const contrastFactor = (259 * (state.contrast + 255)) / (255 * (259 - state.contrast));
    const satFactor = (state.saturation + 100) / 100;
    const clarityAmount = state.clarity * 0.4;
    const tempVal = state.temperature * 0.4;
    const tintVal = state.tint * 0.4;
    const vignetteAmount = state.vignette / 100;
    const chromaticOffset = Math.round(state.chromatic * (w / 1200));
    
    const centerX = w / 2;
    const centerY = h / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY) || 1;
    
    let duotoneLUT = null;
    if (state.duotoneToggle) {
        duotoneLUT = createDuotoneLUT(state.duotoneShadow, state.duotoneHighlight);
    }
    
    let hasHsl = false;
    for (const color in state.hsl) {
        const { h, s, l } = state.hsl[color];
        if (h !== 0 || s !== 0 || l !== 0) {
            hasHsl = true;
            break;
        }
    }
    
    // Primary Pass: CPU Pixel Loops
    for (let i = 0; i < len; i += 4) {
        const idx = i;
        const x = (idx / 4) % w;
        const y = Math.floor((idx / 4) / w);
        
        let r, g, b;
        
        if (chromaticOffset > 0) {
            const rx = Math.max(0, Math.min(w - 1, x - chromaticOffset));
            const bx = Math.max(0, Math.min(w - 1, x + chromaticOffset));
            r = srcData[(y * w + rx) * 4];
            g = srcData[idx + 1];
            b = srcData[(y * w + bx) * 4 + 2];
        } else {
            r = srcData[idx];
            g = srcData[idx + 1];
            b = srcData[idx + 2];
        }
        
        if (state.duotoneToggle && duotoneLUT) {
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            r = duotoneLUT[gray * 3];
            g = duotoneLUT[gray * 3 + 1];
            b = duotoneLUT[gray * 3 + 2];
        }
        
        if (hasHsl) {
            let [hue, sat, light] = rgbToHsl(r, g, b);
            let band = null;
            
            if (hue >= 345 || hue < 15) band = 'red';
            else if (hue >= 15 && hue < 45) band = 'orange';
            else if (hue >= 45 && hue < 75) band = 'yellow';
            else if (hue >= 75 && hue < 165) band = 'green';
            else if (hue >= 165 && hue < 195) band = 'cyan';
            else if (hue >= 195 && hue < 255) band = 'blue';
            else if (hue >= 255 && hue < 315) band = 'purple';
            else if (hue >= 315 && hue < 345) band = 'magenta';
            
            if (band && state.hsl[band]) {
                const adj = state.hsl[band];
                if (adj.h !== 0) hue = (hue + adj.h + 360) % 360;
                if (adj.s !== 0) sat = Math.max(0, Math.min(100, sat + adj.s));
                if (adj.l !== 0) light = Math.max(0, Math.min(100, light + adj.l));
                [r, g, b] = hslToRgb(hue, sat, light);
            }
        }
        
        if (state.exposure !== 0) {
            r *= exposureFactor;
            g *= exposureFactor;
            b *= exposureFactor;
        }
        
        if (state.contrast !== 0) {
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;
        }
        
        if (state.clarity !== 0) {
            r += Math.sin((r / 255) * Math.PI) * clarityAmount;
            g += Math.sin((g / 255) * Math.PI) * clarityAmount;
            b += Math.sin((b / 255) * Math.PI) * clarityAmount;
        }
        
        if (state.saturation !== 0) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * satFactor;
            g = gray + (g - gray) * satFactor;
            b = gray + (b - gray) * satFactor;
        }
        
        if (state.temperature !== 0 || state.tint !== 0) {
            r += tempVal * 0.5 + tintVal * 0.2;
            g += tintVal * -0.5;
            b += tempVal * -0.5 + tintVal * 0.2;
        }
        
        if (state.vignette !== 0) {
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
            const vignetteFactor = 1 - (dist * vignetteAmount);
            r *= vignetteFactor;
            g *= vignetteFactor;
            b *= vignetteFactor;
        }
        
        dstData[idx]     = r < 0 ? 0 : (r > 255 ? 255 : r);
        dstData[idx + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        dstData[idx + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
        dstData[idx + 3] = srcData[idx + 3];
    }
    
    dstCtx.putImageData(dstImgData, 0, 0);
    
    // Secondary Pass: Spatial / Multi-Stage Convolution
    if (state.sharpen > 0) {
        const sharpenBuffer = dstCtx.getImageData(0, 0, w, h);
        applySharpenConvolution(sharpenBuffer.data, dstImgData.data, w, h, state.sharpen);
        dstCtx.putImageData(dstImgData, 0, 0);
    }
    
    if (state.blur > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(targetCanvas, 0, 0);
        
        dstCtx.clearRect(0, 0, w, h);
        dstCtx.filter = `blur(${state.blur * 0.15}px)`;
        dstCtx.drawImage(tempCanvas, 0, 0);
        dstCtx.filter = 'none';
    }
    
    if (state.glitch > 0) {
        const sliceCount = Math.floor(state.glitch / 6) + 2;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(targetCanvas, 0, 0);
        
        for (let i = 0; i < sliceCount; i++) {
            const sy = Math.random() * h;
            const sh = Math.random() * (h / 8) + 15;
            const disp = (Math.random() - 0.5) * (state.glitch * (w / 400));
            dstCtx.drawImage(tempCanvas, 0, sy, w, sh, disp, sy, w, sh);
        }
    }
    
    if (state.halftone > 0) {
        applyHalftoneEffect(dstCtx, w, h, state.halftone);
    }
    
    if (state.asciiToggle) {
        applyAsciiEffect(dstCtx, w, h, state.asciiSize);
    }
}

/**
 * Halftone matrix converter.
 */
export function applyHalftoneEffect(ctx, w, h, strength) {
    const dotSize = Math.max(4, Math.floor(strength / 4));
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(ctx.canvas, 0, 0);
    
    const imgData = tempCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, w, h);
    
    for (let y = 0; y < h; y += dotSize) {
        for (let x = 0; x < w; x += dotSize) {
            let rSum = 0, gSum = 0, bSum = 0;
            let count = 0;
            
            for (let cy = 0; cy < dotSize && y + cy < h; cy++) {
                for (let cx = 0; cx < dotSize && x + cx < w; cx++) {
                    const idx = ((y + cy) * w + (x + cx)) * 4;
                    rSum += data[idx];
                    gSum += data[idx + 1];
                    bSum += data[idx + 2];
                    count++;
                }
            }
            
            const r = rSum / count;
            const g = gSum / count;
            const b = bSum / count;
            const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            
            const radius = (dotSize / 2) * brightness * 1.3;
            if (radius > 0.4) {
                ctx.beginPath();
                ctx.arc(x + dotSize / 2, y + dotSize / 2, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
                ctx.fill();
            }
        }
    }
}

/**
 * ASCII text converter.
 */
export function applyAsciiEffect(ctx, w, h, fontSize) {
    const charWidth = fontSize;
    const charHeight = fontSize;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(ctx.canvas, 0, 0);
    
    const imgData = tempCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, w, h);
    
    ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const chars = '@#S%?*+;:,. '.split('');
    const charLen = chars.length;
    
    for (let y = 0; y < h; y += charHeight) {
        for (let x = 0; x < w; x += charWidth) {
            const cx = Math.min(w - 1, x + Math.floor(charWidth / 2));
            const cy = Math.min(h - 1, y + Math.floor(charHeight / 2));
            const idx = (cy * w + cx) * 4;
            
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const gray = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            
            const charIdx = Math.floor((1 - gray) * (charLen - 1));
            const char = chars[charIdx];
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillText(char, x + charWidth / 2, y + charHeight / 2);
        }
    }
}
