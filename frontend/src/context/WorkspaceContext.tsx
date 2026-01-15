import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// Types
export interface Page {
    id: string;
    title: string;
    content: string;
    type: 'private' | 'team';
}

export interface VoiceChannel {
    id: string;
    name: string;
    users: string[]; // User IDs mock
}

export interface Workspace {
    id: string;
    name: string;
    privatePages: Page[];
    teamPages: Page[];
    voiceChannels: VoiceChannel[];
}

interface WorkspaceContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    currentPage: Page | null;
    currentChannel: VoiceChannel | null;
    createWorkspace: (name: string) => void;
    createPage: (workspaceId: string, title: string, type: 'private' | 'team') => void;
    createChannel: (workspaceId: string, name: string) => void;
    selectWorkspace: (workspaceId: string) => void;
    selectPage: (pageId: string) => void;
    selectChannel: (channelId: string) => void;
    updatePageContent: (pageId: string, content: string) => void;
    updatePageTitle: (pageId: string, title: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
};

// Initial Mock Data
const INITIAL_WORKSPACES: Workspace[] = [
    {
        id: '1',
        name: 'My Private Notes',
        privatePages: [
            { id: '101', title: 'Getting Started', content: 'Welcome to StackNote! This is a simple block editor.', type: 'private' },
            { id: '102', title: 'Ideas', content: 'Type something here...', type: 'private' }
        ],
        teamPages: [],
        voiceChannels: [
            { id: 'v1', name: 'General', users: [] }
        ]
    }
];

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Load from local storage or use initial
    const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
        const saved = localStorage.getItem('stacknote_workspaces_v2'); // v2 for new structure
        return saved ? JSON.parse(saved) : INITIAL_WORKSPACES;
    });

    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(workspaces[0]?.id || '');
    const [currentPageId, setCurrentPageId] = useState<string>(workspaces[0]?.privatePages[0]?.id || '');
    const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('stacknote_workspaces_v2', JSON.stringify(workspaces));
    }, [workspaces]);

    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;

    // Helper to find page across categories
    const findPage = (id: string, ws: Workspace | null) => {
        if (!ws) return null;
        return ws.privatePages.find(p => p.id === id) || ws.teamPages.find(p => p.id === id) || null;
    };

    const currentPage = findPage(currentPageId, currentWorkspace);
    const currentChannel = currentWorkspace?.voiceChannels.find(c => c.id === currentChannelId) || null;

    const createWorkspace = (name: string) => {
        const newWorkspace: Workspace = {
            id: Date.now().toString(),
            name,
            privatePages: [{ id: Date.now().toString() + '1', title: 'Untitled', content: '', type: 'private' }],
            teamPages: [],
            voiceChannels: [{ id: Date.now().toString() + 'v', name: 'General', users: [] }]
        };
        setWorkspaces([...workspaces, newWorkspace]);
        setCurrentWorkspaceId(newWorkspace.id);
        setCurrentPageId(newWorkspace.privatePages[0].id);
    };

    const createPage = (workspaceId: string, title: string, type: 'private' | 'team') => {
        setWorkspaces(prev => prev.map(w => {
            if (w.id === workspaceId) {
                const newPage: Page = { id: Date.now().toString(), title, content: '', type };
                setCurrentPageId(newPage.id);
                if (type === 'private') {
                    return { ...w, privatePages: [...w.privatePages, newPage] };
                } else {
                    return { ...w, teamPages: [...w.teamPages, newPage] };
                }
            }
            return w;
        }));
    };

    const createChannel = (workspaceId: string, name: string) => {
        setWorkspaces(prev => prev.map(w => {
            if (w.id === workspaceId) {
                const newChannel: VoiceChannel = { id: Date.now().toString(), name, users: [] };
                return { ...w, voiceChannels: [...w.voiceChannels, newChannel] };
            }
            return w;
        }));
    };

    const selectWorkspace = (workspaceId: string) => {
        setCurrentWorkspaceId(workspaceId);
        const ws = workspaces.find(w => w.id === workspaceId);
        if (ws && ws.privatePages.length > 0) {
            setCurrentPageId(ws.privatePages[0].id);
        } else if (ws && ws.teamPages.length > 0) {
            setCurrentPageId(ws.teamPages[0].id);
        } else {
            setCurrentPageId('');
        }
    };

    const selectPage = (pageId: string) => {
        setCurrentPageId(pageId);
    };

    const selectChannel = (channelId: string) => {
        setCurrentChannelId(channelId);
    };

    const updatePageContent = (pageId: string, content: string) => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id === currentWorkspaceId) {
                const updateList = (list: Page[]) => list.map(p => p.id === pageId ? { ...p, content } : p);
                return {
                    ...ws,
                    privatePages: updateList(ws.privatePages),
                    teamPages: updateList(ws.teamPages)
                };
            }
            return ws;
        }));
    };

    const updatePageTitle = (pageId: string, title: string) => {
        setWorkspaces(prev => prev.map(ws => {
            if (ws.id === currentWorkspaceId) {
                const updateList = (list: Page[]) => list.map(p => p.id === pageId ? { ...p, title } : p);
                return {
                    ...ws,
                    privatePages: updateList(ws.privatePages),
                    teamPages: updateList(ws.teamPages)
                };
            }
            return ws;
        }));
    }

    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            currentWorkspace,
            currentPage,
            currentChannel,
            createWorkspace,
            createPage,
            createChannel,
            selectWorkspace,
            selectPage,
            selectChannel,
            updatePageContent,
            updatePageTitle
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};
