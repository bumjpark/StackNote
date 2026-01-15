import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceManager from '../features/VoiceChat/VoiceManager';
import { useWorkspace } from '../context/WorkspaceContext';
import {
    ChevronDown,
    Plus,
    Users,
    Mic,
    Lock,
    LogOut,
    Check
} from 'lucide-react';

interface MainLayoutProps {
    children: React.ReactNode;
}

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
        selectChannel
    } = useWorkspace();

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

    // Note: I can implement collapsible state if requested, but for now I'll keep them open.
    // const [collapsed, setCollapsed] = useState({ private: false, team: false, voice: false }); 

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
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
                                onClick={() => selectPage(page.id)}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: page.id === currentPage?.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    color: page.id === currentPage?.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                                className="hover:bg-white/5"
                            >
                                <Lock size={14} />
                                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{page.title || 'Untitled'}</span>
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
                            <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => currentWorkspace && createPage(currentWorkspace.id, 'Untitled Team Page', 'team')} />
                        </div>
                        {currentWorkspace?.teamPages.map(page => (
                            <div
                                key={page.id}
                                onClick={() => selectPage(page.id)}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: page.id === currentPage?.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    color: page.id === currentPage?.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                                className="hover:bg-white/5"
                            >
                                <Users size={14} />
                                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{page.title || 'Untitled'}</span>
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
                            <div
                                key={channel.id}
                                onClick={() => selectChannel(channel.id)}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: channel.id === currentChannel?.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    color: channel.id === currentChannel?.id ? '#10b981' : 'var(--text-secondary)'
                                }}
                                className="hover:bg-white/5"
                            >
                                <Mic size={14} />
                                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{channel.name}</span>
                            </div>
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
                {/* We can pass props or let it access context internally. It accesses internal state for now. */}
                <VoiceManager />
            </main>
        </div>
    );
};

export default MainLayout;
