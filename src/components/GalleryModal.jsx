import React, { useState, useEffect } from 'react';
import { localProjects } from '../utils/db';

export default function GalleryModal({ isOpen, onClose, authToken, onLoadProject }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen && authToken) {
            fetchProjects();
        }
    }, [isOpen, authToken]);

    const fetchProjects = () => {
        setLoading(true);
        setErrorMsg('');
        localProjects.getAll(authToken)
        .then(data => {
            setLoading(false);
            if (data.success) {
                setProjects(data.projects);
            } else {
                setErrorMsg(data.error || 'Failed to retrieve saved projects.');
            }
        })
        .catch(err => {
            setLoading(false);
            setErrorMsg('Local projects fetch failed.');
            console.error('Gallery error:', err);
        });
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to permanently delete this project?')) return;

        localProjects.delete(authToken, id)
        .then(data => {
            if (data.success) {
                setProjects(projects.filter(p => p.id !== id));
            } else {
                alert('Deletion failed: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            alert('Delete operation error.');
            console.error('Delete error:', err);
        });
    };

    const handleLoad = (id) => {
        onClose();
        // Notify parent to load project
        onLoadProject(id);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && onClose()}>
            <div className="modal-box gallery-box">
                <div className="modal-header">
                    <h2>My Saved Projects</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                
                <div className="modal-body gallery-container">
                    {loading && <div className="gallery-empty">Loading saved projects...</div>}
                    {!loading && errorMsg && <div className="gallery-empty">{errorMsg}</div>}
                    
                    {!loading && !errorMsg && (
                        <div className="gallery-grid">
                            {projects.length === 0 ? (
                                <div className="gallery-empty">No projects saved yet. Make edits and click Cloud Save!</div>
                            ) : (
                                projects.map(project => {
                                    const dateStr = new Date(project.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    });
                                    return (
                                        <div key={project.id} className="gallery-card" onClick={() => handleLoad(project.id)}>
                                            <div className="gallery-card-thumb" style={{ backgroundImage: `url('${project.thumbnail}')` }}></div>
                                            <div className="gallery-card-info">
                                                <span className="gallery-card-name" title={project.name}>{project.name}</span>
                                                <span className="gallery-card-date">{dateStr}</span>
                                            </div>
                                            <div className="gallery-card-actions">
                                                <button className="gallery-card-delete-btn" title="Delete project" onClick={(e) => handleDelete(e, project.id)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <polyline points="3 6 5 6 21 6"/>
                                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
