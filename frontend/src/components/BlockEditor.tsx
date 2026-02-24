import React, { useEffect, useRef } from "react";

import "@blocknote/mantine/style.css";
import { useCreateBlockNote, getDefaultReactSlashMenuItems } from "@blocknote/react";
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useCreateBlockNote({
        initialContent: initialContent,
        uploadFile: async (file: File) => {
            const body = new FormData();
            body.append('file', file);
            try {
                const response = await api.post('/upload', body, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                return response.data.url;
            } catch (error) {
                console.error("Image upload failed", error);
                throw error;
            }
        },
        // Remove default image to replace with custom one
        slashMenuItems: async (_query: string) => {
            // Get default items
            const defaultItems = await getDefaultReactSlashMenuItems(editor);

            // Filter out default Image
            const filtered = defaultItems.filter(item => item.title !== "Image");

            // Add custom Image item
            const customImageItem = {
                title: "Image",
                onItemClick: () => {
                    fileInputRef.current?.click();
                },
                aliases: ["image", "img", "picture"],
                group: "Media",
                icon: <div style={{ fontSize: '1.2em' }}>🖼️</div>,
                subtext: "Upload an image from your computer"
            };

            return [customImageItem, ...filtered];
        }
    });

    // Ref to prevent save loop during fetch
    const isFetchingRef = useRef<boolean>(false);

    // Fetch initial blocks from backend
    const fetchBlocks = React.useCallback(async (isPolling = false) => {
        if (!pageId || !editor) return;

        // Skip polling if we have unsaved changes to prevent overwriting
        if (isPolling && saveStatusRef.current !== 'saved') {
            return;
        }

        if (!isPolling) setIsLoading(true);

        // Mark as fetching start
        isFetchingRef.current = true;

        try {
            const response = await api.get(`/pages/${pageId}/blocks`);
            const dbBlocks = response.data;

            if (dbBlocks && dbBlocks.length > 0) {
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
                            props: n.props || {},
                            content: n.content,
                            children: buildTree((n.children_ids || [])
                                .map((cid: string) => blockMap.get(cid))
                                .filter((c: any) => c !== undefined))
                        } as Block));
                    };
                    return buildTree(sortNodes(rootBlocks));
                };

                let initialBlocks = reconstruct(dbBlocks);

                const nestBlocksByHeaders = (blocks: Block[]): Block[] => {
                    const root: Block[] = [];
                    const stack: { block: any, level: number }[] = [];

                    blocks.forEach((block) => {
                        const b = { ...block, children: block.children ? [...block.children] : [] } as any;
                        let level = 99;
                        if (b.type === "heading") level = b.props?.level || 1;
                        if (b.type === "divider") level = 0;

                        // H1은 항상 루트에 배치 (H1 아래로 들여쓰기 방지)
                        if (level === 1) {
                            stack.length = 0; // 스택 비우기
                            root.push(b);
                            stack.push({ block: b, level: level });
                            return;
                        }

                        while (stack.length > 0) {
                            const parent = stack[stack.length - 1];
                            if (parent.level >= level && parent.level !== 99) {
                                stack.pop();
                            } else {
                                break;
                            }
                        }

                        if (stack.length > 0) {
                            const parentBlock = stack[stack.length - 1].block;
                            if (!parentBlock.children) parentBlock.children = [];
                            parentBlock.children.push(b);
                        } else {
                            root.push(b);
                        }

                        if (b.type === "heading") {
                            stack.push({ block: b, level: level });
                        }
                    });
                    return root;
                };

                try {
                    initialBlocks = nestBlocksByHeaders(initialBlocks);
                } catch (e) {
                    console.error("Nesting failed", e);
                }

                if (JSON.stringify(initialBlocks) !== JSON.stringify(editor.document)) {
                    editor.replaceBlocks(editor.document, initialBlocks);
                    if (!isPolling) setBlocks(initialBlocks);
                }
            }
        } catch (error) {
            console.error("Failed to fetch blocks", error);
        } finally {
            // Reset fetching status AFTER a slight delay to allow onChange to fire and be ignored
            setTimeout(() => {
                isFetchingRef.current = false;
            }, 50);

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
        }, 30000); // Poll every 30 seconds

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
                
                /* [Indent Line Removal] Remove the vertical line on nested blocks */
                .bn-block-outer::before {
                    border-left: none !important;
                }
                .bn-editor {
                    background-color: transparent !important;
                    padding-inline: 0 !important;
                    line-height: 1.65 !important;
                    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol" !important;
                }
                .bn-block-content {
                    color: #FFFFFF !important; /* 본문 완전 순백색 적용 (고대비) */
                    font-size: 16px !important;
                    font-weight: 400 !important;
                }
                
                /* 블록 간 수직 여백 확대 (노션 클론 핵심) */
                .bn-block-outer {
                    margin-top: 0.6rem !important;
                    margin-bottom: 0.6rem !important;
                }

                /* 헤딩 블록: 압도적인 위계 및 여백 (선택자 수정) */
                .bn-block-content[data-content-type="heading"] {
                    color: #FFFFFF !important;
                    letter-spacing: -0.012em !important;
                }
                
                /* data-level 선택자 + 실제 <h1> 태그 선택자 이중 적용 (BlockNote 테마 오버라이드 대응) */
                .bn-block-content[data-content-type="heading"][data-level="1"],
                .bn-block-content[data-content-type="heading"] h1 {
                    font-size: 2.5rem !important;
                    font-weight: 800 !important;
                    line-height: 1.2 !important;
                    margin-top: 3.5rem !important;
                    margin-bottom: 1rem !important;
                    color: #FFFFFF !important;
                }
                .bn-block-content[data-content-type="heading"][data-level="2"] {
                    font-size: 2rem !important;
                    font-weight: 700 !important;
                    line-height: 1.3 !important;
                    margin-top: 2.5rem !important;
                    margin-bottom: 0.8rem !important;
                }
                .bn-block-content[data-content-type="heading"][data-level="3"] {
                    font-size: 1.6rem !important;
                    font-weight: 700 !important;
                    line-height: 1.4 !important;
                    margin-top: 2rem !important;
                    margin-bottom: 0.6rem !important;
                }
                .bn-block-content[data-content-type="heading"][data-level="4"] {
                    font-size: 1.35rem !important;
                    font-weight: 600 !important;
                    margin-top: 1.5rem !important;
                    margin-bottom: 0.5rem !important;
                }
                .bn-block-content[data-content-type="heading"][data-level="5"] {
                    font-size: 1.15rem !important;
                    font-weight: 600 !important;
                    margin-top: 1.2rem !important;
                    margin-bottom: 0.4rem !important;
                }
                .bn-block-content[data-content-type="heading"][data-level="6"] {
                    font-size: 1rem !important;
                    font-weight: 600 !important;
                    margin-top: 1rem !important;
                    margin-bottom: 0.3rem !important;
                }

                /* 페이지 구분선 (Divider) 정밀 스타일링 (선택자 수정) */
                .bn-block-content[data-content-type="divider"] {
                    margin-top: 4.5rem !important;
                    margin-bottom: 4.5rem !important;
                    height: 1px !important;
                    background-color: rgba(255, 255, 255, 0.2) !important;
                    border: none !important;
                    width: 100% !important;
                }
                
                /* 문단 간 여백 */
                .bn-block-content[data-content-type="paragraph"] {
                    margin-bottom: 0.3rem !important;
                }

                /* 리스트 아이템 사이 간격 조정 */
                .bn-block-content[data-content-type*="ListItem"] {
                    margin-top: 0.2rem !important;
                    margin-bottom: 0.2rem !important;
                }

                .bn-block-outer:hover .bn-side-menu {
                    opacity: 1;
                }
                
                /* Selection */
                ::selection {
                    background: rgba(35, 131, 226, 0.28);
                }
            `}</style>
            <BlockNoteView
                editor={editor}
                onChange={() => {
                    if (!isFetchingRef.current) {
                        setBlocks(editor.document);
                        setSaveStatus('dirty');
                    }
                }}
                theme="dark"
                style={{
                    background: 'transparent',
                    color: 'var(--text-primary)'
                }}
            />
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        try {
                            if (!editor.uploadFile) {
                                throw new Error("Upload function not configured");
                            }
                            const url = await editor.uploadFile(file);
                            if (url) {
                                // Insert image block
                                editor.insertBlocks(
                                    [{
                                        type: "image",
                                        props: {
                                            url: url as string
                                        }
                                    }],
                                    editor.getTextCursorPosition().block,
                                    "after"
                                );
                            }
                        } catch (error) {
                            console.error("Failed to upload/insert image", error);
                            alert("Failed to upload image.");
                        } finally {
                            // Reset input
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }
                    }
                }}
            />
        </div>
    );
};

export default BlockEditor;
