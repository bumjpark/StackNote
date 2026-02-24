import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace, type VoiceParticipant } from '../../context/WorkspaceContext';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, MessageSquare, ChevronDown, PlusCircle, Gift, StickyNote, Smile, Link, Pin, Reply, Forward, Trash2, Pencil, MoreHorizontal, UploadCloud } from 'lucide-react';
import api from '../../api/client';

const ENABLE_VOICE = true;

interface PeerConnection {
    [key: string]: RTCPeerConnection;
}

interface PeerInfo {
    username: string;
    isSpeaking: boolean;
    isMuted: boolean;
    connectionStatus?: string;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
}

// Safe context resume helper
const safeResume = async (ctx: AudioContext) => {
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (err) {
            console.warn("Context resume failed:", err);
        }
    }
};

const VoiceManager: React.FC = () => {
    const {
        currentChannel,
        currentWorkspace,
        selectChannel,
        registerSendMessageHandler,
        getVoiceHistory,
        saveVoiceChat,
        deleteVoiceChat,
        setChannelParticipants
    } = useWorkspace();
    const [isConnected, setIsConnected] = useState(false);

    // 채팅 상태
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [showChat, setShowChat] = useState(true); // Default to true for full-height panel
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Store info about peers: { [userId]: { username, isSpeaking } }
    const [peersInfo, setPeersInfo] = useState<Record<string, PeerInfo>>({});

    // Local controls
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false); // Local speaking state

    // Refs
    const ws = useRef<WebSocket | null>(null);
    const localStream = useRef<MediaStream | null>(null);
    const peers = useRef<PeerConnection>({});
    const pendingCandidates = useRef<Record<string, RTCIceCandidate[]>>({}); // Queue for early candidates
    const audioContext = useRef<AudioContext | null>(null);
    const analysers = useRef<Record<string, AnalyserNode>>({}); // userId -> analyser (local is 'me')
    const gainNodes = useRef<Record<string, GainNode>>({}); // userId -> gain (volume/mute control - for visual analysis only if decoupled)
    const remoteAudioElements = useRef<Record<string, HTMLAudioElement>>({}); // userId -> audio element for playback
    const animationRef = useRef<number | null>(null);

    const myUserId = useRef<string>(localStorage.getItem('user_id') || `user-${Math.floor(Math.random() * 1000)}`).current;

    const memberNameMap = useMemo(() => {
        const map = new Map<string, string>();
        currentWorkspace?.members?.forEach(member => {
            map.set(String(member.id), member.name);
        });
        return map;
    }, [currentWorkspace]);

    const [myUsername, setMyUsername] = useState<string>(() => {
        return (
            localStorage.getItem('user_nickname') ||
            localStorage.getItem('user_email')?.split('@')[0] ||
            `User ${myUserId.substring(0, 4)}`
        );
    });

    useEffect(() => {
        const nameFromMembers = memberNameMap.get(String(myUserId));
        const nameFromStorage =
            localStorage.getItem('user_nickname') ||
            localStorage.getItem('user_email')?.split('@')[0];
        setMyUsername(nameFromMembers || nameFromStorage || `User ${myUserId.substring(0, 4)}`);
    }, [memberNameMap, myUserId]);

    // Helper to get consistent color from userId
    const getUserColor = (userId: string) => {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Use sin to scramble the hash into distinct R, G, B components
        const r = Math.floor(Math.abs(Math.sin(hash + 1) * 10000) % 256);
        const g = Math.floor(Math.abs(Math.sin(hash + 2) * 10000) % 256);
        const b = Math.floor(Math.abs(Math.sin(hash + 3) * 10000) % 256);

        return `rgb(${r}, ${g}, ${b})`;
    };

    const handleSendChat = async (content: string = chatInput) => {
        const text = content.trim();
        if (!text || !isConnected || !currentChannel) return;

        const timestamp = Date.now();
        const msgId = Math.random().toString(36).substring(2, 12); // DB String(10) 호환

        // 1. Signaling (Broadcast)
        sendSignal({
            type: 'chat',
            id: msgId,
            content: text,
            sender_user_id: myUserId,
            username: myUsername,
            timestamp: timestamp
        });

        // 2. UI 즉시 반영 (Optimistic Update)
        const myMsg: ChatMessage = {
            id: msgId,
            senderId: myUserId,
            senderName: myUsername,
            content: text,
            timestamp: timestamp
        };
        setChatMessages(prev => [...prev.slice(-49), myMsg]);

        if (content === chatInput) setChatInput('');

        // 3. 백엔드 DB 저장 (Persistence)
        await saveVoiceChat(currentChannel.id, text, msgId);
    };

    const connectWebSocket = () => {
        if (!currentChannel) return;
        const roomId = currentChannel.id;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}/${myUserId}`;

        console.log(`Connecting to Voice Server: ${wsUrl}`);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log("Connected to Voice Server");
            setIsConnected(true);
            // Join signal
            if (currentChannel) {
                // Initial identity
                ws.current?.send(JSON.stringify({
                    type: 'identify',
                    username: myUsername,
                    id: myUserId
                }));
            }
        };

        ws.current.onclose = (event) => {
            console.log(`[VoiceManager] WebSocket Disconnected: Code=${event.code}, Reason=${event.reason}`);
            setIsConnected(false);
            if (currentChannel) {
                setChannelParticipants(currentChannel.id, []);
            }
        };

        ws.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data.type, 'from:', data.sender_user_id || data.user_id);
            handleSignalMessage(data);
        };
    };


    useEffect(() => {
        if (!ENABLE_VOICE || !currentChannel) return;

        let isMounted = true;

        const initVoiceChat = async () => {
            // 1. Initialize Audio Context
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            audioContext.current = new AudioContextClass();
            console.log('AudioContext created, state:', audioContext.current.state);

            // Try to resume immediately
            if (audioContext.current.state === 'suspended') {
                audioContext.current.resume().catch(err => console.warn('Context resume failed on init:', err));
            }

            // 2. Get Local Stream
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

                if (!isMounted) {
                    // Clean up stream if unmounted during await
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStream.current = stream;
                console.log('Local microphone stream acquired');

                // Analyze local audio
                setupAudioAnalysis('me', stream, false);

                // 3. Connect WebSocket ONLY after stream is ready
                connectWebSocket();

                // 4. Load Chat History
                console.log('Fetching chat history for channel:', currentChannel.id);
                try {
                    const history = await getVoiceHistory(currentChannel.id);
                    if (!isMounted) return;

                    console.log(`Loaded ${history.length} history messages`);

                    const mappedHistory = history.map((h: any) => {
                        // Safe date parsing for Safari (MySQL space format -> ISO T format)
                        const dateStr = h.created_at ? String(h.created_at).replace(' ', 'T') : null;
                        const timestamp = dateStr ? new Date(dateStr).getTime() : Date.now();

                        return {
                            id: h.id,
                            senderId: String(h.user_id),
                            senderName: h.sender_name || `User ${String(h.user_id).substring(0, 4)}`,
                            content: h.chat_content,
                            timestamp: isNaN(timestamp) ? Date.now() : timestamp
                        };
                    });
                    setChatMessages(mappedHistory);
                } catch (hErr) {
                    console.error("Failed to fetch history", hErr);
                }

            } catch (err) {
                if (isMounted) {
                    console.error("Failed to get local stream", err);
                }
            }
        };

        // Cleanup previous state just in case
        cleanup();

        initVoiceChat();

        // Start animation loop
        const checkVolume = () => {
            if (analysers.current['me']) {
                const vol = getVolume(analysers.current['me']);
                setIsSpeaking(vol > 7);
            }

            Object.keys(peers.current).forEach(uid => {
                if (analysers.current[uid]) {
                    const vol = getVolume(analysers.current[uid]);
                    const speaking = vol > 7;
                    setPeersInfo(prev => {
                        if (!prev[uid]) return prev;
                        if (prev[uid].isSpeaking !== speaking) {
                            return { ...prev, [uid]: { ...prev[uid], isSpeaking: speaking } };
                        }
                        return prev;
                    });
                }
            });

            animationRef.current = requestAnimationFrame(checkVolume);
        };
        animationRef.current = requestAnimationFrame(checkVolume);

        return () => {
            isMounted = false;
            cleanup();
        };
    }, [currentChannel]);

    // Update global context when speaking state or peers change
    useEffect(() => {
        if (!currentChannel) return;

        const rawParticipants: VoiceParticipant[] = [
            { userId: myUserId, username: myUsername, isSpeaking: isSpeaking },
            ...Object.entries(peersInfo)
                .filter(([uid, info]) => {
                    if (uid === myUserId) return false;
                    // Filter out ghosts with broken connections
                    if (info.connectionStatus === 'disconnected' ||
                        info.connectionStatus === 'failed' ||
                        info.connectionStatus === 'closed') {
                        return false;
                    }
                    return true;
                })
                .map(([uid, info]) => ({
                    userId: uid,
                    username: memberNameMap.get(String(uid)) || info.username,
                    isSpeaking: info.isSpeaking
                }))
        ];

        // Deduplicate by username to prevent double display (e.g. ghost sessions)
        // If multiple users have the same name, we merge their speaking status
        const uniqueParticipants = rawParticipants.reduce((acc, current) => {
            const existingIndex = acc.findIndex(p => p.username === current.username);
            if (existingIndex >= 0) {
                // Merge speaking status
                acc[existingIndex].isSpeaking = acc[existingIndex].isSpeaking || current.isSpeaking;
                // Keep the existing one (usually 'me' or the first encountered)
            } else {
                acc.push(current);
            }
            return acc;
        }, [] as VoiceParticipant[]);

        setChannelParticipants(currentChannel.id, uniqueParticipants);
    }, [isSpeaking, peersInfo, currentChannel, myUserId, myUsername, setChannelParticipants]);

    // 채팅 자동 스크롤
    useEffect(() => {
        if (showChat) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, showChat]);

    // 시그널링 핸들러 등록
    useEffect(() => {
        if (isConnected) {
            registerSendMessageHandler((content: string) => {
                handleSendChat(content);
            });
        } else {
            registerSendMessageHandler(null);
        }
        return () => registerSendMessageHandler(null);
    }, [isConnected, registerSendMessageHandler, currentChannel]);

    useEffect(() => {
        // Handle Mute (Mic)
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(track => {
                track.enabled = !isMicMuted;
            });
        }
    }, [isMicMuted]);

    useEffect(() => {
        // Handle Deafen (Output Mute) via Audio Elements
        Object.values(remoteAudioElements.current).forEach(audio => {
            audio.muted = isDeafened;
        });

        // Also resume context if it was suspended (interaction trigger)
        if (audioContext.current) {
            safeResume(audioContext.current);
        }
    }, [isDeafened]);

    const getVolume = (analyser: AnalyserNode) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        return sum / dataArray.length;
    }

    // Drag and Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragOver) setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                alert("Please upload an image file.");
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                // Optimistic UI update or loading state could go here
                const response = await api.post('/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                const imageUrl = response.data.url;

                // Send image URL as chat message
                await handleSendChat(imageUrl);

            } catch (error) {
                console.error("Image upload failed", error);
                alert("Failed to upload image.");
            }
        }
    };

    const setupAudioAnalysis = (id: string, stream: MediaStream, connectToSpeakers: boolean) => {
        if (!audioContext.current || audioContext.current.state === 'closed') return;
        if (!stream || !stream.getAudioTracks().length) {
            console.warn(`[VoiceManager] Stream for ${id} has no audio tracks.`);
            return;
        }

        // Resume context if needed
        safeResume(audioContext.current);

        const source = audioContext.current.createMediaStreamSource(stream);
        const analyser = audioContext.current.createAnalyser();
        analyser.fftSize = 64;

        source.connect(analyser);

        if (connectToSpeakers) {
            // Use native Audio element for reliable playback
            // Use native Audio element for reliable playback
            if (!remoteAudioElements.current[id]) {
                console.log(`Creating new Audio element for ${id}`);
                const audio = new Audio();
                audio.autoplay = true; // Enable autoplay
                audio.srcObject = stream;
                audio.volume = 1.0;
                audio.muted = isDeafened; // Apply current deafen state

                const tryPlay = async () => {
                    try {
                        await audio.play();
                        console.log(`Audio playback started for ${id}`);
                    } catch (err) {
                        console.warn(`Autoplay prevented for ${id}, waiting for interaction`, err);
                    }
                };

                // Attempt play
                tryPlay();

                // Also resume AudioContext if suspended (often happens on re-entry without click)
                if (audioContext.current?.state === 'suspended') {
                    const resumeContext = () => {
                        audioContext.current?.resume().then(() => {
                            console.log("AudioContext resumed by user interaction");
                            tryPlay(); // Retry play
                        });
                        document.removeEventListener('click', resumeContext);
                        document.removeEventListener('keydown', resumeContext);
                    };
                    document.addEventListener('click', resumeContext);
                    document.addEventListener('keydown', resumeContext);
                }

                remoteAudioElements.current[id] = audio;
            } else {
                // Update existing if stream changed
                if (remoteAudioElements.current[id].srcObject !== stream) {
                    remoteAudioElements.current[id].srcObject = stream;
                    remoteAudioElements.current[id].play().catch(e => console.error("Audio playback update failed:", e));
                }
            }

            // For visualization, we still connect to analyser, but NOT to destination to avoid echo/double audio
            // The audio chain for visual is: source -> analyser (end)
            // The audio chain for hearing is: <Audio> element (managed above)

            // We don't need gainNodes for playback anymore, but if we wanted to visualize "post-gain" volume we could keep it.
            // For now, let's visualize the raw stream volume.
        }

        analysers.current[id] = analyser;
    }

    const cleanup = () => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
            localStream.current = null;
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        if (audioContext.current) {
            audioContext.current.close().catch(console.error);
            audioContext.current = null;
        }

        Object.values(peers.current).forEach(peer => peer.close());
        Object.values(remoteAudioElements.current).forEach(audio => {
            audio.pause();
            audio.srcObject = null;
            audio.remove(); // Reduce DOM clutter if appended
        });
        peers.current = {};
        pendingCandidates.current = {};
        remoteAudioElements.current = {};
        analysers.current = {};
        gainNodes.current = {};
        setIsConnected(false);
        setPeersInfo({});
    };

    const sendSignal = (data: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            try {
                ws.current.send(JSON.stringify(data));
            } catch (err) {
                console.warn("[VoiceManager] Failed to send signal:", err);
            }
        }
    };

    const handleSignalMessage = async (data: any) => {
        switch (data.type) {
            case 'chat':
                // 내 메시지는 이미 handleSendChat에서 넣었으므로 중복 방지 (id 등 비교 필요시)
                if (data.sender_user_id === myUserId) return;

                const resolvedSenderName =
                    memberNameMap.get(String(data.sender_user_id)) ||
                    data.username ||
                    'Unknown';
                setChatMessages(prev => [...prev.slice(-49), {
                    id: data.id || `msg-${Date.now()}-${Math.random()}`,
                    senderId: data.sender_user_id,
                    senderName: resolvedSenderName,
                    content: data.content,
                    timestamp: data.timestamp || Date.now()
                }]);
                break;
            case 'delete_chat':
                setChatMessages(prev => prev.filter(m => m.id !== data.id));
                break;
            case 'identify':
                if (String(data.sender_user_id) === String(myUserId)) return;
                const resolvedName =
                    memberNameMap.get(String(data.sender_user_id)) ||
                    data.username;
                setPeersInfo(prev => ({
                    ...prev,
                    [data.sender_user_id]: {
                        username: resolvedName,
                        isSpeaking: false,
                        isMuted: false,
                        connectionStatus: 'connected'
                    }
                }));
                // Handshake: If this was a request for identity exchange, reply back
                if (data.requestReply) {
                    console.log(`Replying to identity request from ${data.sender_user_id}`);
                    sendSignal({
                        type: 'identify',
                        username: myUsername,
                        target_user_id: data.sender_user_id,
                        requestReply: false // Don't ask them to reply again (infinite loop prevention)
                    });
                }
                break;

            case 'user_joined':
                if (String(data.user_id) === String(myUserId)) return;
                console.log(`User joined: ${data.user_id}`);
                sendSignal({
                    type: 'identify',
                    username: myUsername,
                    target_user_id: data.user_id,
                    requestReply: true // Ask the new user to identify themselves back
                });
                createPeerConnection(data.user_id, true);
                break;

            case 'user_left':
                console.log(`User left: ${data.user_id}`);
                setPeersInfo(prev => {
                    const next = { ...prev };
                    delete next[data.user_id];
                    return next;
                });
                if (peers.current[data.user_id]) {
                    peers.current[data.user_id].close();
                    delete peers.current[data.user_id];
                }
                if (analysers.current[data.user_id]) {
                    delete analysers.current[data.user_id];
                }
                if (gainNodes.current[data.user_id]) {
                    // Disconnect nodes to prevent memory leaks/AudioContext errors
                    try {
                        gainNodes.current[data.user_id].disconnect();
                    } catch (e) { console.warn("Failed to disconnect gain node", e); }
                    delete gainNodes.current[data.user_id];
                }
                if (remoteAudioElements.current[data.user_id]) {
                    remoteAudioElements.current[data.user_id].pause();
                    remoteAudioElements.current[data.user_id].srcObject = null;
                    delete remoteAudioElements.current[data.user_id];
                } break;

            case 'offer':
                await handleOffer(data);
                break;

            case 'answer':
                await handleAnswer(data);
                break;

            case 'ice-candidate':
                await handleCandidate(data);
                break;
        }
    };

    const createPeerConnection = async (targetUserId: string, isInitiator: boolean) => {
        if (peers.current[targetUserId]) {
            console.warn(`[VoiceManager] Closing existing peer for ${targetUserId} before new connection`);
            peers.current[targetUserId].close();
            delete peers.current[targetUserId];
        }

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peers.current[targetUserId] = peer;

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => peer.addTrack(track, localStream.current!));
        }

        peer.oniceconnectionstatechange = () => {
            console.log(`[ICE Status] ${targetUserId}: ${peer.iceConnectionState}`);
            setPeersInfo(prev => ({
                ...prev,
                [targetUserId]: {
                    ...prev[targetUserId],
                    connectionStatus: peer.iceConnectionState
                }
            }));
        };
        peer.onicegatheringstatechange = () => {
            console.log(`[ICE Gathering] ${targetUserId}: ${peer.iceGatheringState}`);
        };
        peer.onsignalingstatechange = () => {
            console.log(`[Signaling Status] ${targetUserId}: ${peer.signalingState}`);
        };

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                // console.log(`[ICE Candidate] Generated for ${targetUserId}`);
                sendSignal({ type: 'ice-candidate', candidate: event.candidate, target_user_id: targetUserId });
            }
        };

        peer.ontrack = (event) => {
            console.log(`[Track] Received remote track from ${targetUserId}`, event.streams[0]);
            try {
                if (event.streams && event.streams[0]) {
                    setupAudioAnalysis(targetUserId, event.streams[0], true);
                } else {
                    // Fallback: create stream from track
                    console.log(`[Track] Using fallback stream creation for ${targetUserId}`);
                    const inboundStream = new MediaStream([event.track]);
                    setupAudioAnalysis(targetUserId, inboundStream, true);
                }
            } catch (e) {
                console.error(`[Track Error] Error handling track from ${targetUserId}:`, e);
            }
        };

        if (isInitiator) {
            console.log(`[Signaling] Creating offer for ${targetUserId}`);
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: offer, target_user_id: targetUserId });
        }
    };

    const handleOffer = async (data: any) => {
        console.log(`[Signaling] Received offer from ${data.sender_user_id}`);

        // Clean up existing peer connection if any (Crucial for reconnection)
        if (peers.current[data.sender_user_id]) {
            console.warn(`[VoiceManager] Closing existing peer (Offer Handler) for ${data.sender_user_id}`);
            peers.current[data.sender_user_id].close();
            delete peers.current[data.sender_user_id];
        }

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peers.current[data.sender_user_id] = peer;

        peer.oniceconnectionstatechange = () => {
            console.log(`[ICE Status] ${data.sender_user_id}: ${peer.iceConnectionState}`);
            setPeersInfo(prev => ({
                ...prev,
                [data.sender_user_id]: {
                    ...prev[data.sender_user_id],
                    connectionStatus: peer.iceConnectionState
                }
            }));
        };
        peer.onicegatheringstatechange = () => {
            console.log(`[ICE Gathering] ${data.sender_user_id}: ${peer.iceGatheringState}`);
        };

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({ type: 'ice-candidate', candidate: event.candidate, target_user_id: data.sender_user_id });
            }
        };
        peer.ontrack = (event) => {
            console.log(`[Track] Received remote track from ${data.sender_user_id} (Answerer)`, event.streams[0]);
            setupAudioAnalysis(data.sender_user_id, event.streams[0], true);
        };

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => peer.addTrack(track, localStream.current!));
        }

        if ((peer.signalingState as string) === 'closed') return;
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if ((peer.signalingState as string) === 'closed') return;

        // Process queued candidates
        if (pendingCandidates.current[data.sender_user_id]) {
            console.log(`Processing ${pendingCandidates.current[data.sender_user_id].length} queued candidates for ${data.sender_user_id}`);
            for (const candidate of pendingCandidates.current[data.sender_user_id]) {
                if ((peer.signalingState as string) !== 'closed') {
                    await peer.addIceCandidate(candidate);
                }
            }
            delete pendingCandidates.current[data.sender_user_id];
        }

        const answer = await peer.createAnswer();
        if ((peer.signalingState as string) === 'closed') return;
        await peer.setLocalDescription(answer);

        sendSignal({ type: 'answer', sdp: answer, target_user_id: data.sender_user_id });
    };

    const handleAnswer = async (data: any) => {
        const peer = peers.current[data.sender_user_id];
        if (peer && (peer.signalingState as string) !== 'closed') {
            if ((peer.signalingState as string) === 'stable') {
                console.warn(`[Signaling] Received answer but state is already stable (ignored) for ${data.sender_user_id}`);
                return;
            }
            try {
                await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
            } catch (err) {
                console.error(`[Signaling] Error setting remote description for ${data.sender_user_id}:`, err);
                return;
            }
            if ((peer.signalingState as string) === 'closed') return;

            // Process queued candidates
            if (pendingCandidates.current[data.sender_user_id]) {
                console.log(`Processing ${pendingCandidates.current[data.sender_user_id].length} queued candidates for ${data.sender_user_id}`);
                for (const candidate of pendingCandidates.current[data.sender_user_id]) {
                    if ((peer.signalingState as string) !== 'closed') {
                        try {
                            await peer.addIceCandidate(candidate);
                        } catch (e) { console.warn("Failed to add queued candidate", e); }
                    }
                }
                delete pendingCandidates.current[data.sender_user_id];
            }
        }
    };

    const handleCandidate = async (data: any) => {
        const peer = peers.current[data.sender_user_id];
        if (!data.candidate) return;

        const candidate = new RTCIceCandidate(data.candidate);

        if (peer && peer.remoteDescription && (peer.signalingState as string) !== 'closed') {
            try {
                await peer.addIceCandidate(candidate);
            } catch (e) {
                console.warn("Failed to add ICE candidate:", e);
            }
        } else {
            // Queue candidate if peer doesn't exist or remote description not set
            console.log(`Queueing ICE candidate for ${data.sender_user_id} (not ready)`);
            if (!pendingCandidates.current[data.sender_user_id]) {
                pendingCandidates.current[data.sender_user_id] = [];
            }
            pendingCandidates.current[data.sender_user_id].push(candidate);
        }
    };

    const handleDeleteChat = async (chatId: string) => {
        // Optimistic UI update
        setChatMessages(prev => prev.filter(m => m.id !== chatId));

        // Signal other peers
        sendSignal({
            type: 'delete_chat',
            id: chatId
        });

        // Persist deletion (API)
        await deleteVoiceChat(chatId);
    };

    const handleDisconnect = () => {
        selectChannel('');
    };

    if (!ENABLE_VOICE || !currentChannel) return null;

    return (
        <div style={{
            height: '100%',
            width: '100%',
            background: 'transparent',
            color: '#dbdee1', fontSize: '0.9rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* 상단 헤더: 디스코드 스타일 */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(43, 45, 49, 0.6)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#f2f3f5' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: isConnected ? '#23a55a' : '#f0b232',
                        boxShadow: isConnected ? '0 0 8px #23a55a' : 'none'
                    }} />
                    <span style={{ fontSize: '0.95rem' }}>{currentChannel.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', color: '#b5bac1' }}>
                    <Volume2 size={18} style={{ cursor: 'pointer' }} />
                    <MessageSquare size={18} style={{ cursor: 'pointer', color: showChat ? '#5865f2' : 'inherit' }} onClick={() => setShowChat(!showChat)} />
                </div>
            </div>

            {/* 메인 콘텐츠 영역 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '0' }}>
                {/* 유저 리스트 제거됨 (사용자 요청) */}

                {/* 채팅 영역: 디스코드 스타일 메시지 레이아웃 */}
                {showChat && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '350px',
                        background: 'transparent',
                        position: 'relative', // For overlay positioning
                    }}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {/* Drag Overlay */}
                        {isDragOver && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.7)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 100,
                                borderRadius: '8px',
                                border: '2px dashed #5865f2',
                                color: '#f2f3f5'
                            }}>
                                <UploadCloud size={48} color="#5865f2" />
                                <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '1.2rem' }}>Drop to Upload</div>
                            </div>
                        )}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0' // Control spacing via margins for consistency
                        }}>
                            {/* Message Action Bar Definition (Re-usable CSS-based) */}
                            <style>{`
                                .message-row { position: relative; transition: background 0.1s; }
                                .message-row:hover { background: rgba(255, 255, 255, 0.02) !important; }
                                .message-actions {
                                    display: none;
                                    position: absolute;
                                    top: -16px;
                                    right: 16px;
                                    background: #2b2d31;
                                    border: 1px solid #1e1f22;
                                    border-radius: 4px;
                                    padding: 2px;
                                    z-index: 10;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                                    flex-direction: row;
                                    gap: 1px;
                                }
                                .message-row:hover .message-actions { display: flex; }
                                .action-item {
                                    padding: 6px;
                                    border-radius: 4px;
                                    color: #b5bac1;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                }
                                .action-item:hover { background: #35373c; color: #dbdee1; }
                                .action-item.delete:hover { background: #f23f43; color: #fff; }
                            `}</style>

                            {chatMessages.map((msg, index) => {
                                const prevMsg = chatMessages[index - 1];
                                const isCompact = prevMsg && prevMsg.senderId === msg.senderId && (msg.timestamp - prevMsg.timestamp < 300000);

                                if (isCompact) {
                                    return (
                                        <div key={msg.id} className="message-row" style={{ paddingLeft: '52px', paddingRight: '16px', marginBottom: '6px' }}>
                                            {/* Compact Action Bar */}
                                            <div className="message-actions">
                                                <div className="action-item"><Link size={16} /></div>
                                                <div className="action-item"><Pencil size={16} /></div>
                                                <div className="action-item"><Pin size={16} /></div>
                                                <div className="action-item"><MoreHorizontal size={16} /></div>
                                                <div className="action-item"><Smile size={16} /></div>
                                                <div className="action-item"><Reply size={16} /></div>
                                                <div className="action-item"><Forward size={16} /></div>
                                                <div className="action-item delete" onClick={() => handleDeleteChat(msg.id)}><Trash2 size={16} /></div>
                                            </div>

                                            <div style={{
                                                color: '#dbdee1',
                                                fontSize: '0.95rem',
                                                lineHeight: '1.4',
                                                wordBreak: 'break-word',
                                                background: 'rgba(0, 0, 0, 0.15)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                borderRadius: '8px',
                                                padding: '6px 12px',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}>
                                                {msg.content.startsWith('/uploads/') || msg.content.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                    <img
                                                        src={msg.content}
                                                        alt="Uploaded content"
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '300px',
                                                            borderRadius: '8px',
                                                            marginTop: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => window.open(msg.content, '_blank')}
                                                    />
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg.id} className="message-row" style={{ display: 'flex', flexDirection: 'column', marginBottom: '6px', paddingRight: '16px' }}>
                                        {/* Standard Action Bar */}
                                        <div className="message-actions" style={{ top: '0px' }}>
                                            <div className="action-item"><Link size={16} /></div>
                                            <div className="action-item"><Pencil size={16} /></div>
                                            <div className="action-item"><Pin size={16} /></div>
                                            <div className="action-item"><MoreHorizontal size={16} /></div>
                                            <div className="action-item"><Smile size={16} /></div>
                                            <div className="action-item"><Reply size={16} /></div>
                                            <div className="action-item"><Forward size={16} /></div>
                                            <div className="action-item delete" onClick={() => handleDeleteChat(msg.id)}><Trash2 size={16} /></div>
                                        </div>

                                        {/* 이름 및 시간 (박스 위, 아바타 옆으로 정렬) */}
                                        <div style={{ paddingLeft: '52px', marginBottom: '2px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <span style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '0.9rem' }}>{msg.senderName}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#949ba4' }}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* 아바타와 메시지 박스 (일직선 정렬) */}
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                            {/* 아바타 */}
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: getUserColor(msg.senderId),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, fontWeight: 'bold', color: 'white'
                                            }}>
                                                {msg.senderName.substring(0, 1).toUpperCase()}
                                            </div>

                                            {/* 메시지 박스 */}
                                            <div style={{
                                                flex: 1,
                                                background: 'rgba(0, 0, 0, 0.15)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                borderRadius: '0 12px 12px 12px',
                                                padding: '8px 14px',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}>
                                                <div style={{
                                                    color: '#dbdee1',
                                                    fontSize: '0.95rem',
                                                    lineHeight: '1.4',
                                                    wordBreak: 'break-word',
                                                }}>
                                                    {msg.content.startsWith('/uploads/') || msg.content.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                        <img
                                                            src={msg.content}
                                                            alt="Uploaded content"
                                                            style={{
                                                                maxWidth: '100%',
                                                                maxHeight: '300px',
                                                                borderRadius: '8px',
                                                                marginTop: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => window.open(msg.content, '_blank')}
                                                        />
                                                    ) : (
                                                        msg.content
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        {/* 디스코드 스타일 입력창 */}
                        <div style={{ padding: '0 16px 16px 16px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: '#383a40',
                                borderRadius: '8px',
                                padding: '0 12px',
                                gap: '12px'
                            }}>
                                <PlusCircle size={22} style={{ color: '#b5bac1', cursor: 'pointer' }} />
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                                    placeholder={`Message #${currentChannel.name}`}
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#dbdee1',
                                        padding: '11px 0',
                                        fontSize: '0.95rem',
                                        outline: 'none'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '10px', color: '#b5bac1' }}>
                                    <Gift size={20} style={{ cursor: 'pointer' }} />
                                    <StickyNote size={20} style={{ cursor: 'pointer' }} />
                                    <Smile size={20} style={{ cursor: 'pointer' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 하단 컨트롤 바: 디스코드 하단 느낌 */}
            <div style={{
                padding: '8px 16px',
                background: 'rgba(35, 36, 40, 0.9)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(0, 0, 0, 0.2)',
                position: 'relative', zIndex: 20
            }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setIsMicMuted(!isMicMuted)}
                        style={{
                            padding: '8px', borderRadius: '4px',
                            background: isMicMuted ? 'rgba(242, 63, 67, 0.2)' : 'transparent',
                            border: 'none', cursor: 'pointer', color: isMicMuted ? '#f23f43' : '#dbdee1',
                            transition: 'all 0.2s'
                        }}
                        className="control-btn"
                    >
                        {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button
                        onClick={() => setIsDeafened(!isDeafened)}
                        style={{
                            padding: '8px', borderRadius: '4px',
                            background: isDeafened ? 'rgba(242, 63, 67, 0.2)' : 'transparent',
                            border: 'none', cursor: 'pointer', color: isDeafened ? '#f23f43' : '#dbdee1',
                            transition: 'all 0.2s'
                        }}
                        className="control-btn"
                    >
                        {isDeafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setShowChat(!showChat)}
                        style={{
                            padding: '8px', borderRadius: '4px',
                            background: 'transparent',
                            border: 'none', cursor: 'pointer', color: '#dbdee1',
                        }}
                        className="control-btn"
                    >
                        <ChevronDown size={20} style={{ transform: showChat ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />
                    </button>
                    <button
                        onClick={handleDisconnect}
                        style={{
                            padding: '8px', borderRadius: '4px',
                            background: 'rgba(242, 63, 67, 0.1)',
                            border: 'none', cursor: 'pointer', color: '#f23f43',
                            transition: 'all 0.2s'
                        }}
                        className="disconnect-btn"
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>
                <style>{`
                    .control-btn:hover { background: rgba(255, 255, 255, 0.05) !important; color: #fff !important; }
                    .disconnect-btn:hover { background: #f23f43 !important; color: #fff !important; }
                `}</style>
            </div>
        </div>
    );
};

export default VoiceManager;
