import * as React from 'react';

interface WelcomeEmailProps {
    nombre: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ nombre }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nido.io';

    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Bienvenido a Nido</title>
            </head>
            <body style={{
                margin: 0,
                padding: 0,
                backgroundColor: '#f4f4f5',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}>
                <table
                    role="presentation"
                    width="100%"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ backgroundColor: '#f4f4f5', padding: '40px 20px' }}
                >
                    <tr>
                        <td align="center">
                            <table
                                role="presentation"
                                width="100%"
                                cellPadding={0}
                                cellSpacing={0}
                                style={{
                                    maxWidth: '520px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Header with Logo */}
                                <tr>
                                    <td style={{
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        padding: '40px',
                                        textAlign: 'center' as const,
                                    }}>
                                        <h1 style={{
                                            margin: 0,
                                            fontSize: '36px',
                                            fontWeight: 700,
                                            color: '#ffffff',
                                            letterSpacing: '-0.5px',
                                        }}>
                                            Nido
                                        </h1>
                                        <p style={{
                                            margin: '8px 0 0',
                                            fontSize: '14px',
                                            color: 'rgba(255, 255, 255, 0.85)',
                                            fontWeight: 500,
                                        }}>
                                            Tu hogar te espera
                                        </p>
                                    </td>
                                </tr>

                                {/* Welcome Icon */}
                                <tr>
                                    <td style={{ padding: '40px 40px 24px', textAlign: 'center' as const }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '8px',
                                        }}>
                                            <span style={{ fontSize: '40px', lineHeight: 1 }}>🏡</span>
                                        </div>
                                    </td>
                                </tr>

                                {/* Title */}
                                <tr>
                                    <td style={{ padding: '0 40px 16px', textAlign: 'center' as const }}>
                                        <h2 style={{
                                            margin: 0,
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            color: '#18181b',
                                            letterSpacing: '-0.5px',
                                        }}>
                                            ¡Bienvenido, {nombre}!
                                        </h2>
                                    </td>
                                </tr>

                                {/* Body */}
                                <tr>
                                    <td style={{ padding: '0 40px 32px' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '16px',
                                            lineHeight: '26px',
                                            color: '#52525b',
                                            textAlign: 'center' as const,
                                        }}>
                                            Gracias por unirte a la plataforma inmobiliaria más segura de Colombia.
                                            En <strong style={{ color: '#6366f1' }}>Nido</strong> puedes publicar tu
                                            inmueble y conectar con compradores e inquilinos verificados.
                                        </p>
                                    </td>
                                </tr>

                                {/* Benefits List */}
                                <tr>
                                    <td style={{ padding: '0 40px 32px' }}>
                                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                            <tr>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    backgroundColor: '#f8fafc',
                                                    borderRadius: '12px',
                                                    marginBottom: '8px',
                                                }}>
                                                    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                                        <tr>
                                                            <td style={{ width: '32px', verticalAlign: 'top' }}>
                                                                <span style={{ fontSize: '20px' }}>✅</span>
                                                            </td>
                                                            <td style={{ fontSize: '14px', color: '#52525b', lineHeight: '22px' }}>
                                                                <strong style={{ color: '#18181b' }}>Publicación verificada</strong><br />
                                                                Todos los anuncios pasan por revisión
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr><td style={{ height: '8px' }}></td></tr>
                                            <tr>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    backgroundColor: '#f8fafc',
                                                    borderRadius: '12px',
                                                }}>
                                                    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                                        <tr>
                                                            <td style={{ width: '32px', verticalAlign: 'top' }}>
                                                                <span style={{ fontSize: '20px' }}>🔒</span>
                                                            </td>
                                                            <td style={{ fontSize: '14px', color: '#52525b', lineHeight: '22px' }}>
                                                                <strong style={{ color: '#18181b' }}>Transacciones seguras</strong><br />
                                                                Pagos protegidos con Wompi
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr><td style={{ height: '8px' }}></td></tr>
                                            <tr>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    backgroundColor: '#f8fafc',
                                                    borderRadius: '12px',
                                                }}>
                                                    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                                        <tr>
                                                            <td style={{ width: '32px', verticalAlign: 'top' }}>
                                                                <span style={{ fontSize: '20px' }}>📊</span>
                                                            </td>
                                                            <td style={{ fontSize: '14px', color: '#52525b', lineHeight: '22px' }}>
                                                                <strong style={{ color: '#18181b' }}>Dashboard completo</strong><br />
                                                                Gestiona tus inmuebles fácilmente
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                {/* CTA Button */}
                                <tr>
                                    <td style={{ padding: '0 40px 40px', textAlign: 'center' as const }}>
                                        <a
                                            href={`${appUrl}/publicar`}
                                            style={{
                                                display: 'inline-block',
                                                padding: '16px 32px',
                                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                color: '#ffffff',
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                textDecoration: 'none',
                                                borderRadius: '12px',
                                                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                                            }}
                                        >
                                            Publicar mi primer inmueble
                                        </a>
                                    </td>
                                </tr>

                                {/* Footer */}
                                <tr>
                                    <td style={{
                                        padding: '24px 40px',
                                        backgroundColor: '#fafafa',
                                        borderTop: '1px solid #e4e4e7',
                                        textAlign: 'center' as const,
                                    }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '13px',
                                            color: '#a1a1aa',
                                            lineHeight: '20px',
                                        }}>
                                            © {new Date().getFullYear()} Nido. Todos los derechos reservados.
                                        </p>
                                        <p style={{
                                            margin: '8px 0 0',
                                            fontSize: '12px',
                                            color: '#d4d4d8',
                                        }}>
                                            Recibiste este correo porque te registraste en nuestra plataforma.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
        </html>
    );
};

export default WelcomeEmail;
