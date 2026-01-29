import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';

const ENABLE_VOICE = true;

interface PeerConnection {
    [key: string]: RTCPeerConnection;
}

interface PeerInfo {
    username: string;
    isSpeaking: boolean;
    isMuted: boolean; // Local mute state tracking (for UI)
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
    const { currentChannel, selectChannel } = useWorkspace();
    const [isConnected, setIsConnected] = useState(false);

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

    const myUserId = useRef<string>(sessionStorage.getItem('user_id') || `user-${Math.floor(Math.random() * 1000)}`).current;
    // Create a unique session ID for this specific tab/connection to allow same-user testing
    const mySessionId = useRef<string>(`${myUserId}-${Math.random().toString(36).substr(2, 5)}`).current;

    // Attempt to get email, fallback to ID based name
    const myUsername = useRef<string>(
        sessionStorage.getItem('user_email') || `User ${myUserId.substring(0, 4)}`
    ).current;

    const connectWebSocket = () => {
        if (!currentChannel) return;
        const roomId = currentChannel.id;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}/${mySessionId}`;

        console.log(`Connecting to Voice Server: ${wsUrl}`);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = async () => {
            console.log("WebSocket Connected");
            setIsConnected(true);

            // Initial identify
            sendSignal({ type: 'identify', username: myUsername });
        };

        ws.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data.type, 'from:', data.sender_user_id || data.user_id);
            handleSignalMessage(data);
        };

        ws.current.onclose = () => {
            console.log("WebSocket Disconnected");
            setIsConnected(false);
            // cleanup is called by useEffect return
        };
    };

    useEffect(() => {
        if (!ENABLE_VOICE || !currentChannel) return;

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
                localStream.current = stream;
                console.log('Local microphone stream acquired');

                // Analyze local audio
                setupAudioAnalysis('me', stream, false);

                // 3. Connect WebSocket ONLY after stream is ready
                connectWebSocket();

            } catch (err) {
                console.error("Failed to get local stream", err);
                // Do not alert, just log. Alert might cause focus issues.
            }
        };

        initVoiceChat();

        // Start animation loop
        const checkVolume = () => {
            if (analysers.current['me']) {
                const vol = getVolume(analysers.current['me']);
                setIsSpeaking(vol > 10);
            }
            Object.keys(peers.current).forEach(uid => {
                if (analysers.current[uid]) {
                    const vol = getVolume(analysers.current[uid]);
                    const speaking = vol > 10;
                    setPeersInfo(prev => {
                        // Guard: If we have audio but no user info yet (identify signal pending), skip update
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
            cleanup();
        };
    }, [currentChannel]);

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
            if (!remoteAudioElements.current[id]) {
                console.log(`Creating new Audio element for ${id}`);
                const audio = new Audio();
                audio.srcObject = stream;
                audio.volume = 1.0;
                audio.muted = isDeafened; // Apply current deafen state
                audio.play().catch(e => console.error("Audio playback failed:", e));
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
        if (ws.current) ws.current.close();
        if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (audioContext.current) audioContext.current.close();

        Object.values(peers.current).forEach(peer => peer.close());
        Object.values(remoteAudioElements.current).forEach(audio => {
            audio.pause();
            audio.srcObject = null;
        });
        peers.current = {};
        remoteAudioElements.current = {};
        analysers.current = {};
        gainNodes.current = {};
        setIsConnected(false);
        setPeersInfo({});
    };

    const sendSignal = (data: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(data));
        }
    };

    const handleSignalMessage = async (data: any) => {
        switch (data.type) {
            case 'identify':
                setPeersInfo(prev => ({
                    ...prev,
                    [data.sender_user_id]: {
                        username: data.username,
                        isSpeaking: false,
                        isMuted: false
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
        if (peers.current[targetUserId]) return;

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peers.current[targetUserId] = peer;

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => peer.addTrack(track, localStream.current!));
        }

        peer.onicecandidate = (event) => {
            if (event.candidate) sendSignal({ type: 'ice-candidate', candidate: event.candidate, target_user_id: targetUserId });
        };

        peer.ontrack = (event) => {
            console.log(`Received remote track from ${targetUserId}`, event.streams[0]);
            try {
                if (event.streams && event.streams[0]) {
                    setupAudioAnalysis(targetUserId, event.streams[0], true);
                } else {
                    // Fallback: create stream from track
                    const inboundStream = new MediaStream([event.track]);
                    setupAudioAnalysis(targetUserId, inboundStream, true);
                }
            } catch (e) {
                console.error(`Error handling track from ${targetUserId}:`, e);
            }
        };

        if (isInitiator) {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: offer, target_user_id: targetUserId });
        }
    };

    const handleOffer = async (data: any) => {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peers.current[data.sender_user_id] = peer;

        peer.onicecandidate = (event) => {
            if (event.candidate) sendSignal({ type: 'ice-candidate', candidate: event.candidate, target_user_id: data.sender_user_id });
        };
        peer.ontrack = (event) => {
            setupAudioAnalysis(data.sender_user_id, event.streams[0], true);
        };

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => peer.addTrack(track, localStream.current!));
        }

        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));

        // Process queued candidates
        if (pendingCandidates.current[data.sender_user_id]) {
            console.log(`Processing ${pendingCandidates.current[data.sender_user_id].length} queued candidates for ${data.sender_user_id}`);
            for (const candidate of pendingCandidates.current[data.sender_user_id]) {
                await peer.addIceCandidate(candidate);
            }
            delete pendingCandidates.current[data.sender_user_id];
        }

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        sendSignal({ type: 'answer', sdp: answer, target_user_id: data.sender_user_id });
    };

    const handleAnswer = async (data: any) => {
        const peer = peers.current[data.sender_user_id];
        if (peer) {
            await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Process queued candidates
            if (pendingCandidates.current[data.sender_user_id]) {
                console.log(`Processing ${pendingCandidates.current[data.sender_user_id].length} queued candidates for ${data.sender_user_id}`);
                for (const candidate of pendingCandidates.current[data.sender_user_id]) {
                    await peer.addIceCandidate(candidate);
                }
                delete pendingCandidates.current[data.sender_user_id];
            }
        }
    };

    const handleCandidate = async (data: any) => {
        const peer = peers.current[data.sender_user_id];
        if (!data.candidate) return;

        const candidate = new RTCIceCandidate(data.candidate);

        if (peer && peer.remoteDescription) {
            await peer.addIceCandidate(candidate);
        } else {
            // Queue candidate if peer doesn't exist or remote description not set
            console.log(`Queueing ICE candidate for ${data.sender_user_id} (not ready)`);
            if (!pendingCandidates.current[data.sender_user_id]) {
                pendingCandidates.current[data.sender_user_id] = [];
            }
            pendingCandidates.current[data.sender_user_id].push(candidate);
        }
    };

    const handleDisconnect = () => {
        selectChannel('');
    };

    if (!ENABLE_VOICE || !currentChannel) return null;

    return (
        <div style={{
            position: 'fixed', bottom: 20, right: 20,
            background: '#2f3136',
            width: '280px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
            color: '#fff', fontSize: '0.9rem', zIndex: 100,
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', background: '#202225', borderBottom: '1px solid #202225', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                    <Volume2 size={16} color="#10b981" />
                    <span>{currentChannel.name}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: isConnected ? '#10b981' : '#f59e0b' }}>
                    {isConnected ? 'Connected' : 'Connecting...'}
                </div>
            </div>

            {/* User List */}
            <div style={{ padding: '8px 0', maxHeight: '200px', overflowY: 'auto' }}>
                {/* Me */}
                <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                        border: isSpeaking ? '2px solid #10b981' : '2px solid transparent',
                        transition: 'border 0.1s'
                    }}>
                        {myUsername.substring(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{myUsername} (Me)</div>
                        <div style={{ fontSize: '0.7rem', color: '#b9bbbe' }}>{isMicMuted ? 'Muted' : 'Online'}</div>
                    </div>
                    {isMicMuted && <MicOff size={14} color="#ef4444" />}
                </div>

                {/* Peers */}
                {Object.entries(peersInfo).map(([uid, info]) => (
                    <div key={uid} style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: '#3ba55c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                            border: info.isSpeaking ? '2px solid #10b981' : '2px solid transparent',
                            transition: 'border 0.1s'
                        }}>
                            {info.username.substring(0, 1).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{info.username}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div style={{ padding: '12px', background: '#292b2f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setIsMicMuted(!isMicMuted)}
                        style={{ padding: '8px', borderRadius: '4px', background: isMicMuted ? '#ed4245' : 'transparent', border: 'none', cursor: 'pointer', color: 'white' }}
                        className="hover:bg-white/10"
                        title={isMicMuted ? "Unmute" : "Mute"}
                    >
                        {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                        onClick={() => setIsDeafened(!isDeafened)}
                        style={{ padding: '8px', borderRadius: '4px', background: isDeafened ? '#ed4245' : 'transparent', border: 'none', cursor: 'pointer', color: 'white' }}
                        className="hover:bg-white/10"
                        title={isDeafened ? "Undeafen" : "Deafen"}
                    >
                        {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                </div>
                <button
                    onClick={handleDisconnect}
                    style={{ padding: '8px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ed4245' }}
                    className="hover:bg-red-500/10"
                    title="Disconnect"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );
};

export default VoiceManager;