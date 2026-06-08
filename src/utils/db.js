// Local database and authentication emulator using localStorage

// Extract username from mock token e.g. "mock-jwt-token-username"
function getUsernameFromToken(token) {
    if (!token || !token.startsWith('mock-jwt-token-')) return null;
    return token.replace('mock-jwt-token-', '');
}

export const localAuth = {
    signup: async (username, password) => {
        // Mock delay to simulate network latency
        await new Promise(r => setTimeout(r, 400));
        const users = JSON.parse(localStorage.getItem('dotun_users') || '[]');
        const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existing) {
            return { success: false, error: 'Username is already taken.' };
        }
        users.push({ username, password });
        localStorage.setItem('dotun_users', JSON.stringify(users));
        return { success: true, message: 'User created successfully!' };
    },

    login: async (username, password) => {
        // Mock delay
        await new Promise(r => setTimeout(r, 400));
        const users = JSON.parse(localStorage.getItem('dotun_users') || '[]');
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (!user) {
            return { success: false, error: 'Invalid username or password.' };
        }
        const token = `mock-jwt-token-${user.username}`;
        return { success: true, token, username: user.username };
    }
};

export const localProjects = {
    getAll: async (token) => {
        await new Promise(r => setTimeout(r, 300));
        const username = getUsernameFromToken(token);
        if (!username) return { success: false, error: 'Access token missing or invalid.' };

        const allProjects = JSON.parse(localStorage.getItem('dotun_projects') || '[]');
        // Filter by user and omit heavy fields (image_data, state) for quick list queries
        const filtered = allProjects
            .filter(p => p.username === username)
            .map(({ id, name, thumbnail, created_at }) => ({ id, name, thumbnail, created_at }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return { success: true, projects: filtered };
    },

    getOne: async (token, projectId) => {
        await new Promise(r => setTimeout(r, 300));
        const username = getUsernameFromToken(token);
        if (!username) return { success: false, error: 'Access token missing or invalid.' };

        const allProjects = JSON.parse(localStorage.getItem('dotun_projects') || '[]');
        const project = allProjects.find(p => p.id === projectId && p.username === username);
        if (!project) return { success: false, error: 'Project not found.' };

        return { success: true, project: { id: project.id, name: project.name, image_data: project.image_data, state: project.state } };
    },

    save: async (token, payload) => {
        await new Promise(r => setTimeout(r, 450));
        const username = getUsernameFromToken(token);
        if (!username) return { success: false, error: 'Access token missing or invalid.' };

        const { id, name, image_data, state, thumbnail } = payload;
        const allProjects = JSON.parse(localStorage.getItem('dotun_projects') || '[]');

        if (id) {
            // Update
            const index = allProjects.findIndex(p => p.id === id && p.username === username);
            if (index === -1) return { success: false, error: 'Project not found or unauthorized.' };
            allProjects[index] = {
                ...allProjects[index],
                name,
                image_data,
                state,
                thumbnail,
                updated_at: new Date().toISOString()
            };
            localStorage.setItem('dotun_projects', JSON.stringify(allProjects));
            return { success: true, projectId: id, message: 'Project updated successfully!' };
        } else {
            // Create
            const newId = Date.now();
            allProjects.push({
                id: newId,
                username,
                name,
                image_data,
                state,
                thumbnail,
                created_at: new Date().toISOString()
            });
            localStorage.setItem('dotun_projects', JSON.stringify(allProjects));
            return { success: true, projectId: newId, message: 'Project saved successfully!' };
        }
    },

    delete: async (token, projectId) => {
        await new Promise(r => setTimeout(r, 200));
        const username = getUsernameFromToken(token);
        if (!username) return { success: false, error: 'Access token missing or invalid.' };

        const allProjects = JSON.parse(localStorage.getItem('dotun_projects') || '[]');
        const initialLen = allProjects.length;
        const filtered = allProjects.filter(p => !(p.id === projectId && p.username === username));
        
        if (filtered.length === initialLen) {
            return { success: false, error: 'Project not found or unauthorized.' };
        }

        localStorage.setItem('dotun_projects', JSON.stringify(filtered));
        return { success: true, message: 'Project deleted successfully!' };
    }
};
