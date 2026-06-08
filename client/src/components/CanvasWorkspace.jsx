import React, { useState, useEffect, useRef } from 'react';

export default function CanvasWorkspace({ 
    originalImage, 
    originalCanvasRef, 
    displayCanvasRef, 
    isCompareMode, 
    onDropFile, 
    onLoadSample 
}) {
    const viewportRef = useRef(null);
    const wrapperRef = useRef(null);
    const splitLineRef = useRef(null);

    // Zoom & Pan Local States
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Compare Mode Local States
    const [splitPercent, setSplitPercent] = useState(50);
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);

    // Reset Zoom/Pan when image changes
    useEffect(() => {
        if (originalImage) {
            resetPanZoom();
        }
    }, [originalImage]);

    // Recalculate transforms on zoom/pan changes
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (wrapper) {
            wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
        }
    }, [zoomLevel, panX, panY]);

    const resetPanZoom = () => {
        const viewport = viewportRef.current;
        if (!viewport || !originalImage) return;

        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        const imgWidth = originalImage.naturalWidth;
        const imgHeight = originalImage.naturalHeight;

        // Find best fit zoom scale with 80px margins
        const scaleX = (viewportWidth - 80) / imgWidth;
        const scaleY = (viewportHeight - 80) / imgHeight;
        const fitZoom = Math.min(1.0, Math.min(scaleX, scaleY));

        setZoomLevel(fitZoom);
        setPanX(0);
        setPanY(0);
    };

    const handleZoom = (factor) => {
        setZoomLevel(prev => Math.max(0.1, Math.min(10, prev * factor)));
    };

    // Scroll Wheel Zoom Handler
    const handleWheel = (e) => {
        if (!originalImage) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        handleZoom(factor);
    };

    // Panning Event Listeners
    const handleMouseDown = (e) => {
        if (e.target.closest('.split-handle') || !originalImage) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
        viewportRef.current.style.cursor = 'grabbing';
    };

    // Global Mousemove tracker for pan & split drag
    useEffect(() => {
        const handleMouseMoveGlobal = (e) => {
            if (isPanning) {
                setPanX(e.clientX - panStart.x);
                setPanY(e.clientY - panStart.y);
            }
            if (isDraggingSplit && originalImage && wrapperRef.current) {
                const wrapperRect = wrapperRef.current.getBoundingClientRect();
                const relativeX = e.clientX - wrapperRect.left;
                const percent = (relativeX / wrapperRect.width) * 100;
                setSplitPercent(Math.max(0, Math.min(100, percent)));
            }
        };

        const handleMouseUpGlobal = () => {
            if (isPanning) {
                setIsPanning(false);
                if (viewportRef.current) viewportRef.current.style.cursor = 'grab';
            }
            if (isDraggingSplit) {
                setIsDraggingSplit(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMoveGlobal);
        window.addEventListener('mouseup', handleMouseUpGlobal);

        return () => {
            window.removeEventListener('mousemove', handleMouseMoveGlobal);
            window.removeEventListener('mouseup', handleMouseUpGlobal);
        };
    }, [isPanning, isDraggingSplit, panStart, originalImage]);

    // Drag-and-drop triggers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('dragover');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            onDropFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <section 
            className="prism-workspace" 
            id="workspace-container"
            onDragOver={originalImage ? undefined : handleDragOver}
            onDragLeave={originalImage ? undefined : handleDragLeave}
            onDrop={originalImage ? undefined : handleDrop}
        >
            {/* 1. Drag & Drop Landing Overlay */}
            {!originalImage && (
                <div className="upload-dropzone" id="dropzone">
                    <div className="dropzone-box">
                        <div className="dropzone-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                        </div>
                        <h2>Bring your canvas to life</h2>
                        <p>Drag & drop any image here, paste from your clipboard, or select an option above.</p>
                        <div className="dropzone-buttons">
                            <button className="text-button primary" onClick={() => document.getElementById('image-loader').click()}>Browse Files</button>
                            <button className="text-button secondary" id="btn-load-sample-center" onClick={onLoadSample}>Load Sample</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Zoomable/Pan-ready Canvas Viewport */}
            {originalImage && (
                <div 
                    ref={viewportRef} 
                    className="canvas-viewport" 
                    id="canvas-viewport"
                    style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                >
                    <div ref={wrapperRef} className="canvas-wrapper" id="canvas-wrapper">
                        {/* Hidden Original Layer */}
                        <canvas 
                            ref={originalCanvasRef} 
                            id="original-canvas" 
                            style={{ 
                                display: isCompareMode ? 'block' : 'none',
                                position: 'absolute',
                                top: 0, left: 0,
                                width: '100%', height: '100%',
                                zIndex: 1,
                                pointerEvents: 'none'
                            }}
                        />
                        
                        {/* Active Display Layer */}
                        <canvas 
                            ref={displayCanvasRef} 
                            id="display-canvas" 
                            style={{
                                position: isCompareMode ? 'relative' : 'static',
                                zIndex: isCompareMode ? 2 : 'auto',
                                clipPath: isCompareMode ? `inset(0 0 0 ${splitPercent}%)` : 'none',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Split screen comparison draggable divider */}
                        {isCompareMode && (
                            <div 
                                ref={splitLineRef}
                                className="split-slider-line" 
                                id="split-line"
                                style={{ left: `${splitPercent}%`, display: 'block' }}
                            >
                                <div 
                                    className="split-handle"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setIsDraggingSplit(true);
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M8 9l-4 3 4 3M16 9l4 3-4 3"/>
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Viewport Control Overlay toolbar */}
                    <div className="viewport-controls" onMouseDown={(e) => e.stopPropagation()}>
                        <button id="btn-zoom-out" className="icon-button" title="Zoom Out (Ctrl+Minus)" onClick={() => handleZoom(0.8)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <span id="zoom-factor" className="zoom-display">{Math.round(zoomLevel * 100)}%</span>
                        <button id="btn-zoom-in" className="icon-button" title="Zoom In (Ctrl+Plus)" onClick={() => handleZoom(1.2)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button id="btn-fit-screen" className="icon-button" title="Fit to Screen (Ctrl+0)" onClick={resetPanZoom}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 9v12M3 15V3M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
