import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/client';

// Types
export interface Page {
    id: string;
    title: string;
    content: string;
    type: 'private' | 'team';
    icon?: string;
    parent_page_id?: string | null;
}

export interface VoiceChannel {
    id: string;
    name: string;
    users: string[]; // User IDs mock
}

export interface VoiceParticipant {
    userId: string;
    username: string;
    isSpeaking: boolean;
}

export interface WorkspaceMember {
    id: number;
    email: string;
    name: string;
    role: string;
}

export interface Workspace {
    id: string;
    name: string;
    type: 'private' | 'team';
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
    createWorkspace: (name: string, type: 'private' | 'team') => void;
    deleteWorkspace: (workspaceId: string) => Promise<void>;
    createPage: (workspaceId: string, title: string, type: 'private' | 'team', parentId?: string) => void;
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
    fetchMembers: (workspaceId: string) => Promise<void>;
    uploadPdf: (workspaceId: string, file: File) => Promise<void>;

    // 음성 전용 공간 관련
    getVoiceHistory: (channelId: string) => Promise<any[]>;
    saveVoiceChat: (channelId: string, content: string, msgId?: string) => Promise<any>;

    // 실시간 참여자 및 발화 상태
    voiceParticipants: Record<string, VoiceParticipant[]>;
    setChannelParticipants: (channelId: string, participants: VoiceParticipant[]) => void;
    updateSpeakingStatus: (channelId: string, userId: string, isSpeaking: boolean) => void;

    // 시그널링 훅 (음성/채팅용)
    registerSendMessageHandler: (handler: ((content: string) => void) | null) => void;
    sendChatMessage: (content: string) => void;
    deleteVoiceChat: (chatId: string) => Promise<boolean>;
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

    // 실시간 음성 참여자 상태 (channelId -> VoiceParticipant[])
    const [voiceParticipants, setVoiceParticipants] = useState<Record<string, VoiceParticipant[]>>({});

    const setChannelParticipants = useCallback((channelId: string, participants: VoiceParticipant[]) => {
        setVoiceParticipants(prev => ({
            ...prev,
            [channelId]: participants
        }));
    }, []);

    const updateSpeakingStatus = useCallback((channelId: string, userId: string, isSpeaking: boolean) => {
        setVoiceParticipants(prev => {
            const participants = prev[channelId] || [];
            const userIndex = participants.findIndex(p => p.userId === userId);

            if (userIndex === -1) return prev;
            if (participants[userIndex].isSpeaking === isSpeaking) return prev;

            const newParticipants = [...participants];
            newParticipants[userIndex] = { ...newParticipants[userIndex], isSpeaking };

            return {
                ...prev,
                [channelId]: newParticipants
            };
        });
    }, []);

    // 시그널링 레퍼런스
    const sendMessageHandlerRef = React.useRef<((content: string) => void) | null>(null);

    const sendChatMessage = useCallback((content: string) => {
        if (sendMessageHandlerRef.current) {
            sendMessageHandlerRef.current(content);
        }
    }, []);

    const registerSendMessageHandler = useCallback((handler: ((content: string) => void) | null) => {
        sendMessageHandlerRef.current = handler;
    }, []);

    const getVoiceHistory = async (channelId: string) => {
        try {
            const response = await api.get(`/voice/${channelId}/history`);
            return response.data.history || [];
        } catch (error) {
            console.error("Failed to fetch voice history:", error);
            return [];
        }
    };

    const saveVoiceChat = async (channelId: string, content: string, msgId?: string) => {
        try {
            const userId = localStorage.getItem('user_id');
            const response = await api.post(`/voice/${channelId}/chat`, {
                user_id: parseInt(userId || "0"),
                content: content,
                id: msgId
            });
            return response.data;
        } catch (error) {
            console.error("Failed to save voice chat:", error);
            return null;
        }
    };

    const deleteVoiceChat = async (chatId: string) => {
        try {
            await api.delete(`/voice/chat/${chatId}`);
            return true;
        } catch (error) {
            console.error("Failed to delete voice chat:", error);
            return false;
        }
    };

