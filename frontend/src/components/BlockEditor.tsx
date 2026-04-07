import React, { useEffect, useRef } from "react";

import "@blocknote/mantine/style.css";
import { useCreateBlockNote, getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { type Block, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import api from "../api/client";
import { SmallCalendarBlock } from "./CalendarBlock";
import { LargeCalendarBlock } from "./LargeCalendarBlock";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

// --- User Color Generator ---
// VoiceChat (음성 채팅) 내의 아바타 프로필 색상과 동일한 로직 사용
const getUserColor = (userId: string) => {
    const pastelColors = [
        "#FFADAD", "#FFD6A5", "#FDFFB6", "#CAFFBF",
        "#9BF6FF", "#A0C4FF", "#BDB2FF", "#FFC6FF"
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return pastelColors[Math.abs(hash) % pastelColors.length];
};

// Create custom schema with Calendar blocks
const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        small_calendar: SmallCalendarBlock(),
        large_calendar: LargeCalendarBlock(),
    },
});

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
    const [blocks, setBlocks] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    // Auto-save status: 'saved' | 'saving' | 'dirty'
    const [saveStatus, setSaveStatus] = React.useState<'saved' | 'saving' | 'dirty'>('saved');

    // User info for Collaboration (Cursors, Presence)
    const userInfo = React.useMemo(() => {
        const name = localStorage.getItem('user_nickname') ||
            localStorage.getItem('user_email')?.split('@')[0] ||
            `Guest-${Math.floor(Math.random() * 1000)}`;
            
        const userId = localStorage.getItem('user_id') || name;
            
        return {
            name,
            color: getUserColor(userId)
        };
    }, []);

    // Hocuspocus Provider Setup
    const provider = React.useMemo(() => {
        if (!pageId) return undefined;

        const doc = new Y.Doc();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const newProvider = new HocuspocusProvider({
            url: `${protocol}//${window.location.host}/collaboration`,
            name: `document-${pageId}`,
            document: doc,
        });

        // Set awareness (cursor name and color)
        newProvider.setAwarenessField("user", userInfo);

        return newProvider;
    }, [pageId, userInfo]);

    // Track sync status
    const [isSynced, setIsSynced] = React.useState(false);

    useEffect(() => {
        if (!provider) return;

        // If already synced, set it immediately
        if (provider.isSynced) {
            setIsSynced(true);
        }

        const handleSynced = () => setIsSynced(true);
        provider.on('synced', handleSynced);

        return () => {
            provider.off('synced', handleSynced);
        }
    }, [provider]);

    // Creates a new editor instance.
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useCreateBlockNote({
        schema,
        collaboration: provider ? {
            provider,
            fragment: provider.document.getXmlFragment("document-store"),
            user: userInfo,
        } : undefined,
        uploadFile: async (file: File) => {
            const body = new FormData();
            body.append('file', file);
            try {
                const response = await api.post('/pages/upload', body, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                return response.data.url;
            } catch (error) {
                console.error("Image upload failed", error);
                throw error;
            }
        }
    });

    // Handle items for suggestion menu
    const getSlashMenuItems = async (query: string) => {
        const defaultItems = await getDefaultReactSlashMenuItems(editor);
        const filteredDefaults = defaultItems.filter(item =>
            item.title !== "Image" && item.title !== "이미지"
        );

        const myCustomItems = [
            {
                title: "Small Calendar",
                onItemClick: () => {
                    editor.insertBlocks(
                        [{ type: "small_calendar" }],
                        editor.getTextCursorPosition().block,
                        "after"
                    );
                },
                aliases: ["calendar", "cal", "todo", "schedule", "date", "캘린더", "일정", "할일", "작은"],
                group: "Planner",
                icon: "📅",
                subtext: "클릭 시 일정이 나타나는 미니 캘린더를 삽입합니다."
            },
            {
                title: "Large Calendar",
                onItemClick: () => {
                    editor.insertBlocks(
                        [{ type: "large_calendar" }],
                        editor.getTextCursorPosition().block,
                        "after"
                    );
                },
                aliases: ["large calendar", "cal", "todo", "schedule", "date", "캘린더", "대형", "일정", "할일", "큰"],
                group: "Planner",
                icon: "🗓️",
                subtext: "한눈에 일정을 파악할 수 있는 대형 캘린더를 삽입합니다."
            },
            {
                title: "Upload Image",
                onItemClick: () => {
                    fileInputRef.current?.click();
                },
                aliases: ["image", "img", "picture", "이미지", "사진", "업로드"],
                group: "Media",
                icon: "🖼️",
                subtext: "컴퓨터에서 이미지를 선택하여 업로드합니다."
            }
        ];

        const allItems = [...myCustomItems, ...filteredDefaults];
        const queryLower = query.toLowerCase();

        return allItems.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(queryLower);
            const aliasMatch = item.aliases?.some(alias =>
                alias.toLowerCase().includes(queryLower)
            );
            const groupMatch = item.group?.toLowerCase().includes(queryLower);
            return titleMatch || aliasMatch || groupMatch;
        });
    };

    // Ref to prevent save loop during fetch
    const isFetchingRef = useRef<boolean>(false);

    // Fetch initial blocks from backend
    const fetchBlocks = React.useCallback(async () => {
        if (!pageId || !editor || !isSynced) return;

        setIsLoading(true);
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

                // With Collaboration, we only load from DB if the document is completely empty
                // Otherwise, we rely on the Hocuspocus server state.
                const isDocumentEmpty = editor.document.length === 1 &&
                    editor.document[0].type === "paragraph" &&
                    (!editor.document[0].content || editor.document[0].content.length === 0);

                if (isDocumentEmpty && JSON.stringify(initialBlocks) !== JSON.stringify(editor.document)) {
                    editor.replaceBlocks(editor.document, initialBlocks);
                    setBlocks(initialBlocks);
                }
            }
        } catch (error) {
            console.error("Failed to fetch blocks", error);
        } finally {
            setTimeout(() => {
                isFetchingRef.current = false;
            }, 50);
            setIsLoading(false);
            setSaveStatus('saved');
        }
    }, [pageId, editor, isSynced]);

    // Fetch once Yjs is synced
    useEffect(() => {
        if (isSynced) {
            fetchBlocks();
        }
    }, [isSynced, fetchBlocks]);


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
                
                /* data-level 선택자 + 실제 h1 태그 + .bn-heading 클래스까지 통합하여 스타일 강제 적용 */
                .bn-block-content[data-content-type="heading"][data-level="1"],
                .bn-block-content[data-content-type="heading"] h1,
                .bn-heading[data-level="1"] {
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
                theme="dark"
                slashMenu={false}
                onChange={() => {
                    if (!isFetchingRef.current) {
                        setBlocks(editor.document);
                        setSaveStatus('dirty');
                    }
                }}
            >
                <SuggestionMenuController
                    triggerCharacter="/"
                    getItems={getSlashMenuItems}
                    onItemClick={(item: any) => {
                        item.onItemClick?.(editor);
                    }}
                    suggestionMenuComponent={(props: any) => (
                        <div style={{
                            background: '#25262B',
                            border: '1px solid #373A40',
                            borderRadius: '8px',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            minWidth: '240px',
                            maxHeight: '350px',
                            overflowY: 'auto',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)'
                        }}>
                            {props.items.map((item: any, index: number) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        background: index === props.selectedIndex ? 'rgba(35, 131, 226, 0.28)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'background-color 0.1s ease-in-out'
                                    }}
                                    onClick={() => props.onItemClick?.(item)}
                                >
                                    <span style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', color: '#c1c2c5' }}>
                                        {item.icon}
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <span style={{ fontWeight: 500, fontSize: '14px', color: '#C1C2C5' }}>{item.title}</span>
                                        {item.subtext && <span style={{ fontSize: '12px', color: '#909296', marginTop: '2px', lineHeight: 1.3 }}>{item.subtext}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                />
            </BlockNoteView>
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
                                    } as any],
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
