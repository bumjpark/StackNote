import React from 'react';
import MainLayout from '../../layout/MainLayout';
import { useWorkspace } from '../../context/WorkspaceContext';
import BlockEditor from '../../components/BlockEditor';

const WorkspaceView: React.FC = () => {
    const { currentPage } = useWorkspace();

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
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 4rem' }}>
                {/* Block Editor */}
                <div style={{ minHeight: '300px', width: '100%' }}>
                    <BlockEditor key={currentPage.id} pageId={currentPage.id} />
                </div>
            </div>
        </MainLayout>
    );
};

export default WorkspaceView;
