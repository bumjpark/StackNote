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

    // Creates a new editor instance.
    const editor = useCreateBlockNote({
        initialContent: initialContent,
    });

    // Fetch initial blocks from backend
    useEffect(() => {
        const fetchBlocks = async () => {
            setIsLoading(true);
            try {
                const response = await api.get(`/pages/${pageId}/blocks`);
                // If we have blocks, format them for BlockNote
                if (response.data && response.data.length > 0) {
                    // Convert backend format to BlockNote format if needed
                    // For now assuming 1:1 mapping as we designed the DB that way
                    const dbBlocks = response.data;
                    // BlockNote expects certain structure. 
                    // IMPORTANT: If initialContent is set later, we need to use editor.replaceBlocks
                    if (editor) {
                        const parsedBlocks = dbBlocks.map((b: any) => ({
                            id: b.id,
                            type: b.type,
                            props: b.props,
                            content: b.content,
                            children: b.children_ids ? [] : undefined // Simplified: children handling requires recursive fetching or eager loading
                        }));
                        editor.replaceBlocks(editor.document, parsedBlocks);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch blocks", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBlocks();
    }, [pageId, editor]);


    // Save logic
    const saveBlocks = async (newBlocks: Block[]) => {
        try {
            // Transform BlockNote blocks to our DB format
            const backendBlocks = newBlocks.map(block => ({
                id: block.id,
                type: block.type,
                props: block.props,
                content: block.content, // BlockNote content structure
                children_ids: block.children.map(c => c.id), // Just IDs for DB flat storage
                prev_block_id: null, // TODO: Implement ordering logic
                next_block_id: null
            }));

            await api.post(`/pages/${pageId}/blocks`, { blocks: backendBlocks });
            console.log("Saved blocks automatically");
        } catch (error) {
            console.error("Failed to save blocks", error);
        }
    };

    // Ref to store latest blocks for unmount saving
    const blocksRef = useRef<Block[]>([]);

    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);

    // Save on unmount
    useEffect(() => {
        return () => {
            if (blocksRef.current.length > 0) {
                // Fire and forget save on unmount
                // Note: In strict mode, this might fire double.
                // For better reliability on tab close, use navigator.sendBeacon, but for SPA nav this works.
                console.log("Saving on unmount", blocksRef.current);
                saveBlocks(blocksRef.current);
            }
        };
    }, []);

    // Auto-save: Trigger save when blocks change (debounced)
    const debouncedBlocks = useDebounce(blocks, 2000); // Save after 2 seconds of inactivity

    useEffect(() => {
        if (debouncedBlocks.length > 0) {
            saveBlocks(debouncedBlocks);
        }
    }, [debouncedBlocks]);


    if (isLoading) {
        return <div>Loading editor...</div>;
    }

    return (
        <div style={{ width: '100%', position: 'relative' }}>
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
                /* Hide the default side menu trigger until hovered to be cleaner like Notion */
                .bn-side-menu {
                   /* opacity: 0; transition: opacity 0.2s; */
                }
                .bn-block-outer:hover .bn-side-menu {
                    opacity: 1;
                }
            `}</style>
            <BlockNoteView
                editor={editor}
                onChange={() => {
                    // Update state on every change
                    setBlocks(editor.document);
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
