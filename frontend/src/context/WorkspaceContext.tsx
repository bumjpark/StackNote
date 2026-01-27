import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';

// Types
export interface Page {
    id: string;
    title: string;
    content: string;
    type: 'private' | 'team';
    icon?: string;
}

export interface VoiceChannel {
    id: string;
    name: string;
    users: string[]; // User IDs mock
}

export interface Workspace {
    id: string;
    name: string;
    type: 'private' | 'team';
    privatePages: Page[];
    teamPages: Page[];
    voiceChannels: VoiceChannel[];
}

interface WorkspaceContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    currentPage: Page | null;
    currentChannel: VoiceChannel | null;
    createWorkspace: (name: string, type: 'private' | 'team') => void;
    createPage: (workspaceId: string, title: string, type: 'private' | 'team') => void;
    createChannel: (workspaceId: string, name: string) => void;
    inviteMember: (workspaceId: string, email: string) => Promise<void>;
    selectWorkspace: (workspaceId: string) => void;
    selectPage: (pageId: string) => void;
    selectChannel: (channelId: string) => void;
    updatePageContent: (pageId: string, content: string) => void;
    updatePageTitle: (pageId: string, title: string) => void;
    updatePageIcon: (pageId: string, icon: string) => void;
    updateWorkspaceName: (workspaceId: string, name: string) => void;
    deletePage: (pageId: string) => Promise<void>;
    refreshWorkspaces: () => Promise<void>;
    getInvitations: () => Promise<any[]>;
    respondInvitation: (workspaceId: string, accept: boolean) => Promise<void>;
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

    const refreshWorkspaces = async () => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                setWorkspaces([]);
                return;
            }

            const response = await api.get(`/workspace/user/${userId}`);
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

    // Fetch initial data
    useEffect(() => {
        refreshWorkspaces();
    }, []);


    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;

    // Helper to find page across categories
    const findPage = (id: string, ws: Workspace | null) => {
        if (!ws) return null;
        return ws.privatePages.find(p => p.id === id) || ws.teamPages.find(p => p.id === id) || null;
    };

    const currentPage = findPage(currentPageId, currentWorkspace);
    const currentChannel = currentWorkspace?.voiceChannels.find(c => c.id === currentChannelId) || null;

    const createWorkspace = async (name: string, type: 'private' | 'team') => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            const response = await api.post('/workspace', {
                user_id: parseInt(userId),
                work_space_name: name,
                page_type: type
            });
            // Refetch to get consistent ID and state
            // Or construct manually if response contains enough info
            const newWsData = response.data.user;
            const newWorkspace: Workspace = {
                id: String(newWsData.work_space_id),
                name: newWsData.work_space_name,
                type: type, // Use provided type
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
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            const response = await api.post('/workspace/page_list', {
                user_id: parseInt(userId),
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
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            const response = await api.post('/workspace/voice_channel', {
                user_id: parseInt(userId),
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



    const inviteMember = async (workspaceId: string, email: string) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                alert("Please login first");
                return;
            }
            await api.post(`/workspace/${workspaceId}/members`, {
                email,
                inviter_id: parseInt(userId)
            });
            alert(`Invitation sent to ${email}`);
        } catch (error: any) {
            console.error("Failed to invite member:", error);
            if (error.response && error.response.data && error.response.data.detail) {
                alert(`Failed to invite: ${error.response.data.detail}`);
            } else {
                alert("Failed to invite member. Please try again.");
            }
        }
    };

    const getInvitations = async () => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return [];
            const response = await api.get(`/workspace/user/${userId}/invitations`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch invitations:", error);
            return [];
        }
    };

    const respondInvitation = async (workspaceId: string, accept: boolean) => {
        try {
            const userId = localStorage.getItem('user_id');
            const endpoint = accept ? 'accept' : 'decline';
            await api.post(`/workspace/invitations/${workspaceId}/${endpoint}`, {
                user_id: parseInt(userId || '0')
            });
            // Refresh workspaces if accepted
            if (accept) {
                await refreshWorkspaces();
            }
        } catch (error) {
            console.error("Failed to respond to invitation:", error);
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

    const deletePage = async (pageId: string) => {
        try {
            await api.delete(`/workspace/page_list/${pageId}`);

            // Remove page from local state
            setWorkspaces(prev => prev.map(ws => {
                if (ws.id === currentWorkspaceId) {
                    return {
                        ...ws,
                        privatePages: ws.privatePages.filter(p => p.id !== pageId),
                        teamPages: ws.teamPages.filter(p => p.id !== pageId)
                    };
                }
                return ws;
            }));

            // If deleted page was current, select another page
            if (currentPageId === pageId) {
                const ws = workspaces.find(w => w.id === currentWorkspaceId);
                if (ws) {
                    const remainingPages = [...ws.privatePages, ...ws.teamPages].filter(p => p.id !== pageId);
                    if (remainingPages.length > 0) {
                        setCurrentPageId(remainingPages[0].id);
                    } else {
                        setCurrentPageId('');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to delete page:', error);
        }
    };

    const updatePageTitle = async (pageId: string, title: string) => {
        try {
            // Optimistic update
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
            await api.patch(`/workspace/pages/${pageId}`, { page_name: title });
        } catch (error) {
            console.error("Failed to update page title:", error);
        }
    }

    const updatePageIcon = async (pageId: string, icon: string) => {
        try {
            setWorkspaces(prev => prev.map(ws => {
                if (ws.id === currentWorkspaceId) {
                    const updateList = (list: Page[]) => list.map(p => p.id === pageId ? { ...p, icon } : p);
                    return {
                        ...ws,
                        privatePages: updateList(ws.privatePages),
                        teamPages: updateList(ws.teamPages)
                    };
                }
                return ws;
            }));
            await api.patch(`/workspace/pages/${pageId}`, { icon });
        } catch (error) {
            console.error("Failed to update icon:", error);
        }
    };

    const updateWorkspaceName = async (workspaceId: string, name: string) => {
        try {
            setWorkspaces(prev => prev.map(ws =>
                ws.id === workspaceId ? { ...ws, name } : ws
            ));
            await api.patch(`/workspace/${workspaceId}`, { work_space_name: name });
        } catch (error) {
            console.error("Failed to update workspace name:", error);
        }
    };

    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            currentWorkspace,
            currentPage,
            currentChannel,
            createWorkspace,
            createPage,

            createChannel,
            inviteMember,
            selectWorkspace,
            selectPage,
            selectChannel,
            updatePageContent,
            updatePageTitle,
            updatePageIcon,
            updateWorkspaceName,
            deletePage,
            refreshWorkspaces,
            getInvitations,
            respondInvitation
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};
