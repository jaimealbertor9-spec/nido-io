import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import LogTable from '@/components/admin/LogTable';

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LOGS PAGE - Protected Server Component
// Only accessible by admin email. Fetches system_logs via Service Role.
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = 'nidoio.app@gmail.com';

export const dynamic = 'force-dynamic'; // Always fetch fresh data

export default async function AdminLogsPage() {
    // ═══════════════════════════════════════════════════════════════
    // ACCESS CONTROL: Verify admin identity from session
    // ═══════════════════════════════════════════════════════════════
    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user || user.email !== ADMIN_EMAIL) {
        redirect('/');
    }

    // ═══════════════════════════════════════════════════════════════
    // FETCH LOGS: Use Service Role to read system_logs (RLS)
    // ═══════════════════════════════════════════════════════════════
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const { data: logs, error: fetchError } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    // ═══════════════════════════════════════════════════════════════
    // STATS: Quick summary
    // ═══════════════════════════════════════════════════════════════
    const allLogs = logs || [];
    const stats = {
        total: allLogs.length,
        critical: allLogs.filter(l => l.level === 'CRITICAL').length,
        errors: allLogs.filter(l => l.level === 'ERROR').length,
        warns: allLogs.filter(l => l.level === 'WARN').length,
        info: allLogs.filter(l => l.level === 'INFO').length,
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#e2e8f0',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}>
            {/* Header */}
            <header style={{
                padding: '24px 32px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <h1 style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: '#f8fafc',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}>
                        🔍 System Logs
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                        Últimos 100 eventos del sistema • {user.email}
                    </p>
                </div>

                <a
                    href="/admin/logs"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#94a3b8',
                        fontSize: '13px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.15s',
                    }}
                >
                    ↻ Actualizar
                </a>
            </header>

            {/* Stats Bar */}
            <div style={{
                display: 'flex',
                gap: '12px',
                padding: '20px 32px',
                flexWrap: 'wrap',
            }}>
                <StatCard label="Total" value={stats.total} color="#6366f1" />
                <StatCard label="Critical" value={stats.critical} color="#ec4899" />
                <StatCard label="Errors" value={stats.errors} color="#ef4444" />
                <StatCard label="Warnings" value={stats.warns} color="#f59e0b" />
                <StatCard label="Info" value={stats.info} color="#3b82f6" />
            </div>

            {/* Error State */}
            {fetchError && (
                <div style={{
                    margin: '0 32px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#fca5a5',
                    fontSize: '14px',
                }}>
                    ❌ Error al cargar logs: {fetchError.message}
                </div>
            )}

            {/* Log Table */}
            <div style={{
                margin: '0 32px 32px',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}>
                <LogTable logs={allLogs} />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Stat Card - Inline Sub-component
// ═══════════════════════════════════════════════════════════════
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{
            padding: '14px 22px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            minWidth: '120px',
        }}>
            <div style={{
                fontSize: '24px',
                fontWeight: 800,
                color: color,
                fontVariantNumeric: 'tabular-nums',
            }}>
                {value}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label}
            </div>
        </div>
    );
}
