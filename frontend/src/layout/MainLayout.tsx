import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceManager from '../features/VoiceChat/VoiceManager';
import { useWorkspace, type Page } from '../context/WorkspaceContext';
import {
    ChevronDown,
    Plus,
    Users,
    UserPlus,
    Mic,
    Lock,
    LogOut,
    Check,
    Trash2,
    Bell,
    X,
    FileUp,
    Loader2,
    ChevronRight
} from 'lucide-react';

interface MainLayoutProps {
    children: React.ReactNode;
}

interface VoiceChannelItemProps {
    channel: { id: string; name: string };
    isActive: boolean;
    onSelect: () => void;
}

const VoiceChannelItem: React.FC<VoiceChannelItemProps> = ({ channel, isActive, onSelect }) => {
    const { voiceParticipants } = useWorkspace();
    const participants = voiceParticipants[channel.id] || [];

    // Helper to get consistent color from userId
    const getUserColor = (userId: string) => {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Use sin to scramble the hash into distinct R, G, B components
        const r = Math.floor(Math.abs(Math.sin(hash + 1) * 10000) % 256);
        const g = Math.floor(Math.abs(Math.sin(hash + 2) * 10000) % 256);
        const b = Math.floor(Math.abs(Math.sin(hash + 3) * 10000) % 256);

        return `rgb(${r}, ${g}, ${b})`;
    };

    return (
        <div style={{ marginBottom: '4px' }}>
            {/* Channel Name */}
            <div
                onClick={onSelect}
                style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: isActive ? 'rgba(35, 165, 90, 0.1)' : 'transparent',
                    color: isActive ? '#23a55a' : 'var(--text-secondary)',
                    borderRadius: '4px',
                }}
                className="hover:bg-white/5"
            >
                <Mic size={14} />
                <span style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    fontWeight: isActive ? 600 : 400
                }}>{channel.name}</span>
            </div>

            {/* Participants in Sidebar */}
            {participants.length > 0 && (
                <div style={{ padding: '4px 8px 8px 32px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {participants.map(p => (
                        <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: getUserColor(p.userId), // Use unique color per user
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '9px', color: 'white', fontWeight: 'bold',
                                border: p.isSpeaking ? '2.5px solid #23a55a' : '2.5px solid transparent',
                                boxShadow: p.isSpeaking ? '0 0 10px rgba(35, 165, 90, 0.8)' : 'none',
                                transition: 'all 0.1s ease', // Faster transition for responsiveness
                                position: 'relative'
                            }}>
                                {p.username ? p.username.substring(0, 1).toUpperCase() : '?'}
                            </div>
                            <span style={{
                                fontSize: '0.8rem',
                                color: p.isSpeaking ? '#f2f3f5' : '#949ba4',
                                fontWeight: p.isSpeaking ? 600 : 400,
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {p.username || 'Unknown User'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Helper to get display icon
const getPageIcon = (page: any, defaultIcon: React.ReactNode) => {
    if (page.icon) return <span style={{ fontSize: '14px', marginRight: '4px' }}>{page.icon}</span>;
    return defaultIcon;
};

// Recursive Page Tree Item
interface PageTreeItemProps {
    page: Page;
    depth: number;
    getChildPages: (parentId: string) => Page[];
    currentPageId: string;
    onSelect: (id: string) => void;
    onUpdateIcon: (id: string, icon: string) => void;
    onDelete: (id: string) => void;
    onCreateSubPage: (parentId: string) => void;
}

const PageTreeItem: React.FC<PageTreeItemProps> = ({
    page,
    depth,
    getChildPages,
    currentPageId,
    onSelect,
    onUpdateIcon,
    onDelete,
    onCreateSubPage
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const childPages = getChildPages(page.id);
    const hasChildren = childPages.length > 0;
    const isSelected = page.id === currentPageId;

    // Expand if current page is inside this tree (simplification: expand if selected)
    // In a real app, we might want to check if any descendant is selected.

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
                style={{
                    padding: `0.4rem 0.75rem 0.4rem ${0.75 + depth * 0.8}rem`,
                    fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    position: 'relative',
                    cursor: 'pointer'
                }}
                className="hover:bg-white/5 group"
                onClick={() => onSelect(page.id)}
            >
                {/* Expand Toggle */}
                <div
                    style={{
                        width: '16px', height: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        opacity: hasChildren ? 1 : 0
                    }}
                    className="hover:bg-white/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                >
                    {hasChildren && (
                        isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </div>

                {/* Icon */}
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        const newIcon = prompt("Enter an emoji for this page:", page.icon || "📄");
                        if (newIcon) onUpdateIcon(page.id, newIcon);
                    }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Click to change icon"
                >
                    {getPageIcon(page, page.type === 'private' ? <Lock size={14} /> : <Users size={14} />)}
                </div>

                {/* Title */}
                <span
                    style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}
                >{page.title || 'Untitled'}</span>

                {/* Actions (hover only) */}
                <div
                    className="hidden group-hover:flex"
                    style={{
                        opacity: 0.6,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    <div title="Add sub-page" className="cursor-pointer hover:text-white hover:opacity-100" style={{ display: 'flex' }}>
                        <Plus
                            size={14}
                            onClick={(e) => {
                                e.stopPropagation();
                                onCreateSubPage(page.id);
                                setIsExpanded(true); // Auto expand when creating child
                            }}
                        />
                    </div>
                    <div title="Delete page" className="cursor-pointer hover:text-red-400 hover:opacity-100" style={{ display: 'flex' }}>
                        <Trash2
                            size={14}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${page.title || 'Untitled'}"?`)) {
                                    onDelete(page.id);
                                }
                            }}
                            style={{ opacity: 0.5 }}
                        />
                    </div>
                </div>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {childPages.map(child => (
                        <PageTreeItem
                            key={child.id}
                            page={child}
                            depth={depth + 1}
                            getChildPages={getChildPages}
                            currentPageId={currentPageId}
                            onSelect={onSelect}
                            onUpdateIcon={onUpdateIcon}
                            onDelete={onDelete}
                            onCreateSubPage={onCreateSubPage}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const {
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
        deletePage,
        getInvitations,
        respondInvitation,
        updateWorkspaceName,
        updatePageIcon,
        fetchMembers,
        uploadPdf
    } = useWorkspace();

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingFileName, setUploadingFileName] = useState("");
    const [isVoiceViewActive, setIsVoiceViewActive] = useState(false);

    // File Upload Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        if (isUploading) {
            alert("현재 파일 업로드 중입니다. 잠시만 기다려주세요.");
            return;
        }
        if (!currentWorkspace) {
            alert("No workspace selected");
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && currentWorkspace) {
            try {
                setUploadingFileName(file.name);
                setIsUploading(true);
                await uploadPdf(currentWorkspace.id, file);
            } catch (error) {
                console.error("Upload failed", error);
            } finally {
                setIsUploading(false);
                setUploadingFileName("");
                // Reset input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };

    useEffect(() => {
        const checkInvitations = async () => {
            const invites = await getInvitations();
            setInvitations(invites);
        };
        checkInvitations();
        const interval = setInterval(checkInvitations, 10000); // Check every 10 sec
        return () => clearInterval(interval);
    }, [getInvitations]);

    // Fetch members when workspace changes
    useEffect(() => {
        if (currentWorkspace?.id) {
            fetchMembers(currentWorkspace.id);
        }
    }, [currentWorkspace?.id, fetchMembers]);

    const handleAccept = async (workspaceId: string) => {
        await respondInvitation(workspaceId, true);
        setInvitations(prev => prev.filter(inv => inv.workspace_id !== parseInt(workspaceId)));
    };

    const handleDecline = async (workspaceId: string) => {
        await respondInvitation(workspaceId, false);
        setInvitations(prev => prev.filter(inv => inv.workspace_id !== parseInt(workspaceId)));
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user_id');
        sessionStorage.removeItem('user_email');
        navigate('/login');
    };

    const handleAddWorkspace = () => {
        const name = prompt('Enter new workspace name:', 'New Workspace');
        if (name) {
            const typeInput = prompt('Enter workspace type (private/team):', 'team');
            const type = (typeInput?.toLowerCase() === 'team') ? 'team' : 'private';
            createWorkspace(name, type);
            setShowWorkspaceMenu(false);
        }
    };

    // Helper functions for Tree Structure
    const getChildPages = (allPages: Page[], parentId: string | null = null) => {
        return allPages.filter(p => {
            // If parentId is null, we want root pages (parent_page_id is null or undefined)
            if (parentId === null) {
                return !p.parent_page_id;
            }
            return p.parent_page_id === parentId;
        });
    };

    // Memoize the getChildPages for private and team pages to avoid recalculation on every render
    // Actually, simple filtering is cheap enough for now.

    const renderPageTree = (pages: Page[], type: 'private' | 'team') => {
        const rootPages = getChildPages(pages, null);

        if (rootPages.length === 0) {
            return <div style={{ padding: '0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Empty</div>;
        }

        return rootPages.map(page => (
            <PageTreeItem
                key={page.id}
                page={page}
                depth={0}
                getChildPages={(parentId) => getChildPages(pages, parentId)}
                currentPageId={currentPage?.id || ''}
                onSelect={selectPage}
                onUpdateIcon={updatePageIcon}
                onDelete={deletePage}
                onCreateSubPage={(parentId) => {
                    if (currentWorkspace) {
                        createPage(currentWorkspace.id, 'Untitled Page', type, parentId);
                    }
                }}
            />
        ));
    }

    // Switch view when channel selected
    const handleChannelSelect = (channelId: string) => {
        selectChannel(channelId);
        setIsVoiceViewActive(true);
    };

    // Switch view when page selected
    const handlePageSelect = (pageId: string) => {
        selectPage(pageId);
        setIsVoiceViewActive(false);
    };

    // Reset view if disconnected
    useEffect(() => {
        if (!currentChannel) {
            setIsVoiceViewActive(false);
        }
    }, [currentChannel]);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-bg-primary text-text-primary" style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}>


            {/* Sidebar */}
            <aside style={{
                width: '240px',
                backgroundColor: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 20
            }}>
                {/* Workspace Switcher & Notification */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    {/* Workspace Dropdown Trigger */}
                    <div
                        style={{
                            padding: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flex: 1,
                            transition: 'background 0.2s',
                        }}
                    >
                        <div
                            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                            style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {currentWorkspace?.name.substring(0, 1).toUpperCase()}
                        </div>
                        <span
                            onClick={() => {
                                if (!currentWorkspace) return;
                                const newName = prompt("Rename Workspace:", currentWorkspace.name);
                                if (newName && newName !== currentWorkspace.name) {
                                    updateWorkspaceName(currentWorkspace.id, newName);
                                }
                            }}
                            title="Click to rename"
                            style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}
                            className="hover:underline"
                        >
                            {currentWorkspace?.name || 'Select'}
                        </span>
                        <ChevronDown size={14} style={{ cursor: 'pointer', transform: showWorkspaceMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)} />
                    </div>

                    {/* Notification Bell */}
                    <div
                        onClick={() => setShowNotifications(!showNotifications)}
                        style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                        className="hover:bg-white/5"
                    >
                        <Bell size={16} color="var(--text-secondary)" />
                        {invitations.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                width: '8px',
                                height: '8px',
                                background: '#ef4444',
                                borderRadius: '50%',
                                border: '2px solid var(--bg-secondary)'
                            }} />
                        )}
                    </div>
                </div>

                {/* Notifications Panel */}
                {showNotifications && (
                    <div className="glass-panel" style={{
                        position: 'absolute',
                        top: '45px',
                        left: '240px', // Just outside sidebar
                        width: '280px',
                        padding: '1rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0 8px 8px 0', // Attached to side
                        boxShadow: '4px 0 12px rgba(0,0,0,0.3)',
                        zIndex: 60
                    }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Invitations</h3>
                        {invitations.length === 0 ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No pending invitations.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {invitations.map((inv: any) => (
                                    <div key={inv.workspace_id} style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px' }}>
                                        <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                            Join <strong>{inv.workspace_name}</strong>?
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                            Invited by User #{inv.inviter_id}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handleAccept(String(inv.workspace_id))}
                                                style={{ flex: 1, padding: '0.3rem', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                            >
                                                <Check size={12} /> Accept
                                            </button>
                                            <button
                                                onClick={() => handleDecline(String(inv.workspace_id))}
                                                style={{ flex: 1, padding: '0.3rem', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                            >
                                                <X size={12} /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Workspace Dropdown Menu */}
                {showWorkspaceMenu && (
                    <div className="glass-panel" style={{
                        position: 'absolute',
                        top: '45px',
                        left: '10px',
                        width: '220px',
                        padding: '0.5rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 50
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem' }}>
                            Switch Workspace
                        </div>
                        {workspaces.map(ws => (
                            <div
                                key={ws.id}
                                onClick={() => { selectWorkspace(ws.id); setShowWorkspaceMenu(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    background: ws.id === currentWorkspace?.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    color: ws.id === currentWorkspace?.id ? 'item-active' : 'var(--text-primary)'
                                }}
                                className="hover:bg-white/5"
                            >
                                <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#000' }}>
                                    {ws.name.substring(0, 1).toUpperCase()}
                                </div>
                                <span style={{ fontSize: '0.85rem', flex: 1 }}>{ws.name}</span>
                                {ws.id === currentWorkspace?.id && <Check size={14} />}
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>
                        <div
                            onClick={handleAddWorkspace}
                            style={{ padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            className="hover:bg-white/5"
                        >
                            <Plus size={14} /> Create Workspace
                        </div>
                    </div>
                )}

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf"
                    onChange={handleFileChange}
                />

                {/* Categories */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>

                    {/* Private Pages */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0 0.75rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PRIVATE</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div title="Import PDF" onClick={handleUploadClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <FileUp size={14} />
                                </div>
                                <div title="Create Page" onClick={() => currentWorkspace && createPage(currentWorkspace.id, 'Untitled Private', 'private')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Plus size={14} />
                                </div>
                            </div>
                        </div>
                        {isUploading && (
                            <div
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    color: 'var(--text-secondary)',
                                    opacity: 0.7,
                                    cursor: 'not-allowed'
                                }}
                            >
                                <Loader2 size={14} className="spinner" />
                                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                                    {uploadingFileName.replace(".pdf", "")}
                                </span>
                            </div>
                        )}

                        {/* RENDER PRIVATE PAGE TREE */}
                        {renderPageTree(currentWorkspace.privatePages, 'private')}

                        {currentWorkspace?.privatePages.map(page => (
                            <div
                                key={page.id}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: page.id === currentPage?.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    color: page.id === currentPage?.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    position: 'relative'
                                }}
                                className="hover:bg-white/5 group"
                            >
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newIcon = prompt("Enter an emoji for this page:", page.icon || "📄");
                                        if (newIcon) updatePageIcon(page.id, newIcon);
                                    }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title="Click to change icon"
                                >
                                    {getPageIcon(page, <Lock size={14} />)}
                                </div>
                                <span
                                    onClick={() => handlePageSelect(page.id)}
                                    style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, cursor: 'pointer' }}
                                >{page.title || 'Untitled'}</span>
                                <Trash2
                                    size={14}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete "${page.title || 'Untitled'}"?`)) {
                                            deletePage(page.id);
                                        }
                                    }}
                                    style={{ cursor: 'pointer', opacity: 0.5 }}
                                    className="hover:opacity-100 hover:text-red-400"
                                />
                            </div>
                        ))}
                        {currentWorkspace?.privatePages.length === 0 && (
                            <div style={{ padding: '0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Empty</div>
                        )}
                      
                    </div>

                    {/* Team Spaces */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0 0.75rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>TEAM PAGES</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <div
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    onClick={() => {
                                        if (!currentWorkspace) return;
                                        const email = prompt("초대할 팀원의 이메일을 입력하세요:");
                                        if (email) {
                                            inviteMember(currentWorkspace.id, email);
                                        }
                                    }}
                                    title="Invite Member"
                                >
                                    <UserPlus size={14} />
                                </div>
                                <div
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    onClick={() => currentWorkspace && createPage(currentWorkspace.id, 'Untitled Team Page', 'team')}
                                    title="Create Page"
                                >
                                    <Plus size={14} />
                                </div>
                            </div>
                        </div>

                        {/* RENDER TEAM PAGE TREE */}
                        {renderPageTree(currentWorkspace.teamPages, 'team')}

                        {currentWorkspace?.teamPages.map(page => (
                            <div
                                key={page.id}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: page.id === currentPage?.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    color: page.id === currentPage?.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    position: 'relative'
                                }}
                                className="hover:bg-white/5 group"
                            >
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newIcon = prompt("Enter an emoji for this page:", page.icon || "📄");
                                        if (newIcon) updatePageIcon(page.id, newIcon);
                                    }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title="Click to change icon"
                                >
                                    {getPageIcon(page, <Users size={14} />)}
                                </div>
                                <span
                                    onClick={() => handlePageSelect(page.id)}
                                    style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, cursor: 'pointer' }}
                                >{page.title || 'Untitled'}</span>
                                <Trash2
                                    size={14}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete "${page.title || 'Untitled'}"?`)) {
                                            deletePage(page.id);
                                        }
                                    }}
                                    style={{ cursor: 'pointer', opacity: 0.5 }}
                                    className="hover:opacity-100 hover:text-red-400"
                                />
                            </div>
                        ))}
                        {currentWorkspace?.teamPages.length === 0 && (
                            <div style={{ padding: '0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Empty</div>
                        )}
                    </div>

                    {/* Voice Channels - Always Visible */}
                    {currentWorkspace?.voiceChannels && currentWorkspace.voiceChannels.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ padding: '0 0.75rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>VOICE CHANNELS</span>
                                <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => {
                                    const name = prompt('Channel Name:');
                                    if (name && currentWorkspace) createChannel(currentWorkspace.id, name);
                                }} />
                            </div>
                            {currentWorkspace?.voiceChannels.map(channel => (
                                <VoiceChannelItem
                                    key={channel.id}
                                    channel={channel}
                                    isActive={channel.id === currentChannel?.id}
                                    onSelect={() => handleChannelSelect(channel.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Members List 복구 (음성 채널 참여자가 없을 때만 표시하거나, 혹은 항상 표시) */}
                    {(currentWorkspace?.type === 'team' || currentPage?.type === 'team' || currentWorkspace?.voiceChannels.some(vc => vc.id === currentChannel?.id)) && (
                        <div style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                            <div style={{ padding: '0 0.75rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PAGE MEMBERS</span>
                            </div>
                            {currentWorkspace?.members?.map(member => (
                                <div
                                    key={member.id}
                                    style={{
                                        padding: '0.4rem 0.75rem',
                                        fontSize: '0.9rem',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        color: 'var(--text-secondary)'
                                    }}
                                    className="hover:bg-white/5"
                                >
                                    <div style={{
                                        width: '24px', height: '24px',
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.05)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '10px', color: 'var(--text-primary)'
                                    }}>
                                        {member.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                                            {member.name}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            {member.role === 'owner' ? 'owner' : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Bottom Actions */}
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem' }}>
                    <div
                        onClick={handleLogout}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        className="hover:text-primary"
                    >
                        <LogOut size={16} /> Log out
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--bg-primary)'
            }}>
                {/* Voice Manager - Hidden but active when in page view */}
                {currentChannel && (
                    <div style={{
                        flex: 1,
                        height: '100%',
                        display: isVoiceViewActive ? 'block' : 'none'
                    }}>
                        <VoiceManager />
                    </div>
                )}

                {/* Page Content - Visible when voice view is NOT active */}
                <div style={{
                    flex: 1,
                    height: '100%',
                    overflowY: 'auto',
                    position: 'relative',
                    display: (!currentChannel || !isVoiceViewActive) ? 'block' : 'none'
                }}>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
