import React from 'react';
import MainLayout from '../../layout/MainLayout';
import { useWorkspace } from '../../context/WorkspaceContext';
import BlockEditor from '../../components/BlockEditor';

const WorkspaceView: React.FC = () => {
    const { currentPage, updatePageTitle } = useWorkspace();

    if (!currentPage) {
        return (
            <MainLayout>
                <div className="flex-center w-full h-full" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>👋</span>
                        <h2>Welcome to StackNote</h2>
                        <p>Select a page from the sidebar or create a new one to get started.</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 4rem' }}>
                {/* Cover / Icon Area (Placeholder) */}
                <div style={{ height: '100px', marginBottom: '2rem', display: 'flex', alignItems: 'end' }}>
                    <span style={{ fontSize: '4rem' }}>{currentPage.icon || '📄'}</span>
                </div>

                {/* Title Input */}
                <input
                    type="text"
                    value={currentPage.title}
                    onChange={(e) => updatePageTitle(currentPage.id, e.target.value)}
                    placeholder="Untitled"
                    style={{
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        marginBottom: '1.5rem'
                    }}
                />

                {/* Block Editor */}
                <div style={{ minHeight: '300px', width: '100%' }}>
                    <BlockEditor key={currentPage.id} pageId={currentPage.id} />
                </div>
            </div>
        </MainLayout>
    );
};

export default WorkspaceView;
