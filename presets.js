/* Prism Preset Configurations */

const PRISM_DEFAULT_STATE = {
    exposure: 0,
    contrast: 0,
    clarity: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    vignette: 0,
    blur: 0,
    sharpen: 0,
    
    // HSL adjustment values for colors: red, orange, yellow, green, cyan, blue, purple, magenta
    hsl: {
        red: { h: 0, s: 0, l: 0 },
        orange: { h: 0, s: 0, l: 0 },
        yellow: { h: 0, s: 0, l: 0 },
        green: { h: 0, s: 0, l: 0 },
        cyan: { h: 0, s: 0, l: 0 },
        blue: { h: 0, s: 0, l: 0 },
        purple: { h: 0, s: 0, l: 0 },
        magenta: { h: 0, s: 0, l: 0 }
    },
    
    // Creative panel
    glitch: 0,
    chromatic: 0,
    halftone: 0,
    asciiToggle: false,
    asciiSize: 8,
    
    duotoneToggle: false,
    duotoneShadow: '#1e0b36',
    duotoneHighlight: '#ff9d00'
};

const PRISM_PRESETS = {
    original: {
        ...PRISM_DEFAULT_STATE
    },
    
    cyberpunk: {
        ...PRISM_DEFAULT_STATE,
        contrast: 15,
        clarity: 25,
        saturation: 40,
        temperature: -20,
        tint: 30,
        chromatic: 35,
        glitch: 12,
        duotoneToggle: true,
        duotoneShadow: '#1a0033',
        duotoneHighlight: '#00f2fe',
        hsl: {
            ...PRISM_DEFAULT_STATE.hsl,
            blue: { h: 10, s: 30, l: 10 },
            purple: { h: -10, s: 40, l: 15 }
        }
    },
    
    'warm-autumn': {
        ...PRISM_DEFAULT_STATE,
        exposure: 5,
        contrast: 12,
        clarity: 15,
        saturation: 20,
        temperature: 45,
        tint: 5,
        vignette: 20,
        hsl: {
            ...PRISM_DEFAULT_STATE.hsl,
            red: { h: 5, s: 25, l: 5 },
            orange: { h: -5, s: 35, l: 10 },
            yellow: { h: -10, s: 20, l: 5 },
            blue: { h: 0, s: -30, l: -10 }
        }
    },
    
    'nordic-cold': {
        ...PRISM_DEFAULT_STATE,
        exposure: 8,
        contrast: 8,
        clarity: 18,
        saturation: -35,
        temperature: -50,
        tint: -5,
        vignette: 15,
        hsl: {
            ...PRISM_DEFAULT_STATE.hsl,
            blue: { h: -5, s: 35, l: 10 },
            cyan: { h: 5, s: 20, l: 5 },
            red: { h: 0, s: -20, l: -5 }
        }
    },
    
    'emerald-dream': {
        ...PRISM_DEFAULT_STATE,
        contrast: 10,
        clarity: 15,
        saturation: 15,
        temperature: -10,
        tint: -35,
        vignette: 25,
        duotoneToggle: true,
        duotoneShadow: '#022118',
        duotoneHighlight: '#34d399',
        hsl: {
            ...PRISM_DEFAULT_STATE.hsl,
            green: { h: 10, s: 30, l: 5 }
        }
    },
    
    'mono-silhouette': {
        ...PRISM_DEFAULT_STATE,
        exposure: -5,
        contrast: 40,
        clarity: 30,
        saturation: -100,
        vignette: 35,
        hsl: {
            ...PRISM_DEFAULT_STATE.hsl
        }
    },
    
    'vintage-vhs': {
        ...PRISM_DEFAULT_STATE,
        exposure: 2,
        contrast: -15,
        clarity: 5,
        saturation: 25,
        temperature: 15,
        tint: 10,
        vignette: 15,
        blur: 8,
        chromatic: 40,
        glitch: 18
    }
};
