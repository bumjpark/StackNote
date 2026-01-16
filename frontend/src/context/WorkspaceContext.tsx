import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';

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

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');
    const [currentPageId, setCurrentPageId] = useState<string>('');
    const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Hardcoded user_id=1 as per current auth mock
                const response = await api.get('/workspace/user/1');
                const fetchedWorkspaces = response.data;
                setWorkspaces(fetchedWorkspaces);

                if (fetchedWorkspaces.length > 0) {
                    // If no workspace selected yet, or current one invalid, select first
                    if (!currentWorkspaceId || !fetchedWorkspaces.find((w: Workspace) => w.id === currentWorkspaceId)) {
                        const firstWs = fetchedWorkspaces[0];
                        setCurrentWorkspaceId(firstWs.id);
                        if (firstWs.privatePages.length > 0) {
                            setCurrentPageId(firstWs.privatePages[0].id);
                        } else if (firstWs.teamPages.length > 0) {
                            setCurrentPageId(firstWs.teamPages[0].id);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch workspaces:", error);
            }
        };

        fetchData();
    }, []);


    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;

    // Helper to find page across categories
    const findPage = (id: string, ws: Workspace | null) => {
        if (!ws) return null;
        return ws.privatePages.find(p => p.id === id) || ws.teamPages.find(p => p.id === id) || null;
    };

    const currentPage = findPage(currentPageId, currentWorkspace);
    const currentChannel = currentWorkspace?.voiceChannels.find(c => c.id === currentChannelId) || null;

    const createWorkspace = async (name: string) => {
        try {
            const response = await api.post('/workspace', {
                user_id: 1, // Mock user ID
                work_space_name: name,
                page_type: 'private' // Defaulting
            });
            // Refetch to get consistent ID and state
            // Or construct manually if response contains enough info
            const newWsData = response.data.user;
            const newWorkspace: Workspace = {
                id: String(newWsData.work_space_id),
                name: newWsData.work_space_name,
                privatePages: [],
                teamPages: [],
                voiceChannels: []
            };

            setWorkspaces([...workspaces, newWorkspace]);
            setCurrentWorkspaceId(newWorkspace.id);
            // new workspace has no pages yet
        } catch (error) {
            console.error("Failed to create workspace:", error);
        }
    };

    const createPage = async (workspaceId: string, title: string, type: 'private' | 'team') => {
        try {
            const response = await api.post('/workspace/page_list', {
                user_id: 1,
                work_space_id: parseInt(workspaceId),
                page_type: type,
                page_list: [title]
            });

            // Response format: { status: "success", user: { work_space_id: 1, page_list_id: [123] } }
            const newPageId = String(response.data.user.page_list_id[0]);

            setWorkspaces(prev => prev.map(w => {
                if (w.id === workspaceId) {
                    const newPage: Page = { id: newPageId, title, content: '', type };
                    setCurrentPageId(newPageId);
                    if (type === 'private') {
                        return { ...w, privatePages: [...w.privatePages, newPage] };
                    } else {
                        return { ...w, teamPages: [...w.teamPages, newPage] };
                    }
                }
                return w;
            }));

        } catch (error) {
            console.error("Failed to create page:", error);
        }
    };

    const createChannel = async (workspaceId: string, name: string) => {
        try {
            const response = await api.post('/workspace/voice_channel', {
                user_id: 1, // Mock user ID
                work_space_id: parseInt(workspaceId),
                channel_name: name
            });

            // Response: { status: "success", channel_id: "uuid", channel_name: "name" }
            const { channel_id, channel_name } = response.data;

            setWorkspaces(prev => prev.map(w => {
                if (w.id === workspaceId) {
                    const newChannel: VoiceChannel = { id: channel_id, name: channel_name, users: [] };
                    return { ...w, voiceChannels: [...w.voiceChannels, newChannel] };
                }
                return w;
            }));
        } catch (error) {
            console.error("Failed to create voice channel:", error);
        }
    };

    const selectWorkspace = (workspaceId: string) => {
        setCurrentWorkspaceId(workspaceId);
        const ws = workspaces.find(w => w.id === workspaceId);
        if (ws) {
            if (ws.privatePages.length > 0) {
                setCurrentPageId(ws.privatePages[0].id);
            } else if (ws.teamPages.length > 0) {
                setCurrentPageId(ws.teamPages[0].id);
            } else {
                setCurrentPageId('');
            }
        }
    };

    const selectPage = (pageId: string) => {
        setCurrentPageId(pageId);
    };

    const selectChannel = (channelId: string) => {
        setCurrentChannelId(channelId);
    };

    const updatePageContent = (pageId: string, content: string) => {
        // Content update is handled mainly by BlockEditor saving blocks.
        // This context update might be for local UI optimistic updates if needed, 
        // but for now we trust the editor component to persist.
        // We can keep this state update for UI consistency if content preview is needed.
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

    const updatePageTitle = async (pageId: string, title: string) => {
        // TODO: Add backend API update if needed?
        // For now local update
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
