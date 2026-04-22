'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';

interface VoiceRecorderProps {
    onAudioCapture: (base64: string) => void;
    disabled?: boolean;
}

export default function VoiceRecorder({ onAudioCapture, disabled }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    if (base64) {
                        onAudioCapture(base64);
                    }
                };
                reader.readAsDataURL(blob);

                // Clean up the stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('[VoiceRecorder] Microphone access denied:', err);
        }
    }, [onAudioCapture]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled}
            className={`
                p-2.5 rounded-xl transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-1
                ${isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-300 animate-pulse'
                    : 'text-gray-400 hover:text-nido-600 hover:bg-nido-50 focus:ring-nido-300'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
            aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación de voz'}
        >
            {isRecording ? (
                <Square className="w-5 h-5" fill="currentColor" />
            ) : (
                <Mic className="w-5 h-5" />
            )}
        </button>
    );
}
