import React, { useEffect } from 'react';
// import { io } from 'socket.io-client';

const ENABLE_VOICE = false; // Hidden feature flag

const VoiceManager: React.FC = () => {
    useEffect(() => {
        if (!ENABLE_VOICE) return;

        // TODO: Implement Voice Logic
        console.log('Voice Manager Initialized (Hidden)');

        // const socket = io('http://localhost:8000');
        // ...

        return () => {
            // Cleanup
        };
    }, []);

    if (!ENABLE_VOICE) return null;

    return (
        <div style={{ position: 'fixed', bottom: 10, right: 10, opacity: 0, pointerEvents: 'none' }}>
            {/* Hidden Voice Controls */}
            Voice Active
        </div>
    );
};

export default VoiceManager;
