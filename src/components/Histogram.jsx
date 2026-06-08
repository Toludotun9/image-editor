import React, { useEffect, useRef } from 'react';

export default function Histogram({ sourceCanvas }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !sourceCanvas) return;

        const ctx = canvas.getContext('2d');
        const srcCtx = sourceCanvas.getContext('2d');
        if (!srcCtx || !ctx) return;

        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        if (w === 0 || h === 0) return;

        // Sync drawing resolution with CSS bounding client dimensions
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const width = canvas.width;
        const height = canvas.height;

        let imgData;
        try {
            imgData = srcCtx.getImageData(0, 0, w, h);
        } catch (e) {
            return;
        }

        const data = imgData.data;
        const len = data.length;

        const rHist = new Uint32Array(256);
        const gHist = new Uint32Array(256);
        const bHist = new Uint32Array(256);
        const lHist = new Uint32Array(256);

        // Downsample pixels to keep execution under 1-2ms on any image size
        const targetSamples = 30000;
        const totalPixels = w * h;
        const step = Math.max(1, Math.floor(totalPixels / targetSamples)) * 4;

        for (let i = 0; i < len; i += step) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

            rHist[r]++;
            gHist[g]++;
            bHist[b]++;
            lHist[l]++;
        }

        let maxPeak = 0;
        for (let i = 2; i < 254; i++) {
            if (rHist[i] > maxPeak) maxPeak = rHist[i];
            if (gHist[i] > maxPeak) maxPeak = gHist[i];
            if (bHist[i] > maxPeak) maxPeak = bHist[i];
            if (lHist[i] > maxPeak) maxPeak = lHist[i];
        }

        if (maxPeak === 0) maxPeak = 1;

        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'screen';

        const renderCurve = (hist, strokeColor, fillColor) => {
            ctx.beginPath();
            ctx.moveTo(0, height);

            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * width;
                const valueRatio = hist[i] / maxPeak;
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

        renderCurve(rHist, '#ef4444', 'rgba(239, 68, 68, 0.18)');
        renderCurve(gHist, '#10b981', 'rgba(16, 185, 129, 0.18)');
        renderCurve(bHist, '#2563eb', 'rgba(37, 99, 235, 0.18)');
        renderCurve(lHist, '#f1f5f9', 'rgba(241, 245, 249, 0.12)');

        ctx.globalCompositeOperation = 'source-over';
    }, [sourceCanvas]);

    return (
        <div className="histogram-container">
            <canvas ref={canvasRef} id="histogram-canvas" />
        </div>
    );
}
