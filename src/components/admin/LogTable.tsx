'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LOG TABLE COMPONENT
// Client component for interactive log viewing with expandable metadata
// ═══════════════════════════════════════════════════════════════════════════════

type SystemLog = {
    id: string;
    created_at: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    source: string;
    message: string;
    metadata: Record<string, any> | null;
};

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    INFO: { bg: '#dbeafe', text: '#1e40af', label: 'INFO' },
    WARN: { bg: '#fef3c7', text: '#92400e', label: 'WARN' },
    ERROR: { bg: '#fee2e2', text: '#991b1b', label: 'ERROR' },
    CRITICAL: { bg: '#fce7f3', text: '#9d174d', label: 'CRITICAL' },
};

function formatDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LogTable({ logs }: { logs: SystemLog[] }) {
    if (logs.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#64748b',
                fontSize: '15px',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                <p style={{ fontWeight: 600 }}>No hay logs registrados</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Los eventos aparecerán aquí cuando ocurran.</p>
            </div>
        );
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
            }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Nivel</th>
                        <th style={thStyle}>Origen</th>
                        <th style={{ ...thStyle, minWidth: '300px' }}>Mensaje</th>
                        <th style={thStyle}>Metadata</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => {
                        const level = LEVEL_STYLES[log.level] || LEVEL_STYLES.INFO;

                        return (
                            <tr
                                key={log.id}
                                style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {/* Date */}
                                <td style={tdStyle}>
                                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: '#64748b', fontSize: '13px' }}>
                                        {formatDate(log.created_at)}
                                    </span>
                                </td>

                                {/* Level Badge */}
                                <td style={tdStyle}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        letterSpacing: '0.5px',
                                        background: level.bg,
                                        color: level.text,
                                    }}>
                                        {level.label}
                                    </span>
                                </td>

                                {/* Source */}
                                <td style={tdStyle}>
                                    <code style={{
                                        fontSize: '12px',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        fontFamily: 'monospace',
                                    }}>
                                        {log.source}
                                    </code>
                                </td>

                                {/* Message */}
                                <td style={{ ...tdStyle, color: '#1e293b', fontWeight: 500 }}>
                                    {log.message}
                                </td>

                                {/* Metadata */}
                                <td style={tdStyle}>
                                    {log.metadata ? (
                                        <details style={{ cursor: 'pointer' }}>
                                            <summary style={{
                                                fontSize: '12px',
                                                color: '#6366f1',
                                                fontWeight: 600,
                                                userSelect: 'none',
                                            }}>
                                                Ver datos
                                            </summary>
                                            <pre style={{
                                                marginTop: '8px',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                background: '#0f172a',
                                                color: '#e2e8f0',
                                                fontSize: '11px',
                                                fontFamily: 'monospace',
                                                overflow: 'auto',
                                                maxWidth: '400px',
                                                maxHeight: '200px',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-all',
                                            }}>
                                                {JSON.stringify(log.metadata, null, 2)}
                                            </pre>
                                        </details>
                                    ) : (
                                        <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// Shared cell styles
const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    verticalAlign: 'top',
};
