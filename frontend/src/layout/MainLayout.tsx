import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceManager from '../features/VoiceChat/VoiceManager';
import { useWorkspace } from '../context/WorkspaceContext';
import {
    ChevronDown,
    Plus,
    Users,
    UserPlus, // Added import
    Mic,
    Lock,
    LogOut,
    Check,
    User,
    Trash2
} from 'lucide-react';

// ... (existing code)

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
        inviteMember, // Destructure inviteMember
        selectWorkspace,
        selectPage,
        selectChannel,
        deletePage
    } = useWorkspace();

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

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
                {/* Workspace Switcher (Dropdown Header) */}
                <div
                    onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                    style={{
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderBottom: '1px solid var(--border-color)'
                    }}
                    className="hover:bg-white/5"
                >
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                        {currentWorkspace?.name.substring(0, 1).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {currentWorkspace?.name || 'Select Workspace'}
                    </span>
                    <ChevronDown size={14} style={{ transform: showWorkspaceMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

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
                                <Lock size={14} />
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
                                        if (currentWorkspace.type === 'private') {
                                            alert("개인 워크스페이스에는 멤버를 초대할 수 없습니다.");
                                            return;
                                        }
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
                                <Users size={14} />
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
