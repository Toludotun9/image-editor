import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Utilities
import { DOTUN_DEFAULT_STATE, DOTUN_PRESETS } from './utils/presets';
import { applyDotunFilters } from './utils/filters';
import { localProjects } from './utils/db';

// Components
import Histogram from './components/Histogram';
import CanvasWorkspace from './components/CanvasWorkspace';
import AuthModal from './components/AuthModal';
import GalleryModal from './components/GalleryModal';
import ExportModal from './components/ExportModal';

export default function App() {
    // ----------------------------------------------------
    // State Declarations
    // ----------------------------------------------------
    const [state, setState] = useState(JSON.parse(JSON.stringify(DOTUN_DEFAULT_STATE)));
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    
    const [originalImage, setOriginalImage] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileType, setFileType] = useState('image/jpeg');

    const [activeTab, setActiveTab] = useState('tab-adjust'); // tab-adjust, tab-hsl, tab-creative
    const [currentHslColor, setCurrentHslColor] = useState('red');
    const [isCompareMode, setIsCompareMode] = useState(false);

    // Authentication States
    const [authToken, setAuthToken] = useState(localStorage.getItem('dotun_token') || null);
    const [loggedInUser, setLoggedInUser] = useState(localStorage.getItem('dotun_user') || null);
    const [currentProjectId, setCurrentProjectId] = useState(null);

    // Modals visibility
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // login or signup
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    // Dynamic Histogram State
    const [histogramSource, setHistogramSource] = useState(null);

    // Canvas Refs
    const originalCanvasRef = useRef(null);
    const displayCanvasRef = useRef(null);

    // ----------------------------------------------------
    // Global Paste & Keyboard Hookups
    // ----------------------------------------------------
    useEffect(() => {
        const handlePaste = (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf("image") === 0) {
                    const blob = item.getAsFile();
                    setFileName("clipboard-image.png");
                    setFileType("image/png");
                    loadFile(blob);
                    break;
                }
            }
        };

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('paste', handlePaste);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [undoStack, redoStack, state, originalImage]);

    // ----------------------------------------------------
    // Canvas Render Engine
    // ----------------------------------------------------
    const triggerRender = (lowRes = false) => {
        if (!originalImage || !originalCanvasRef.current || !displayCanvasRef.current) return;
        
        const srcW = originalImage.naturalWidth;
        const srcH = originalImage.naturalHeight;
        
        let targetW = srcW;
        let targetH = srcH;
        
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

        const tempSource = document.createElement('canvas');
        tempSource.width = targetW;
        tempSource.height = targetH;
        const tempCtx = tempSource.getContext('2d');
        tempCtx.drawImage(originalCanvasRef.current, 0, 0, targetW, targetH);

        const displayCanvas = displayCanvasRef.current;
        if (displayCanvas.width !== targetW || displayCanvas.height !== targetH) {
            displayCanvas.width = targetW;
            displayCanvas.height = targetH;
        }

        applyDotunFilters(tempSource, displayCanvas, state);

        // Notify histogram component that source canvas is ready
        setHistogramSource(displayCanvas);
    };

    // Re-render when filters state modifies
    useEffect(() => {
        if (originalImage) {
            triggerRender(false);
        }
    }, [state, originalImage]);

    // ----------------------------------------------------
    // File Load Routines
    // ----------------------------------------------------
    const loadFile = (file) => {
        if (!file.type.match('image.*')) {
            alert('Please select a valid image file.');
            return;
        }
        
        setFileName(file.name);
        setFileType(file.type);
        setCurrentProjectId(null);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setOriginalImage(img);
                
                // Set canvas bounds immediately so reference functions don't complain
                setTimeout(() => {
                    if (originalCanvasRef.current) {
                        originalCanvasRef.current.width = img.naturalWidth;
                        originalCanvasRef.current.height = img.naturalHeight;
                        const origCtx = originalCanvasRef.current.getContext('2d');
                        origCtx.drawImage(img, 0, 0);
                        
                        setUndoStack([]);
                        setRedoStack([]);
                        setState(JSON.parse(JSON.stringify(DOTUN_DEFAULT_STATE)));
                    }
                }, 50);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ----------------------------------------------------
    // Load Stock Generative Landscape
    // ----------------------------------------------------
    const loadSampleImage = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0, '#0d0d26');
        skyGrad.addColorStop(0.3, '#1f133d');
        skyGrad.addColorStop(0.6, '#6b204f');
        skyGrad.addColorStop(0.8, '#d95a53');
        skyGrad.addColorStop(1, '#ffaf7b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Stars
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 60; i++) {
            const sx = Math.random() * canvas.width;
            const sy = Math.random() * (canvas.height * 0.5);
            const size = Math.random() * 2 + 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sun
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

        // Mountains
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

        // Water Reflection
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

        // Pine trees
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
            ctx.fillRect(tx - tSize * 0.08, ty + tSize * 3.5, tSize * 0.16, tSize * 0.6);
        };
        drawTree(120, canvas.height * 0.6, 65);
        drawTree(60, canvas.height * 0.65, 80);
        drawTree(180, canvas.height * 0.68, 50);

        setFileName("Dotun-Sunset-Sample.png");
        setFileType("image/png");
        setCurrentProjectId(null);

        const sampleImg = new Image();
        sampleImg.onload = () => {
            setOriginalImage(sampleImg);
            setTimeout(() => {
                if (originalCanvasRef.current) {
                    originalCanvasRef.current.width = sampleImg.naturalWidth;
                    originalCanvasRef.current.height = sampleImg.naturalHeight;
                    const origCtx = originalCanvasRef.current.getContext('2d');
                    origCtx.drawImage(sampleImg, 0, 0);
                    
                    setUndoStack([]);
                    setRedoStack([]);
                    setState(JSON.parse(JSON.stringify(DOTUN_DEFAULT_STATE)));
                }
            }, 50);
        };
        sampleImg.src = canvas.toDataURL('image/png');
    };

    // ----------------------------------------------------
    // Sliders Inputs State Modifiers
    // ----------------------------------------------------
    const handleSliderInput = (key, value, isHsl = false) => {
        // Change state immediately for live downscaled rendering
        setState(prev => {
            const next = { ...prev };
            if (isHsl) {
                next.hsl = { ...next.hsl };
                next.hsl[currentHslColor] = { ...next.hsl[currentHslColor] };
                next.hsl[currentHslColor][key] = value;
            } else {
                next[key] = value;
            }
            return next;
        });
        triggerRender(true); // render fast preview
    };

    const handleSliderChange = () => {
        // Save slider state to history undo stack on release
        pushHistoryState();
        triggerRender(false); // render final full-res quality
    };

    const pushHistoryState = () => {
        setUndoStack(prev => {
            const next = [...prev, JSON.stringify(state)];
            if (next.length > maxStackSize) next.shift();
            return next;
        });
        setRedoStack([]);
    };

    // ----------------------------------------------------
    // History Actions (Undo / Redo / Reset)
    // ----------------------------------------------------
    const handleUndo = () => {
        if (undoStack.length === 0) return;
        const previousState = JSON.parse(undoStack[undoStack.length - 1]);
        
        setRedoStack(prev => [...prev, JSON.stringify(state)]);
        setState(previousState);
        setUndoStack(prev => prev.slice(0, prev.length - 1));
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const nextState = JSON.parse(redoStack[redoStack.length - 1]);
        
        setUndoStack(prev => [...prev, JSON.stringify(state)]);
        setState(nextState);
        setRedoStack(prev => prev.slice(0, prev.length - 1));
    };

    const handleResetAll = () => {
        if (!originalImage) return;
        if (confirm("Reset all slider values and effects to original state?")) {
            pushHistoryState();
            setState(JSON.parse(JSON.stringify(DOTUN_DEFAULT_STATE)));
        }
    };

    // ----------------------------------------------------
    // Presets Manager
    // ----------------------------------------------------
    const handlePresetSelect = (presetId) => {
        if (!originalImage) return;
        const preset = DOTUN_PRESETS[presetId] || DOTUN_PRESETS.original;
        pushHistoryState();
        setState(JSON.parse(JSON.stringify(preset)));
    };

    // ----------------------------------------------------
    // Cloud Saving SQL Requests
    // ----------------------------------------------------
    const handleCloudSave = () => {
        if (!originalImage || !authToken) return;

        const defaultName = currentProjectId ? fileName : (fileName || 'Untitled Project');
        const projName = prompt('Enter a name to save this project state to SQLite:', defaultName);
        if (projName === null) return;
        
        const trimmedName = projName.trim() || 'Untitled Project';

        // Build thumbnail canvas
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 320;
        thumbCanvas.height = 200;
        const thumbCtx = thumbCanvas.getContext('2d');
        const aspect = displayCanvasRef.current.width / displayCanvasRef.current.height;
        let tw = 320;
        let th = 200;
        if (aspect > 320 / 200) {
            th = 320 / aspect;
        } else {
            tw = 200 * aspect;
        }
        thumbCtx.fillStyle = '#0f1624';
        thumbCtx.fillRect(0, 0, 320, 200);
        thumbCtx.drawImage(displayCanvasRef.current, 160 - tw/2, 100 - th/2, tw, th);
        const thumbnailBase64 = thumbCanvas.toDataURL('image/jpeg', 0.85);

        const payload = {
            id: currentProjectId || undefined,
            name: trimmedName,
            image_data: originalCanvasRef.current.toDataURL('image/jpeg', 0.90),
            state: JSON.stringify(state),
            thumbnail: thumbnailBase64
        };

        localProjects.save(authToken, payload)
        .then(data => {
            if (data.success) {
                setCurrentProjectId(data.projectId);
                setFileName(trimmedName);
                alert(data.message || 'Project saved successfully!');
            } else {
                alert('Cloud save failure: ' + (data.error || 'Server error'));
            }
        })
        .catch(err => {
            alert('Failed to connect to cloud storage.');
            console.error('Save error:', err);
        });
    };

    const handleLoadSavedProject = (projectId) => {
        localProjects.getOne(authToken, projectId)
        .then(data => {
            if (data.success && data.project) {
                const proj = data.project;
                const img = new Image();
                img.onload = () => {
                    setFileName(proj.name);
                    setCurrentProjectId(proj.id);
                    setOriginalImage(img);
                    
                    // Set canvas bounds
                    setTimeout(() => {
                        if (originalCanvasRef.current) {
                            originalCanvasRef.current.width = img.naturalWidth;
                            originalCanvasRef.current.height = img.naturalHeight;
                            const origCtx = originalCanvasRef.current.getContext('2d');
                            origCtx.drawImage(img, 0, 0);
                            
                            setUndoStack([]);
                            setRedoStack([]);
                            setState(JSON.parse(proj.state));
                        }
                    }, 50);
                };
                img.src = proj.image_data;
            } else {
                alert('Error loading project: ' + (data.error || 'Not found'));
            }
        })
        .catch(err => {
            alert('Database fetch error.');
            console.error(err);
        });
    };

    const handleAuthSuccess = (token, username) => {
        setAuthToken(token);
        setLoggedInUser(username);
        localStorage.setItem('dotun_token', token);
        localStorage.setItem('dotun_user', username);
    };

    const handleLogout = () => {
        setAuthToken(null);
        setLoggedInUser(null);
        setCurrentProjectId(null);
        localStorage.removeItem('dotun_token');
        localStorage.removeItem('dotun_user');
        alert('You have logged out.');
    };

    // ----------------------------------------------------
    // Dynamic Pipeline Generator Log
    // ----------------------------------------------------
    const getPipelineItems = () => {
        const items = [];
        const addLog = (name, val) => items.push({ name, val });
        
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
                if (h !== 0) tags.push(`H:${h > 0 ? '+' : ''}${h}`);
                if (s !== 0) tags.push(`S:${s > 0 ? '+' : ''}${s}`);
                if (l !== 0) tags.push(`L:${l > 0 ? '+' : ''}${l}`);
                addLog(`HSL: ${band.toUpperCase()}`, tags.join(' | '));
            }
        }
        
        if (state.glitch !== 0) addLog('Matrix Glitch', `${state.glitch}%`);
        if (state.chromatic !== 0) addLog('RGB Aberration', `${state.chromatic}%`);
        if (state.halftone !== 0) addLog('Halftone Grid', `${state.halftone}%`);
        if (state.duotoneToggle) addLog('Duotone Map', `${state.duotoneShadow.substring(0, 5)} to ${state.duotoneHighlight.substring(0, 5)}`);
        if (state.asciiToggle) addLog('ASCII Matrix', `${state.asciiSize}px`);
        
        return items;
    };

    const pipelineItems = getPipelineItems();

    return (
        <div className="prism-app">
            {/* 1. Header Toolbar */}
            <header className="prism-header">
                <div className="header-logo">
                    <svg className="logo-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5">
                        <circle cx="50" cy="50" r="40" stroke="url(#logo-grad)" strokeWidth="7"/>
                        <line x1="50" y1="10" x2="78" y2="35" strokeLinecap="round"/>
                        <line x1="90" y1="50" x2="65" y2="78" strokeLinecap="round"/>
                        <line x1="50" y1="90" x2="22" y2="65" strokeLinecap="round"/>
                        <line x1="10" y1="50" x2="35" y2="22" strokeLinecap="round"/>
                        <circle cx="50" cy="50" r="10" fill="url(#dot-grad)"/>
                        <defs>
                            <linearGradient id="logo-grad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#00f2fe"/>
                                <stop offset="50%" stopColor="#9d4edd"/>
                                <stop offset="100%" stopColor="#00ffd5"/>
                            </linearGradient>
                            <radialGradient id="dot-grad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#ffffff"/>
                                <stop offset="65%" stopColor="#00f2fe"/>
                                <stop offset="100%" stopColor="rgba(0,242,254,0)"/>
                            </radialGradient>
                        </defs>
                    </svg>
                    <span className="logo-text">DOTUN</span>
                    <span className="logo-version">v1.0</span>
                </div>

                <div className="header-actions">
                    <div className="action-group">
                        <button className="icon-button" title="Undo (Ctrl+Z)" onClick={handleUndo} disabled={undoStack.length === 0}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
                        </button>
                        <button className="icon-button" title="Redo (Ctrl+Y)" onClick={handleRedo} disabled={redoStack.length === 0}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
                        </button>
                    </div>

                    <button 
                        className={`icon-button toggle-button ${isCompareMode ? 'active' : ''}`} 
                        title="Toggle Split View Compare"
                        onClick={() => originalImage && setIsCompareMode(!isCompareMode)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>
                        </svg>
                    </button>

                    <button className="text-button warning" title="Reset all changes" onClick={handleResetAll} disabled={!originalImage}>
                        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg>
                        Reset
                    </button>

                    <button className="text-button primary" onClick={() => document.getElementById('image-loader').click()}>
                        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        Open Image
                        <input type="file" id="image-loader" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files.length > 0 && loadFile(e.target.files[0])}/>
                    </button>
                    <button className="text-button secondary" onClick={loadSampleImage}>
                        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                        Sample Image
                    </button>

                    <button className="text-button accent" disabled={!originalImage} onClick={() => setIsExportOpen(true)}>
                        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 17l4 4 4-4M12 12v9M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></svg>
                        Export
                    </button>

                    {/* Authentication Section */}
                    {!authToken ? (
                        <div className="auth-section">
                            <button className="auth-btn signup" onClick={() => { setAuthMode('signup'); setIsAuthOpen(true); }}>Sign up</button>
                            <button className="auth-btn login" onClick={() => { setAuthMode('login'); setIsAuthOpen(true); }}>Log in</button>
                        </div>
                    ) : (
                        <div className="auth-section">
                            <span className="user-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="user-icon"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                <span id="user-display-name">{loggedInUser}</span>
                            </span>
                            <button className="text-button secondary" title="Save project to SQLite database" disabled={!originalImage} onClick={handleCloudSave}>
                                <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 01-2 2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                Cloud Save
                            </button>
                            <button className="text-button secondary" title="Open saved projects gallery" onClick={() => setIsGalleryOpen(true)}>
                                <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
                                Gallery
                            </button>
                            <button className="icon-button" title="Log out" onClick={handleLogout}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 01-2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* 2. Workspace Body Grid */}
            <main className="prism-main">
                {/* Sidebar Left Adjustments Panel */}
                <aside className="prism-sidebar sidebar-left">
                    <div className="sidebar-tabs">
                        <button className={`tab-btn ${activeTab === 'tab-adjust' ? 'active' : ''}`} onClick={() => setActiveTab('tab-adjust')}>Adjust</button>
                        <button className={`tab-btn ${activeTab === 'tab-hsl' ? 'active' : ''}`} onClick={() => setActiveTab('tab-hsl')}>HSL Color</button>
                        <button className={`tab-btn ${activeTab === 'tab-creative' ? 'active' : ''}`} onClick={() => setActiveTab('tab-creative')}>Creative</button>
                    </div>

                    {/* Adjust Tab Contents */}
                    {activeTab === 'tab-adjust' && (
                        <div className="tab-content active">
                            <div className="control-group">
                                <h3>Light & Detail</h3>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Exposure</span><span className="slider-value">{state.exposure > 0 ? `+${state.exposure}` : state.exposure}</span></div>
                                    <input type="range" min="-100" max="100" className="prism-slider" value={state.exposure} onChange={(e) => handleSliderInput('exposure', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Contrast</span><span className="slider-value">{state.contrast > 0 ? `+${state.contrast}` : state.contrast}</span></div>
                                    <input type="range" min="-100" max="100" className="prism-slider" value={state.contrast} onChange={(e) => handleSliderInput('contrast', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Clarity</span><span className="slider-value">+{state.clarity}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.clarity} onChange={(e) => handleSliderInput('clarity', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                            </div>

                            <div className="control-group">
                                <h3>Color Tone</h3>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Saturation</span><span className="slider-value">{state.saturation > 0 ? `+${state.saturation}` : state.saturation}</span></div>
                                    <input type="range" min="-100" max="100" className="prism-slider" value={state.saturation} onChange={(e) => handleSliderInput('saturation', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Temperature</span><span className="slider-value">{state.temperature > 0 ? `+${state.temperature}` : state.temperature}</span></div>
                                    <input type="range" min="-100" max="100" className="prism-slider color-temp" value={state.temperature} onChange={(e) => handleSliderInput('temperature', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Tint</span><span className="slider-value">{state.tint > 0 ? `+${state.tint}` : state.tint}</span></div>
                                    <input type="range" min="-100" max="100" className="prism-slider color-tint" value={state.tint} onChange={(e) => handleSliderInput('tint', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                            </div>

                            <div className="control-group">
                                <h3>Effects & Framing</h3>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Vignette</span><span className="slider-value">+{state.vignette}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.vignette} onChange={(e) => handleSliderInput('vignette', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Blur</span><span className="slider-value">+{state.blur}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.blur} onChange={(e) => handleSliderInput('blur', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Sharpen</span><span className="slider-value">+{state.sharpen}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.sharpen} onChange={(e) => handleSliderInput('sharpen', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HSL Tab Contents */}
                    {activeTab === 'tab-hsl' && (
                        <div className="tab-content active">
                            <div className="control-group">
                                <h3>HSL Color Tuner</h3>
                                <p className="section-desc">Adjust Hue, Saturation, and Lightness for isolated color bands.</p>
                                
                                <div className="color-band-selector">
                                    {['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'].map(color => {
                                        const hex = color === 'red' ? '#ef4444' : color === 'orange' ? '#f97316' : color === 'yellow' ? '#eab308' : color === 'green' ? '#22c55e' : color === 'cyan' ? '#06b6d4' : color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : '#ec4899';
                                        return (
                                            <button 
                                                key={color}
                                                className={`band-btn ${currentHslColor === color ? 'active' : ''}`} 
                                                style={{ '--band-color': hex }}
                                                title={color}
                                                onClick={() => setCurrentHslColor(color)}
                                            />
                                        );
                                    })}
                                </div>

                                <div className="hsl-sliders-container">
                                    <h4 className="band-title">{currentHslColor} Channel Controls</h4>
                                    <div className="slider-wrapper">
                                        <div className="slider-label"><span>Hue Shift</span><span className="slider-value">{state.hsl[currentHslColor].h > 0 ? `+${state.hsl[currentHslColor].h}` : state.hsl[currentHslColor].h}</span></div>
                                        <input type="range" min="-180" max="180" className="prism-slider hsl-h-track" value={state.hsl[currentHslColor].h} onChange={(e) => handleSliderInput('h', parseFloat(e.target.value), true)} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                    </div>
                                    <div className="slider-wrapper">
                                        <div className="slider-label"><span>Saturation</span><span className="slider-value">{state.hsl[currentHslColor].s > 0 ? `+${state.hsl[currentHslColor].s}` : state.hsl[currentHslColor].s}</span></div>
                                        <input type="range" min="-100" max="100" className="prism-slider" value={state.hsl[currentHslColor].s} onChange={(e) => handleSliderInput('s', parseFloat(e.target.value), true)} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                    </div>
                                    <div className="slider-wrapper">
                                        <div className="slider-label"><span>Lightness</span><span className="slider-value">{state.hsl[currentHslColor].l > 0 ? `+${state.hsl[currentHslColor].l}` : state.hsl[currentHslColor].l}</span></div>
                                        <input type="range" min="-100" max="100" className="prism-slider" value={state.hsl[currentHslColor].l} onChange={(e) => handleSliderInput('l', parseFloat(e.target.value), true)} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Creative Tab Contents */}
                    {activeTab === 'tab-creative' && (
                        <div className="tab-content active">
                            <div className="control-group">
                                <h3>Glitch & Cyber</h3>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Glitch Strength</span><span className="slider-value">+{state.glitch}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.glitch} onChange={(e) => handleSliderInput('glitch', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Chromatic Aberration</span><span className="slider-value">+{state.chromatic}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.chromatic} onChange={(e) => handleSliderInput('chromatic', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                            </div>

                            <div className="control-group">
                                <h3>Creative Rendering</h3>
                                <div className="slider-wrapper">
                                    <div className="slider-label"><span>Halftone Dots</span><span className="slider-value">+{state.halftone}</span></div>
                                    <input type="range" min="0" max="100" className="prism-slider" value={state.halftone} onChange={(e) => handleSliderInput('halftone', parseFloat(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                                
                                <div className="toggle-wrapper">
                                    <div className="toggle-info">
                                        <span className="toggle-title">ASCII Matrix Effect</span>
                                        <span className="toggle-desc">Convert image to colored text character grid</span>
                                    </div>
                                    <label className="switch">
                                        <input type="checkbox" checked={state.asciiToggle} onChange={(e) => {
                                            setState(prev => ({ ...prev, asciiToggle: e.target.checked }));
                                            pushHistoryState();
                                        }}/>
                                        <span className="switch-slider"/>
                                    </label>
                                </div>

                                <div className="slider-wrapper ascii-control" style={{ opacity: state.asciiToggle ? 1 : 0.4, pointerEvents: state.asciiToggle ? 'auto' : 'none' }}>
                                    <div className="slider-label"><span>ASCII Font Size</span><span className="slider-value">{state.asciiSize}px</span></div>
                                    <input type="range" min="6" max="24" className="prism-slider" value={state.asciiSize} onChange={(e) => handleSliderInput('asciiSize', parseInt(e.target.value))} onMouseUp={handleSliderChange} onTouchEnd={handleSliderChange}/>
                                </div>
                            </div>

                            <div className="control-group">
                                <h3>Duotone Gradient</h3>
                                <div className="toggle-wrapper">
                                    <div className="toggle-info">
                                        <span className="toggle-title">Duotone Filter</span>
                                        <span className="toggle-desc">Remap tones between two custom colors</span>
                                    </div>
                                    <label className="switch">
                                        <input type="checkbox" checked={state.duotoneToggle} onChange={(e) => {
                                            setState(prev => ({ ...prev, duotoneToggle: e.target.checked }));
                                            pushHistoryState();
                                        }}/>
                                        <span className="switch-slider"/>
                                    </label>
                                </div>

                                <div className="duotone-controls" style={{ opacity: state.duotoneToggle ? 1 : 0.4, pointerEvents: state.duotoneToggle ? 'auto' : 'none', marginTop: '15px' }}>
                                    <div className="color-pickers-row">
                                        <div className="color-picker-item">
                                            <label htmlFor="duotone-shadow">Shadows</label>
                                            <div className="color-picker-preview" style={{ backgroundColor: state.duotoneShadow }}>
                                                <input type="color" id="duotone-shadow" value={state.duotoneShadow} onChange={(e) => { handleSliderInput('duotoneShadow', e.target.value); }} onBlur={handleSliderChange} />
                                            </div>
                                        </div>
                                        <div className="color-picker-item">
                                            <label htmlFor="duotone-highlight">Highlights</label>
                                            <div className="color-picker-preview" style={{ backgroundColor: state.duotoneHighlight }}>
                                                <input type="color" id="duotone-highlight" value={state.duotoneHighlight} onChange={(e) => { handleSliderInput('duotoneHighlight', e.target.value); }} onBlur={handleSliderChange} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="duotone-presets">
                                        <span className="presets-title">Presets:</span>
                                        <div className="presets-row">
                                            {[
                                                { s: '#1e0b36', h: '#ff9d00', t: 'Cyberpunk Tangerine' },
                                                { s: '#021b18', h: '#00ffcc', t: 'Toxic Cyan' },
                                                { s: '#2b003a', h: '#ff007c', t: 'Synthwave Fuchsia' },
                                                { s: '#0f2027', h: '#2c5364', t: 'Deep Oceanic' },
                                                { s: '#3f0f0f', h: '#f5af19', t: 'Fire Glow' }
                                            ].map(pres => (
                                                <button 
                                                    key={pres.t}
                                                    className="duotone-preset-btn" 
                                                    style={{ background: `linear-gradient(135deg, ${pres.s}, ${pres.h})` }}
                                                    title={pres.t}
                                                    onClick={() => {
                                                        setState(prev => ({ ...prev, duotoneShadow: pres.s, duotoneHighlight: pres.h }));
                                                        pushHistoryState();
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </aside>

                {/* Main Viewport Workspace Canvas */}
                <CanvasWorkspace 
                    originalImage={originalImage}
                    originalCanvasRef={originalCanvasRef}
                    displayCanvasRef={displayCanvasRef}
                    isCompareMode={isCompareMode}
                    onDropFile={loadFile}
                    onLoadSample={loadSampleImage}
                />

                {/* Sidebar Right panel (Histogram, Presets and Logs) */}
                <aside className="prism-sidebar sidebar-right">
                    <div className="sidebar-section panel-histogram">
                        <div className="section-header">
                            <h3>Real-time Histogram</h3>
                            <div className="histogram-legend">
                                <span className="legend-dot r">R</span>
                                <span className="legend-dot g">G</span>
                                <span className="legend-dot b">B</span>
                                <span className="legend-dot w">L</span>
                            </div>
                        </div>
                        <Histogram sourceCanvas={histogramSource} />
                    </div>

                    <div className="sidebar-section panel-presets">
                        <h3>Presets</h3>
                        <div className="presets-grid">
                            {[
                                { id: 'original', class: 'raw-preview', label: 'Original' },
                                { id: 'cyberpunk', class: 'cyberpunk-preview', label: 'Cyberpunk' },
                                { id: 'warm-autumn', class: 'warm-autumn-preview', label: 'Warm Autumn' },
                                { id: 'nordic-cold', class: 'nordic-cold-preview', label: 'Nordic Cold' },
                                { id: 'emerald-dream', class: 'emerald-preview', label: 'Emerald Dream' },
                                { id: 'mono-silhouette', class: 'mono-preview', label: 'Mono Dark' },
                                { id: 'vintage-vhs', class: 'vhs-preview', label: 'Retro VHS' }
                            ].map(card => (
                                <button 
                                    key={card.id}
                                    className={`preset-card ${state.contrast === DOTUN_PRESETS[card.id]?.contrast && state.saturation === DOTUN_PRESETS[card.id]?.saturation && state.temperature === DOTUN_PRESETS[card.id]?.temperature ? 'active' : ''}`}
                                    onClick={() => handlePresetSelect(card.id)}
                                >
                                    <div className={`preset-preview ${card.class}`} />
                                    <span className="preset-name">{card.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="sidebar-section panel-history flex-grow">
                        <h3>Applied Pipelines</h3>
                        <div className="applied-list">
                            {pipelineItems.length === 0 ? (
                                <div className="pipeline-empty">No active adjustments</div>
                            ) : (
                                pipelineItems.map((item, idx) => (
                                    <div key={idx} className="pipeline-item">
                                        <span className="pipeline-item-name">{item.name}</span>
                                        <span className="pipeline-item-val" dangerouslySetInnerHTML={{ __html: item.val }} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </aside>
            </main>

            {/* 3. Footer statusbar */}
            <footer className="prism-statusbar">
                <div className="status-left">
                    <span>{fileName || 'No image loaded'}</span>
                    <span className="status-divider">|</span>
                    <span>{originalImage ? `${originalImage.naturalWidth} x ${originalImage.naturalHeight} px` : '0 x 0 px'}</span>
                </div>
                <div className="status-right">
                    <span>Drag mouse to Pan canvas • Scroll to Zoom</span>
                </div>
            </footer>

            {/* 4. Modals overlays */}
            <AuthModal 
                isOpen={isAuthOpen}
                mode={authMode}
                onClose={() => setIsAuthOpen(false)}
                onAuthSuccess={handleAuthSuccess}
            />

            <GalleryModal 
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                authToken={authToken}
                onLoadProject={handleLoadSavedProject}
            />

            <ExportModal 
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                originalCanvas={originalCanvasRef.current}
                fileName={fileName}
                state={state}
            />
        </div>
    );
}
