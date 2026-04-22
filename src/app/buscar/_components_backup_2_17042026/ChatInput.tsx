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
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    return (
        <div className="px-3 pb-3 pt-2 flex-shrink-0">
            <div className="serenity-input-pill rounded-2xl px-3 py-2">
                <div className="flex items-end gap-2">
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
                                w-full resize-none rounded-xl border-0
                                bg-transparent px-3 py-2.5 text-sm text-on-surface
                                placeholder-on-surface-variant/50
                                focus:outline-none
                                disabled:opacity-50 disabled:cursor-not-allowed
                                transition-all duration-200
                            "
                        />
                        {value.length > 400 && (
                            <span className="absolute bottom-1 right-3 text-[10px] text-on-surface-variant/40">
                                {value.length}/500
                            </span>
                        )}
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim() || isLoading}
                        className={`
                            p-2.5 rounded-xl transition-all duration-300
                            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-surface-tint/30
                            ${value.trim() && !isLoading
                                ? 'bg-surface-tint text-white hover:bg-iris shadow-lg shadow-surface-tint/25 hover:-translate-y-0.5'
                                : 'bg-serenity-100 text-serenity-400 cursor-not-allowed'
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
        </div>
    );
}
