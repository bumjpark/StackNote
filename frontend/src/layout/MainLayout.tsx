import React, { useState, useEffect } from 'react';
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
    X
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
                const response = await fetch('http://localhost:8001/active_users');
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
        inviteMember,
        selectWorkspace,
        selectPage,
        selectChannel,
        deletePage,
        getInvitations,
        respondInvitation,
        updateWorkspaceName, // Destructured
        updatePageIcon     // Destructured
    } = useWorkspace();

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const checkInvitations = async () => {
            const invites = await getInvitations();
            setInvitations(invites);
        };
        checkInvitations();
        const interval = setInterval(checkInvitations, 10000); // Check every 10 sec
        return () => clearInterval(interval);
    }, [getInvitations]);

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
            createWorkspace(name, 'private');
            setShowWorkspaceMenu(false);
        }
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-bg-primary text-text-primary" style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>

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

                {/* Categories */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>

                    {/* Private Pages */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0 0.75rem 0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PRIVATE</span>
                            <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => currentWorkspace && createPage(currentWorkspace.id, 'Untitled Private', 'private')} />
                        </div>
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
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>TEAM SPACES</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <UserPlus
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        if (!currentWorkspace) return;
                                        // Removed restrictions on private workspaces
                                        const email = prompt("초대할 팀원의 이메일을 입력하세요:");
                                        if (email) {
                                            inviteMember(currentWorkspace.id, email);
                                        }
                                    }}
                                    title="Invite Member"
                                />
                                <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => currentWorkspace && createPage(currentWorkspace.id, 'Untitled Team Page', 'team')} title="Create Page" />
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

                    {/* Voice Channels */}
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
                                onSelect={() => selectChannel(channel.id)}
                            />
                        ))}
                    </div>

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
