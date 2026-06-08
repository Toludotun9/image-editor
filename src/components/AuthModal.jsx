import React, { useState, useEffect } from 'react';
import { localAuth } from '../utils/db';

export default function AuthModal({ isOpen, mode, onClose, onAuthSuccess }) {
    const [authMode, setAuthMode] = useState(mode); // 'login' or 'signup'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // Sync state when mode prop changes
    useEffect(() => {
        setAuthMode(mode);
        setUsername('');
        setPassword('');
        setErrorMsg('');
    }, [mode, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmedUser = username.trim();
        if (!trimmedUser || !password) {
            setErrorMsg('Please enter both username and password.');
            return;
        }

        const authPromise = authMode === 'login' 
            ? localAuth.login(trimmedUser, password) 
            : localAuth.signup(trimmedUser, password);

        authPromise
        .then(data => {
            setLoading(false);
            if (data.success) {
                if (authMode === 'login') {
                    onAuthSuccess(data.token, data.username);
                    onClose();
                } else {
                    alert('Registration successful! Please log in with your credentials.');
                    setAuthMode('login');
                    setPassword('');
                    setErrorMsg('');
                }
            } else {
                setErrorMsg(data.error || 'Authentication failed.');
            }
        })
        .catch(err => {
            setLoading(false);
            setErrorMsg('Local authentication failed.');
            console.error('Auth error:', err);
        });
    };

    return (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && onClose()}>
            <div className="modal-box auth-box">
                <div class="modal-header">
                    <h2>{authMode === 'login' ? 'Log In' : 'Sign Up'}</h2>
                    <button class="modal-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                
                <form class="modal-body" onSubmit={handleSubmit}>
                    <div class="input-row">
                        <label htmlFor="auth-username">Username</label>
                        <input 
                            type="text" 
                            id="auth-username" 
                            required 
                            placeholder="Enter username" 
                            className="prism-input" 
                            minLength={3}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    
                    <div class="input-row">
                        <label htmlFor="auth-password">Password</label>
                        <input 
                            type="password" 
                            id="auth-password" 
                            required 
                            placeholder="Enter password" 
                            className="prism-input" 
                            minLength={5}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    
                    {errorMsg && <div className="auth-error-container">{errorMsg}</div>}
                    <button type="submit" style={{ display: 'none' }} />
                </form>
                
                <div class="modal-footer">
                    <span class="auth-switch-prompt">
                        {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <a 
                            href="#" 
                            onClick={(e) => {
                                e.preventDefault();
                                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                setErrorMsg('');
                            }}
                        >
                            {authMode === 'login' ? 'Sign up' : 'Log in'}
                        </a>
                    </span>
                    <button className="text-button primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Processing...' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
}
