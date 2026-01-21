import * as React from 'react';

interface PaymentSuccessEmailProps {
    nombre: string;
    propertyName?: string;
    propertyLocation?: string;
    propertyPrice?: string | number;
}

export const PaymentSuccessEmail: React.FC<PaymentSuccessEmailProps> = ({
    nombre,
    propertyName,
    propertyLocation,
    propertyPrice,
}) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nido.io';

    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Pago Recibido - Nido</title>
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
                                        padding: '32px 40px',
                                        textAlign: 'center' as const,
                                    }}>
                                        <h1 style={{
                                            margin: 0,
                                            fontSize: '32px',
                                            fontWeight: 700,
                                            color: '#ffffff',
                                            letterSpacing: '-0.5px',
                                        }}>
                                            Nido
                                        </h1>
                                    </td>
                                </tr>

                                {/* Success Icon */}
                                <tr>
                                    <td style={{ padding: '40px 40px 24px', textAlign: 'center' as const }}>
                                        <div style={{
                                            width: '72px',
                                            height: '72px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '8px',
                                        }}>
                                            <span style={{ fontSize: '36px', lineHeight: 1 }}>✓</span>
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
                                            ¡Pago Recibido!
                                        </h2>
                                    </td>
                                </tr>

                                {/* Body */}
                                <tr>
                                    <td style={{ padding: '0 40px 24px' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '16px',
                                            lineHeight: '26px',
                                            color: '#52525b',
                                            textAlign: 'center' as const,
                                        }}>
                                            Hola <strong style={{ color: '#18181b' }}>{nombre}</strong>, hemos recibido tu pago por la publicación de tu inmueble.
                                        </p>
                                    </td>
                                </tr>

                                {/* Property Summary Card */}
                                {(propertyName || propertyLocation) && (
                                    <tr>
                                        <td style={{ padding: '0 40px 32px' }}>
                                            <table
                                                role="presentation"
                                                width="100%"
                                                cellPadding={0}
                                                cellSpacing={0}
                                                style={{
                                                    backgroundColor: '#fafafa',
                                                    borderRadius: '12px',
                                                    border: '1px solid #e4e4e7',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <tr>
                                                    <td style={{
                                                        padding: '16px 20px',
                                                        borderBottom: '1px solid #e4e4e7',
                                                        backgroundColor: '#f4f4f5',
                                                    }}>
                                                        <p style={{
                                                            margin: 0,
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            color: '#71717a',
                                                            textTransform: 'uppercase' as const,
                                                            letterSpacing: '0.5px',
                                                        }}>
                                                            Resumen del Anuncio
                                                        </p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '20px' }}>
                                                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                                            {/* Property Title */}
                                                            {propertyName && (
                                                                <tr>
                                                                    <td style={{ paddingBottom: '12px' }}>
                                                                        <p style={{
                                                                            margin: 0,
                                                                            fontSize: '11px',
                                                                            fontWeight: 600,
                                                                            color: '#a1a1aa',
                                                                            textTransform: 'uppercase' as const,
                                                                            letterSpacing: '0.5px',
                                                                            marginBottom: '4px',
                                                                        }}>
                                                                            Título
                                                                        </p>
                                                                        <p style={{
                                                                            margin: 0,
                                                                            fontSize: '16px',
                                                                            fontWeight: 600,
                                                                            color: '#18181b',
                                                                        }}>
                                                                            {propertyName}
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {/* Location */}
                                                            {propertyLocation && (
                                                                <tr>
                                                                    <td style={{ paddingBottom: '12px' }}>
                                                                        <p style={{
                                                                            margin: 0,
                                                                            fontSize: '11px',
                                                                            fontWeight: 600,
                                                                            color: '#a1a1aa',
                                                                            textTransform: 'uppercase' as const,
                                                                            letterSpacing: '0.5px',
                                                                            marginBottom: '4px',
                                                                        }}>
                                                                            Ubicación
                                                                        </p>
                                                                        <p style={{
                                                                            margin: 0,
                                                                            fontSize: '15px',
                                                                            color: '#52525b',
                                                                        }}>
                                                                            📍 {propertyLocation}
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {/* Price */}
                                                            {propertyPrice && (
                                                                <tr>
                                                                    <td style={{ paddingBottom: '12px' }}>
                                                                        <p style={{
                                                                            margin: 0,
                                                                            fontSize: '11px',
                                                                            fontWeight: 600,
                                                                            color: '#a1a1aa',
                                                                            textTransform: 'uppercase' as const,
                                                                            letterSpacing: '0.5px',
                                                                            marginBottom: '4px',
                                                                        }}>
                                                                            Precio
                                                                        </p>
                                                                        <p style={{
                                                                            margin: 0,
                                                                            fontSize: '16px',
                                                                            fontWeight: 600,
                                                                            color: '#16a34a',
                                                                        }}>
                                                                            💰 ${typeof propertyPrice === 'number'
                                                                                ? propertyPrice.toLocaleString('es-CO')
                                                                                : propertyPrice}
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {/* Status */}
                                                            <tr>
                                                                <td>
                                                                    <p style={{
                                                                        margin: 0,
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        color: '#a1a1aa',
                                                                        textTransform: 'uppercase' as const,
                                                                        letterSpacing: '0.5px',
                                                                        marginBottom: '4px',
                                                                    }}>
                                                                        Estado
                                                                    </p>
                                                                    <span style={{
                                                                        display: 'inline-block',
                                                                        padding: '6px 12px',
                                                                        backgroundColor: '#dcfce7',
                                                                        color: '#16a34a',
                                                                        fontSize: '13px',
                                                                        fontWeight: 600,
                                                                        borderRadius: '20px',
                                                                    }}>
                                                                        ✓ En Revisión
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                )}

                                {/* Info Text */}
                                <tr>
                                    <td style={{ padding: '0 40px 32px' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '14px',
                                            lineHeight: '22px',
                                            color: '#71717a',
                                            textAlign: 'center' as const,
                                        }}>
                                            Nuestro equipo revisará tu anuncio y te notificaremos cuando sea publicado.
                                            Este proceso suele tomar menos de 24 horas.
                                        </p>
                                    </td>
                                </tr>

                                {/* CTA Button */}
                                <tr>
                                    <td style={{ padding: '0 40px 40px', textAlign: 'center' as const }}>
                                        <a
                                            href={`${appUrl}/mis-inmuebles`}
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
                                            Ver Mis Inmuebles
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
                                            Este correo fue enviado porque realizaste un pago en nuestra plataforma.
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

export default PaymentSuccessEmail;
