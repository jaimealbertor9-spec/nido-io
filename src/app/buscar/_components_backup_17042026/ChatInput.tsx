'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
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
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [value, isLoading, onSendMessage]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        // Auto-expand textarea
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    return (
        <div className="border-t border-gray-100 bg-white/80 backdrop-blur-xl p-3 md:p-4">
            <div className="flex items-end gap-2 max-w-2xl mx-auto">
                {/* Voice Button */}
                <VoiceRecorder
                    onAudioCapture={onAudioCapture}
                    disabled={isLoading}
                />

                {/* Text Input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe tu hogar ideal..."
                        maxLength={500}
                        rows={1}
                        disabled={isLoading}
                        className="
                            w-full resize-none rounded-2xl border border-gray-200
                            bg-gray-50 px-4 py-3 pr-12 text-sm text-gray-800
                            placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-nido-300 focus:border-nido-300
                            focus:bg-white
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all duration-200
                        "
                    />
                    {/* Character count */}
                    {value.length > 400 && (
                        <span className="absolute bottom-1.5 right-14 text-[10px] text-gray-300">
                            {value.length}/500
                        </span>
                    )}
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!value.trim() || isLoading}
                    className={`
                        p-2.5 rounded-xl transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-nido-300
                        ${value.trim() && !isLoading
                            ? 'bg-nido-700 text-white hover:bg-nido-600 shadow-lg shadow-nido-700/25 hover:-translate-y-0.5'
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        }
                    `}
                    aria-label="Enviar mensaje"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </div>
        </div>
    );
}
