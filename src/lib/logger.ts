'use server';

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// CENTRALIZED SYSTEM LOGGER
// Writes persistent logs to system_logs table via Service Role
// Also outputs to console for local dev visibility
// ═══════════════════════════════════════════════════════════════════════════════

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * Logs a system event to the database and console.
 * Uses Service Role to bypass RLS.
 * Wrapped in try/catch so logging failures NEVER crash the main app.
 */
export async function logSystemEvent(
    level: LogLevel,
    source: string,
    message: string,
    metadata?: Record<string, any>
): Promise<void> {
    // Always log to console for local dev and Vercel Logs
    const prefix = level === 'CRITICAL' ? '🚨' :
        level === 'ERROR' ? '❌' :
            level === 'WARN' ? '⚠️' : 'ℹ️';

    const consoleMsg = `[${source}] ${prefix} ${message}`;

    if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(consoleMsg, metadata ? JSON.stringify(metadata) : '');
    } else if (level === 'WARN') {
        console.warn(consoleMsg, metadata ? JSON.stringify(metadata) : '');
    } else {
        console.log(consoleMsg, metadata ? JSON.stringify(metadata) : '');
    }

    // Persist to database
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[LOGGER] Cannot persist log: Missing Supabase credentials');
            return;
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        });

        const { error } = await supabase
            .from('system_logs')
            .insert({
                level,
                source,
                message,
                metadata: metadata || null
            });

        if (error) {
            console.error('[LOGGER] Failed to persist log:', error.message);
        }
    } catch (err: any) {
        // NEVER let logging crash the main application
        console.error('[LOGGER] Unexpected error:', err.message);
    }
}
