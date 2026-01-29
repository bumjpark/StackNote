import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceManager from '../features/VoiceChat/VoiceManager';
import { useWorkspace } from '../context/WorkspaceContext';
import {
    ChevronDown,
    Plus,
    Users,
    UserPlus,
    Mic,
    Lock,
    LogOut,
    Check,
    User,
    Trash2,
    Bell,
    X,
    FileUp,
    Loader2
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
    const [activeUsers, setActiveUsers] = useState<Array<{ user_id: string, username: string }>>([]);

    useEffect(() => {
        const fetchActiveUsers = async () => {
            try {
                const response = await fetch('http://localhost:8011/active_users');
                const data = await response.json();
                setActiveUsers(data[channel.id] || []);
            } catch (err) {
                console.error('Failed to fetch active users:', err);
            }
        };

        fetchActiveUsers();
        const interval = setInterval(fetchActiveUsers, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, [channel.id]);

    return (
        <div>
            {/* Channel Name */}
            <div
                onClick={onSelect}
                style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    color: isActive ? '#10b981' : 'var(--text-secondary)'
                }}
                className="hover:bg-white/5"
            >
                <Mic size={14} />
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{channel.name}</span>
            </div>

            {/* Active Users */}
            {activeUsers.length > 0 && (
                <div style={{ paddingLeft: '2rem', marginTop: '0.25rem' }}>
                    {activeUsers.map(user => (
                        <div
                            key={user.user_id}
                            style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <User size={12} />
                            <span>{user.username}</span>
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
        selectWorkspace,
        selectPage,
        selectChannel,
        deletePage,
        getInvitations,
        respondInvitation,
        updateWorkspaceName,
        updatePageIcon,
        fetchMembers,
        inviteToPage,
        fetchPageMembers,
        uploadPdf,
        deleteWorkspace
    } = useWorkspace();

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingFileName, setUploadingFileName] = useState("");
    const [pageMembers, setPageMembers] = useState<any[]>([]); // [NEW]

    // File Upload Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
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

    // Fetch page members when current page changes
    useEffect(() => {
        if (currentPage?.id && currentPage.type === 'team') {
            fetchPageMembers(currentPage.id).then(setPageMembers);
        } else {
            setPageMembers([]);
        }
    }, [currentPage?.id, fetchPageMembers]);

    const handleAccept = async (id: string, type: string = 'workspace', _workspaceId?: string) => {
        await respondInvitation(id, true, type);

        // For workspace invitations, switch to the new workspace
        // For page invitations, the page is added to the CURRENT workspace (target), so don't switch
        if (type === 'workspace') {
            selectWorkspace(id);
        }
        // Note: For page invitations, the page should now appear in the current workspace's team pages
        // after refreshWorkspaces(true) is called inside respondInvitation

        setInvitations(prev => prev.filter(inv => {
            const invId = inv.type === 'page' ? inv.id : String(inv.workspace_id);
            return invId !== id;
        }));
    };

    const handleDecline = async (id: string, type: string = 'workspace') => {
        await respondInvitation(id, false, type);
        setInvitations(prev => prev.filter(inv => {
            const invId = inv.type === 'page' ? inv.id : String(inv.workspace_id);
            return invId !== id;
        }));
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
            createWorkspace(name);
            setShowWorkspaceMenu(false);
        }
    };

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
                                {invitations.map((inv: any) => {
                                    const isPage = inv.type === 'page';
                                    const id = isPage ? inv.id : String(inv.workspace_id);
                                    const name = isPage ? inv.name : inv.workspace_name;

                                    return (
                                        <div key={id} style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px' }}>
                                            <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                                Join <strong>{name}</strong> {isPage ? '(Page)' : ''}?
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                {isPage ? `In workspace #${inv.workspace_id}` : `Invited by User #${inv.inviter_id}`}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleAccept(id, isPage ? 'page' : 'workspace', String(inv.workspace_id))}
                                                    style={{ flex: 1, padding: '0.3rem', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                                >
                                                    <Check size={12} /> Accept
                                                </button>
                                                <button
                                                    onClick={() => handleDecline(id, isPage ? 'page' : 'workspace')}
                                                    style={{ flex: 1, padding: '0.3rem', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                                >
                                                    <X size={12} /> Decline
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    background: ws.id === currentWorkspace?.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    color: ws.id === currentWorkspace?.id ? '#fff' : 'rgba(255,255,255,0.7)',
                                    marginBottom: '2px'
                                }}
                                className="workspace-item"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = ws.id === currentWorkspace?.id ? 'rgba(255,255,255,0.05)' : 'transparent';
                                }}
                            >
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}
                                    onClick={() => {
                                        selectWorkspace(ws.id);
                                        setShowWorkspaceMenu(false);
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '4px',
                                        background: '#37352f',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#fff'
                                    }}>
                                        {ws.name.substring(0, 1)}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{
                                            fontSize: '0.9rem',
                                            fontWeight: ws.id === currentWorkspace?.id ? '600' : '400'
                                        }}>
                                            {ws.name}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Are you sure you want to delete workspace "${ws.name}"?`)) {
                                            deleteWorkspace(ws.id);
                                        }
                                    }}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#999',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b6b'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                                >
                                    <Trash2 size={14} />
                                </button>
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
                                    onClick={() => selectPage(page.id)}
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
                                {/* Global Invite Removed */}
                                <div
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    onClick={() => currentWorkspace && createPage(currentWorkspace.id, 'Untitled Team Page', 'team')}
                                    title="Create Page"
                                >
                                    <Plus size={14} />
                                </div>
                            </div>
                        </div>
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
                                    onClick={() => selectPage(page.id)}
                                    style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, cursor: 'pointer' }}
                                >{page.title || 'Untitled'}</span>
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const email = prompt(`Invite to "${page.title}" page: \nEnter email:`);
                                        if (email) inviteToPage(page.id, email);
                                    }}
                                    style={{ cursor: 'pointer', opacity: 0.5, marginRight: '4px', display: 'flex', alignItems: 'center' }}
                                    className="hover:opacity-100 hover:text-accent-primary"
                                    title="Invite to Page"
                                >
                                    <UserPlus size={14} />
                                </div>
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


                    {/* Members List (Page Specific) */}
                    {(currentPage?.type === 'team') && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ padding: '0 0.75rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PAGE MEMBERS</span>
                            </div>
                            {pageMembers.map(member => (
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
                                        background: 'var(--bg-tertiary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <User size={14} color="var(--text-primary)" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                                            {member.name || member.email?.split('@')[0]}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            {member.role}
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
            <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                {children}

                {/* Voice Manager (Connected to State) */}
                <VoiceManager />
            </main>
        </div>
    );
};

export default MainLayout;