    const refreshWorkspaces = async () => {
        try {
            const response = await api.get('/workspace/user/info');
            const fetchedWorkspaces = response.data.map((ws: any) => ({
                ...ws,
                members: ws.members || [] // Initialize members if missing
            }));
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

    // Find the active voice channel across ALL workspaces
    const activeVoiceChannel = (() => {
        if (!activeVoiceChannelId || !activeVoiceWorkspaceId) return null;
        const ws = workspaces.find(w => w.id === activeVoiceWorkspaceId);
        return ws?.voiceChannels.find(c => c.id === activeVoiceChannelId) || null;
    })();

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
            await refreshWorkspaces();
            setCurrentWorkspaceId(String(newWsData.id));
            // new workspace has no pages yet
        } catch (error) {
            console.error("Failed to create workspace:", error);
        }
    };

    const deleteWorkspace = async (workspaceId: string) => {
        try {
            if (!confirm("Are you sure you want to delete this workspace? This action cannot be undone.")) {
                return;
            }

            await api.delete(`/workspace/${workspaceId}`);

            // Remove from local state
            setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));

            // Perform selection update based on current state closure (which is consistent enough here)
            // Or better: filter current `workspaces` (from closure) to find next candidate.
            // Since we know we are deleting `workspaceId`.

            const remaining = workspaces.filter(w => w.id !== workspaceId);
            if (currentWorkspaceId === workspaceId) {
                if (remaining.length > 0) {
                    const first = remaining[0];
                    setCurrentWorkspaceId(first.id);
                    if (first.privatePages.length > 0) setCurrentPageId(first.privatePages[0].id);
                    else if (first.teamPages.length > 0) setCurrentPageId(first.teamPages[0].id);
                    else setCurrentPageId('');
                } else {
                    setCurrentWorkspaceId('');
                    setCurrentPageId('');
                }
            }
        } catch (error) {
            console.error("Failed to delete workspace:", error);
            alert("Failed to delete workspace.");
        }
    };

    const createPage = async (workspaceId: string, title: string, type: 'private' | 'team', parentId?: string) => {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            const response = await api.post('/workspace/page_list', {
                user_id: parseInt(userId),
                work_space_id: parseInt(workspaceId),
                // page_type: type, // Removed duplicate
                page_type: type,
                page_list: [title],
                parent_page_id: parentId
            });

            // Response format: { status: "success", user: { work_space_id: 1, page_list_id: [123] } }
            const newPageId = String(response.data.user.page_list_id[0]);

            setWorkspaces(prev => prev.map(w => {
                if (w.id === workspaceId) {
                    const newPage: Page = { id: newPageId, title, content: '', type, parent_page_id: parentId };
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
            if (!userId) {
                alert("Please log in to create a channel");
                return;
            }

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

    const getInvitations = useCallback(async () => {
        try {
            const response = await api.get('/workspace/user/invitations/me');
            return response.data;
        } catch (error) {
            console.error("Failed to fetch invitations:", error);
            return [];
        }
    }, []);

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

        } catch (error: any) {
            console.error("Failed to upload PDF:", error);

            // 423(Busy) or Timeout/Network Error -> Start Polling
            // If error is 423, alert user about queue.
            // If error is timeout (no response or ECONNABORTED), log warning and poll.

            const isBusy = error.response && (error.response.status === 423 || error.response.status === 503);

            if (isBusy) {
                alert("현재 다른 PDF 작업을 실행중이니 이전 작업이 끝나면 알려드리겠습니다.");
            } else {
                console.warn("connection lost or timed out. Switching to polling mode...");
            }

            // Polling logic for BOTH cases (Busy OR Timeout)
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await api.get('/workspace/pdf-status');
                    const isProcessing = statusRes.data.is_processing;

                    if (!isProcessing) {
                        clearInterval(pollInterval);

                        // 작업이 끝났음을 감지하면:
                        // 1. 워크스페이스 새로고침 (새 페이지 확인용)
                        await refreshWorkspaces();
                        alert("PDF 작업이 완료되었습니다."); // 최종 완료 알림
                    }
                } catch (pollError) {
                    console.error("Polling error:", pollError);
                    // Don't clear interval here on simple errors, keep retrying potentially
                    // But if strict failure, maybe clear. Let's keep retrying for robustness.
                }
            }, 60000); // 60초마다 확인
        }
    }


    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            currentWorkspace,
            currentPage,
            currentChannel: activeVoiceChannel, // Mapped to active global state
            createWorkspace,
            deleteWorkspace,
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
            respondInvitation,
            fetchMembers,
            uploadPdf,
            getVoiceHistory,
            saveVoiceChat,
            voiceParticipants,
            setChannelParticipants,
            updateSpeakingStatus,
            registerSendMessageHandler,
            sendChatMessage,
            deleteVoiceChat
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};
