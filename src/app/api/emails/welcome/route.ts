import { NextRequest, NextResponse } from 'next/server';
import { resend } from '@/lib/resend';
import { WelcomeEmail } from '@/components/emails/WelcomeEmail';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name } = body;

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            );
        }

        const nombre = name || 'Usuario';

        const { data, error } = await resend.emails.send({
            from: 'Nido <onboarding@resend.dev>',
            to: email,
            subject: '¡Bienvenido a Nido! 🏡',
            react: WelcomeEmail({ nombre }),
        });

        if (error) {
            console.error('[WELCOME EMAIL] ❌ Failed to send:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        console.log('[WELCOME EMAIL] ✅ Sent successfully:', data?.id);
        return NextResponse.json({
            success: true,
            messageId: data?.id,
        });

    } catch (error: any) {
        console.error('[WELCOME EMAIL] 💥 Unexpected error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
