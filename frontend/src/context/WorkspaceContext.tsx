import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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
    page_id?: string; // [NEW]
    users: string[]; // User IDs mock
}

export interface WorkspaceMember {
    id: number;
    email: string;
    name: string;
    role: string;
}

export interface PageMember extends WorkspaceMember { } // Alias/reuse

export interface Workspace {
    id: string;
    name: string;
    privatePages: Page[];
    teamPages: Page[];
    voiceChannels: VoiceChannel[];
    members: WorkspaceMember[];
}

interface WorkspaceContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    currentPage: Page | null;
    currentChannel: VoiceChannel | null;
    createWorkspace: (name: string) => void;
    createPage: (workspaceId: string, title: string, type: 'private' | 'team') => void;
    createChannel: (workspaceId: string, name: string, pageId?: string) => void;
    inviteMember: (workspaceId: string, email: string) => Promise<void>;
    inviteToPage: (pageId: string, email: string) => Promise<void>;
    fetchPageMembers: (pageId: string) => Promise<WorkspaceMember[]>;
    selectWorkspace: (workspaceId: string) => void;
    selectPage: (pageId: string) => void;
    selectChannel: (channelId: string) => void;
    updatePageContent: (pageId: string, content: string) => void;
    updatePageTitle: (pageId: string, title: string) => void;
    updatePageIcon: (pageId: string, icon: string) => void;
    updateWorkspaceName: (workspaceId: string, name: string) => void;
    deletePage: (pageId: string) => Promise<void>;
    deleteWorkspace: (workspaceId: string) => Promise<void>;
    refreshWorkspaces: () => Promise<void>;
    getInvitations: () => Promise<any[]>;
    respondInvitation: (id: string, accept: boolean, type?: string) => Promise<void>;
    fetchMembers: (workspaceId: string) => Promise<void>;
    uploadPdf: (workspaceId: string, file: File) => Promise<void>;
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

    // Voice State - Globally persistent
    const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
    const [activeVoiceWorkspaceId, setActiveVoiceWorkspaceId] = useState<string | null>(null);

    const refreshWorkspaces = async (preserveCurrentSelection: boolean = false) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                setWorkspaces([]);
                return;
            }

            // Capture current IDs before refresh if preserving
            const savedWorkspaceId = preserveCurrentSelection ? currentWorkspaceId : null;
            const savedPageId = preserveCurrentSelection ? currentPageId : null;

            const response = await api.get(`/workspace/user/${userId}`);
            const fetchedWorkspaces = response.data.map((ws: any) => ({
                ...ws,
                id: String(ws.id), // Ensure ID is always string for comparison
                members: ws.members || []
            }));
            setWorkspaces(fetchedWorkspaces);

            if (fetchedWorkspaces.length > 0) {
                // If preserving and the saved workspace still exists, restore it
                if (preserveCurrentSelection && savedWorkspaceId && fetchedWorkspaces.find((w: Workspace) => w.id === savedWorkspaceId)) {
                    setCurrentWorkspaceId(savedWorkspaceId);
                    if (savedPageId) {
                        setCurrentPageId(savedPageId);
                    }
                } else if (!currentWorkspaceId || !fetchedWorkspaces.find((w: Workspace) => w.id === currentWorkspaceId)) {
                    // If no workspace selected yet, or current one invalid, select first
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

    // Find the active voice channel across ALL workspaces
    const activeVoiceChannel = (() => {
        if (!activeVoiceChannelId || !activeVoiceWorkspaceId) return null;
        const ws = workspaces.find(w => w.id === activeVoiceWorkspaceId);
        return ws?.voiceChannels.find(c => c.id === activeVoiceChannelId) || null;
    })();

    const createWorkspace = async (name: string) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            const response = await api.post('/workspace', {
                user_id: parseInt(userId),
                work_space_name: name
            });
            await refreshWorkspaces();
            const newId = String(response.data.user.id);
            setCurrentWorkspaceId(newId);
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

    const createChannel = async (workspaceId: string, name: string, pageId?: string) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                alert("Please log in to create a channel");
                return;
            }

            const response = await api.post('/workspace/voice_channel', {
                user_id: parseInt(userId),
                work_space_id: parseInt(workspaceId),
                page_id: pageId, // [NEW] Optional
                channel_name: name
            });

            // Response: { status: "success", channel_id: "uuid", channel_name: "name" }
            const { channel_id, channel_name } = response.data;

            setWorkspaces(prev => prev.map(w => {
                if (w.id === workspaceId) {
                    const newChannel: VoiceChannel = { id: channel_id, name: channel_name, page_id: pageId, users: [] };
                    return { ...w, voiceChannels: [...w.voiceChannels, newChannel] };
                }
                return w;
            }));

            // Optionally auto-join created channel? Let's leave it manual for now.
        } catch (error: any) {
            console.error("Failed to create voice channel:", error);
            if (error.response && error.response.status === 403) {
                alert("You don't have permission to create voice channels here.");
            }
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

    const inviteToPage = async (pageId: string, email: string) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                alert("Please login first");
                return;
            }
            await api.post(`/workspace/pages/${pageId}/members`, {
                email,
                inviter_id: parseInt(userId)
            });
            alert(`Invitation sent to ${email}`);
        } catch (error: any) {
            console.error("Failed to invite member to page:", error);
            if (error.response && error.response.data && error.response.data.detail) {
                alert(`Failed to invite: ${error.response.data.detail}`);
            } else {
                alert("Failed to invite member. Please try again.");
            }
        }
    }

    const fetchPageMembers = async (pageId: string): Promise<WorkspaceMember[]> => {
        try {
            const response = await api.get(`/workspace/pages/${pageId}/members`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch page members:", error);
            return [];
        }
    }

    const getInvitations = useCallback(async () => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return [];
            const response = await api.get(`/workspace/user/${userId}/invitations`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch invitations:", error);
            return [];
        }
    }, []);

    const respondInvitation = async (id: string, accept: boolean, type: string = 'workspace') => {
        try {
            const userId = localStorage.getItem('user_id');
            const endpoint = accept ? 'accept' : 'decline';

            if (type === 'page') {
                await api.post(`/workspace/pages/${id}/${endpoint}`, {
                    user_id: parseInt(userId || '0'),
                    target_workspace_id: accept ? parseInt(currentWorkspaceId || '0') : undefined
                });
            } else {
                await api.post(`/workspace/invitations/${id}/${endpoint}`, {
                    user_id: parseInt(userId || '0')
                });
            }

            // Refresh workspaces if accepted, preserving current selection
            if (accept) {
                await refreshWorkspaces(true);
            }
        } catch (error) {
            console.error(`Failed to respond to ${type} invitation:`, error);
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
        // If clicking the same channel, maybe disconnect? Or just nothing.
        // For now, joining replaces previous connection.
        // We need to know which workspace this channel belongs to
        // Because channelId itself might not be enough if we didn't search all workspaces

        if (!channelId) {
            setActiveVoiceChannelId(null);
            setActiveVoiceWorkspaceId(null);
            return;
        }

        // Find which workspace has this channel
        for (const ws of workspaces) {
            if (ws.voiceChannels.find(c => c.id === channelId)) {
                setActiveVoiceWorkspaceId(ws.id);
                setActiveVoiceChannelId(channelId);
                return;
            }
        }
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

    const deleteWorkspace = async (workspaceId: string) => {
        try {
            await api.delete(`/workspace/${workspaceId}`);

            setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));

            // If deleting current, switch to another
            if (currentWorkspaceId === workspaceId) {
                const remaining = workspaces.filter(w => w.id !== workspaceId);
                if (remaining.length > 0) {
                    setCurrentWorkspaceId(remaining[0].id);
                } else {
                    // Assuming empty string is default "no selection" or handle null if type allows
                    // Checking type definition: activeVoiceWorkspaceId is string | null
                    // currentWorkspaceId is string (from hook?) let's filter hook definition
                    // Actually setCurrentWorkspaceId usually expects string. Let's check state definition.
                    // State: const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');
                    setCurrentWorkspaceId('');
                }
            }
        } catch (error) {
            console.error("Failed to delete workspace:", error);
        }
    };

    const fetchMembers = useCallback(async (workspaceId: string) => {
        console.log(`[WorkspaceContext] fetchMembers called for ${workspaceId}`);
        try {
            const response = await api.get(`/workspace/${workspaceId}/members`);
            console.log(`[WorkspaceContext] fetchMembers success:`, response.data);
            setWorkspaces(prev => prev.map(ws =>
                ws.id === workspaceId ? { ...ws, members: response.data } : ws
            ));
        } catch (error) {
            console.error('[WorkspaceContext] Failed to fetch members:', error);
        }
    }, []);

    const uploadPdf = async (workspaceId: string, file: File) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                alert("Please login first");
                return;
            }

            const formData = new FormData();
            formData.append('workspace_id', workspaceId);
            formData.append('user_id', userId);
            formData.append('file', file);

            const response = await api.post('/workspace/pages/upload-pdf', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Response format expected: { status: "success", page_id: 123, ... }
            if (response.data.status === 'success') {
                const newPageId = String(response.data.page_id);
                // const newTitle = file.name.replace('.pdf', '');

                // Assuming it's created as a private page type="doc" (treated as private usually?)
                // Or verify backend logic. Backend sets page_type="doc".
                // We need to decide where to put it. Let's assume private for now or refresh?
                // Actually backend process_pdf_upload creates it.
                // It sets page_type="doc". 
                // Let's assume it's like a private page or we re-fetch workspace.
                // Safest is to refetch workspace to get correct structure.
                await refreshWorkspaces();

                // Select the new page
                // Need to find it after refresh. 
                // Since refresh is async, we can set ID after.
                // Ideally refresh waits.
                setCurrentPageId(newPageId);
            }
        } catch (error) {
            console.error("Failed to upload PDF:", error);
            alert("Failed to upload PDF. Please try again.");
        }
    };

    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            currentWorkspace,
            currentPage,
            currentChannel: activeVoiceChannel, // Mapped to active global state
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
            deleteWorkspace, // [NEW] Included in provider
            refreshWorkspaces,
            getInvitations,
            respondInvitation,
            fetchMembers,
            inviteToPage,
            fetchPageMembers,
            uploadPdf
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};
