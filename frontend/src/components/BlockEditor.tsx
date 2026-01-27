import React, { useEffect, useRef } from "react";

import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { type Block } from "@blocknote/core";
import api from "../api/client";

interface BlockEditorProps {
    pageId: string;
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ pageId }) => {
    // Stores the current blocks in the editor
    const [blocks, setBlocks] = React.useState<Block[]>([]);
    const [initialContent] = React.useState<Block[] | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    // Auto-save status: 'saved' | 'saving' | 'dirty'
    const [saveStatus, setSaveStatus] = React.useState<'saved' | 'saving' | 'dirty'>('saved');

    // Creates a new editor instance.
    const editor = useCreateBlockNote({
        initialContent: initialContent,
    });

    // Fetch initial blocks from backend
    // Fetch logic extracted for re-use
    const fetchBlocks = React.useCallback(async (isPolling = false) => {
        if (!pageId || !editor) return;

        // Skip polling if we have unsaved changes to prevent overwriting
        // or if we are currently editing (a primitive check could be saveStatus !== 'saved')
        if (isPolling && saveStatusRef.current !== 'saved') {
            return;
        }

        // If not polling (initial load), show loading
        if (!isPolling) setIsLoading(true);

        try {
            const response = await api.get(`/pages/${pageId}/blocks`);
            const dbBlocks = response.data;

            if (dbBlocks && dbBlocks.length > 0) {
                // Map and reconstruct... (Reuse existing logic or abstract it)
                // For now, duplicating the reconstruction logic here to keep it self-contained
                // ideally this should be a helper function outside component
                const reconstruct = (flat: any[]): Block[] => {
                    const blockMap = new Map<string, any>();
                    flat.forEach((b) => blockMap.set(b.id, { ...b }));
                    const rootBlocks = flat.filter(b => !b.parent_id);
                    const sortNodes = (nodes: any[]) => {
                        const sorted: any[] = [];
                        let current = nodes.find(n => !n.prev_block_id);
                        if (!current && nodes.length > 0) current = nodes[0];
                        const visited = new Set();
                        while (current && !visited.has(current.id)) {
                            visited.add(current.id);
                            sorted.push(current);
                            const nextId = current.next_block_id;
                            current = nodes.find(n => n.id === nextId);
                        }
                        nodes.forEach(n => { if (!visited.has(n.id)) sorted.push(n); });
                        return sorted;
                    };
                    const buildTree = (nodes: any[]): Block[] => {
                        return nodes.map(n => ({
                            id: n.id,
                            type: n.type,
                            props: n.props,
                            content: n.content,
                            children: buildTree((n.children_ids || [])
                                .map((cid: string) => blockMap.get(cid))
                                .filter((c: any) => c !== undefined))
                        } as Block));
                    };
                    return buildTree(sortNodes(rootBlocks));
                };

                const initialBlocks = reconstruct(dbBlocks);

                // Deep comparison to avoid unnecessary re-renders or cursor jumps
                if (JSON.stringify(initialBlocks) !== JSON.stringify(editor.document)) {
                    editor.replaceBlocks(editor.document, initialBlocks);
                    if (!isPolling) setBlocks(initialBlocks); // Sync local state only on fresh load
                }
            }
        } catch (error) {
            console.error("Failed to fetch blocks", error);
        } finally {
            if (!isPolling) setIsLoading(false);
            if (!isPolling) setSaveStatus('saved');
        }
    }, [pageId, editor]);

    // Initial Fetch
    useEffect(() => {
        fetchBlocks(false);
    }, [fetchBlocks]);

    // Polling Effect
    useEffect(() => {
        const interval = setInterval(() => {
            fetchBlocks(true);
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [fetchBlocks]);


    // Save logic
    const saveBlocks = async (newBlocks: Block[]) => {
        if (newBlocks.length === 0) return;
        setSaveStatus('saving');
        try {
            // Transform BlockNote blocks to our DB format (Recursive flattening)
            const flatten = (blocks: Block[], parentId: string | null = null): any[] => {
                let flat: any[] = [];
                blocks.forEach((block, i) => {
                    const prev = i > 0 ? blocks[i - 1].id : null;
                    const next = i < blocks.length - 1 ? blocks[i + 1].id : null;

                    flat.push({
                        id: block.id,
                        type: block.type,
                        props: block.props,
                        content: block.content,
                        children_ids: block.children.map((c: Block) => c.id),
                        parent_id: parentId,
                        prev_block_id: prev,
                        next_block_id: next
                    });

                    if (block.children && block.children.length > 0) {
                        flat = flat.concat(flatten(block.children, block.id));
                    }
                });
                return flat;
            };

            const backendBlocks = flatten(newBlocks);

            await api.post(`/pages/${pageId}/blocks`, { blocks: backendBlocks });
            setSaveStatus('saved');
            console.log("Saved blocks automatically (Hierarchical)");
        } catch (error) {
            setSaveStatus('dirty');
            console.error("Failed to save blocks", error);
        }
    };

    // Ref to store latest blocks for unmount saving and status check
    const blocksRef = useRef<Block[]>([]);
    const saveStatusRef = useRef<'saved' | 'saving' | 'dirty' | 'loading'>('saved');

    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);

    useEffect(() => {
        saveStatusRef.current = saveStatus;
    }, [saveStatus]);

    // Save on unmount
    useEffect(() => {
        return () => {
            if (saveStatusRef.current !== 'saved' && blocksRef.current.length > 0) {
                saveBlocks(blocksRef.current);
            }
        };
    }, []);

    // Prevent F5/Reload if not saved
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatusRef.current !== 'saved') {
                e.preventDefault();
                e.returnValue = ''; // Standard way to show "Changes may not be saved" dialog
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Auto-save: Trigger save when blocks change (debounced)
    const debouncedBlocks = useDebounce(blocks, 1000); // Wait 1 second of inactivity

    useEffect(() => {
        if (debouncedBlocks.length > 0 && saveStatus === 'dirty') {
            saveBlocks(debouncedBlocks);
        }
    }, [debouncedBlocks]);


    if (isLoading) {
        return <div>Loading editor...</div>;
    }

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            {/* Save Status Indicator */}
            <div style={{
                position: 'absolute',
                top: -25,
                right: 0,
                fontSize: '12px',
                color: saveStatus === 'saved' ? '#4CAF50' : saveStatus === 'saving' ? '#FFC107' : '#F44336',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                zIndex: 10
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: saveStatus === 'saved' ? '#4CAF50' : saveStatus === 'saving' ? '#FFC107' : '#F44336'
                }} />
                {saveStatus === 'saved' ? 'Saved to Cloud' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved Changes'}
            </div>

            {/* Custom CSS to force transparency on internal BlockNote/Mantine elements */}
            <style>{`
                .mantine-Paper-root {
                    background-color: transparent !important;
                    box-shadow: none !important;
                    border: none !important;
                }
                .bn-editor {
                    background-color: transparent !important;
                    padding-inline: 0 !important;
                }
                .bn-block-content {
                    color: var(--text-primary) !important;
                }
                .bn-block-outer:hover .bn-side-menu {
                    opacity: 1;
                }
            `}</style>
            <BlockNoteView
                editor={editor}
                onChange={() => {
                    setBlocks(editor.document);
                    setSaveStatus('dirty');
                }}
                theme="dark"
                style={{
                    background: 'transparent',
                    color: 'var(--text-primary)'
                }}
            />
        </div>
    );
};

export default BlockEditor;
