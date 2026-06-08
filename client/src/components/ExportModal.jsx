import React, { useState, useEffect } from 'react';
import { applyDotunFilters } from '../utils/filters';

export default function ExportModal({ isOpen, onClose, originalCanvas, fileName, state }) {
    const [format, setFormat] = useState('image/jpeg');
    const [quality, setQuality] = useState(90);
    const [scale, setScale] = useState(1);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        setFormat('image/jpeg');
        setQuality(90);
        setScale(1);
        setExporting(false);
    }, [isOpen]);

    if (!isOpen || !originalCanvas) return null;

    const originalW = originalCanvas.width;
    const originalH = originalCanvas.height;

    const finalW = Math.round(originalW * scale);
    const finalH = Math.round(originalH * scale);

    const formatLabel = format === 'image/jpeg' ? 'JPEG' : (format === 'image/webp' ? 'WebP' : 'PNG');
    const qualityLabel = format !== 'image/png' ? ` • ${quality}% Quality` : ' • Lossless';
    
    const rootName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const ext = format === 'image/jpeg' ? '.jpg' : (format === 'image/webp' ? '.webp' : '.png');
    const exportFileName = `${rootName}_edited${ext}`;

    const handleDownload = () => {
        setExporting(true);

        // Defer execution slightly to let UI spinner render
        setTimeout(() => {
            try {
                // 1. Create high-resolution export canvases
                const exportSource = document.createElement('canvas');
                exportSource.width = finalW;
                exportSource.height = finalH;
                const srcCtx = exportSource.getContext('2d');
                srcCtx.drawImage(originalCanvas, 0, 0, finalW, finalH);

                const exportDest = document.createElement('canvas');
                exportDest.width = finalW;
                exportDest.height = finalH;

                // 2. Compile filters at full scale
                applyDotunFilters(exportSource, exportDest, state);

                // 3. Convert to binary Blob and download
                exportDest.toBlob((blob) => {
                    if (blob) {
                        const link = document.createElement('a');
                        link.download = exportFileName;
                        link.href = URL.createObjectURL(blob);
                        
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        URL.revokeObjectURL(link.href);
                    }
                    setExporting(false);
                    onClose();
                }, format, format !== 'image/png' ? quality / 100 : undefined);

            } catch (e) {
                console.error("Export failure:", e);
                alert("An error occurred during canvas compilation: " + e.message);
                setExporting(false);
            }
        }, 100);
    };

    return (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2>Export Settings</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                
                <div className="modal-body">
                    <div className="control-group">
                        <div className="input-row">
                            <label htmlFor="export-format">File Format</label>
                            <select 
                                id="export-format" 
                                className="prism-select"
                                value={format}
                                onChange={(e) => setFormat(e.target.value)}
                            >
                                <option value="image/png">PNG (.png) — Lossless</option>
                                <option value="image/jpeg">JPEG (.jpg) — Balanced</option>
                                <option value="image/webp">WebP (.webp) — Next-gen compression</option>
                            </select>
                        </div>

                        {format !== 'image/png' && (
                            <div className="slider-wrapper" id="jpeg-quality-wrapper">
                                <div className="slider-label">
                                    <span>Compression Quality</span>
                                    <span className="slider-value">{quality}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    id="export-quality" 
                                    min="10" 
                                    max="100" 
                                    className="prism-slider"
                                    value={quality}
                                    onChange={(e) => setQuality(parseInt(e.target.value))}
                                />
                            </div>
                        )}

                        <div className="input-row">
                            <label htmlFor="export-scale">Output Resolution</label>
                            <select 
                                id="export-scale" 
                                className="prism-select"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                            >
                                <option value="1">1.0x (Standard Preview — {originalW} x {originalH} px)</option>
                                <option value="2">2.0x (High-Res Upscale — {originalW * 2} x {originalH * 2} px)</option>
                                <option value="0.5">0.5x (Downsampled — {Math.round(originalW * 0.5)} x {Math.round(originalH * 0.5)} px)</option>
                            </select>
                        </div>
                    </div>

                    <div className="export-preview-card">
                        <div className="preview-info">
                            <span id="export-info-filename">{exportFileName}</span>
                            <span id="export-info-details">{formatLabel}{qualityLabel} • Scale: {scale}x ({finalW} x {finalH} px)</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="text-button secondary" onClick={onClose} disabled={exporting}>Cancel</button>
                    <button className="text-button accent" onClick={handleDownload} disabled={exporting}>
                        {exporting ? (
                            <>
                                <svg className="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                Download File
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
