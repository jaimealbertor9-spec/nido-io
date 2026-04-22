'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Loader2 } from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';

interface ChatInputProps {
    onSendMessage: (text: string) => void;
    onAudioCapture: (base64: string) => void;
    isLoading: boolean;
}

export default function ChatInput({ onSendMessage, onAudioCapture, isLoading }: ChatInputProps) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || isLoading) return;
        onSendMessage(trimmed);
        setValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, [value, isLoading, onSendMessage]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    return (
        /* Glass pill — matches Stitch design exactly */
        <div className="glass-panel rounded-full flex items-center p-2 ambient-shadow border border-white/30"
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>

            {/* Voice */}
            <div className="w-11 h-11 flex items-center justify-center">
                <VoiceRecorder onAudioCapture={onAudioCapture} disabled={isLoading} />
            </div>

            {/* Text */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                maxLength={500}
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none text-on-surface font-body px-4 py-2.5 text-sm placeholder:text-on-surface-variant/50 disabled:opacity-50"
            />

            {/* Send */}
            <button
                onClick={handleSubmit}
                disabled={!value.trim() || isLoading}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 mr-1 flex-shrink-0 ${
                    value.trim() && !isLoading
                        ? 'bg-on-surface text-white hover:bg-on-surface-variant'
                        : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
                }`}
                aria-label="Enviar"
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                )}
            </button>
        </div>
    );
}
