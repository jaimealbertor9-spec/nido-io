// Supabase Edge Function: send-verification-emails
// Cron Job: Runs every 5 minutes to send pending notification emails
// Uses Resend (or configured mail provider) for delivery

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PendingNotification {
    id: string
    user_id: string
    notification_type: string
    metadata: {
        email: string
        subject: string
        urgent?: boolean
    }
    scheduled_for: string
}

// Email templates
const EMAIL_TEMPLATES = {
    verification_reminder_20min: {
        subject: '📋 Completa tu verificación en Nido',
        body: (userName: string, deadline: string) => `
¡Hola${userName ? ` ${userName}` : ''}!

Tu pago ha sido procesado exitosamente. Para que tu inmueble sea publicado, necesitamos verificar tu identidad.

📅 Tienes hasta: ${deadline}

👉 Sube tu documento de identidad ahora:
[LINK_VERIFICACION]

Si no completas este paso, tu publicación será cancelada automáticamente.

Saludos,
El equipo de Nido
        `.trim()
    },
    verification_reminder_24hrs: {
        subject: '⚠️ URGENTE: Solo quedan 24 horas para verificar tu identidad',
        body: (userName: string, deadline: string) => `
¡Hola${userName ? ` ${userName}` : ''}!

⏰ RECORDATORIO URGENTE

Tu plazo para verificar tu identidad vence mañana a las ${deadline}.

Si no subes tu documento de identidad antes de esta fecha, tu publicación será RECHAZADA permanentemente.

👉 Verifica tu identidad ahora:
[LINK_VERIFICACION]

No pierdas tu publicación.

Saludos,
El equipo de Nido
        `.trim()
    }
}

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        )
    }

    console.log('📧 [send-verification-emails] Cron job started at:', new Date().toISOString())

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const resendApiKey = Deno.env.get('RESEND_API_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // ═══════════════════════════════════════════════════════════════
        // 1. GET PENDING NOTIFICATIONS
        // ═══════════════════════════════════════════════════════════════

        const { data: pending, error: fetchError } = await supabase
            .rpc('get_pending_notifications', { p_limit: 50 })

        if (fetchError) {
            console.error('❌ Error fetching pending notifications:', fetchError)
            throw fetchError
        }

        if (!pending || pending.length === 0) {
            console.log('✅ No pending notifications to send')
            return new Response(
                JSON.stringify({ success: true, sent: 0 }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📨 Found ${pending.length} pending notifications`)

        // ═══════════════════════════════════════════════════════════════
        // 2. PROCESS EACH NOTIFICATION
        // ═══════════════════════════════════════════════════════════════

        let sentCount = 0
        let errorCount = 0

        for (const notification of pending as PendingNotification[]) {
            try {
                const { id, notification_type, metadata } = notification
                const email = metadata?.email

                if (!email) {
                    console.warn(`⚠️ Notification ${id} has no email, skipping`)
                    continue
                }

                // Get template
                const template = EMAIL_TEMPLATES[notification_type as keyof typeof EMAIL_TEMPLATES]
                if (!template) {
                    console.warn(`⚠️ Unknown notification type: ${notification_type}`)
                    continue
                }

                // Get user info for personalization
                const { data: userData } = await supabase
                    .from('usuarios')
                    .select('nombre')
                    .eq('id', notification.user_id)
                    .single()

                // Get verification deadline
                const { data: verification } = await supabase
                    .from('user_verifications')
                    .select('deadline_at')
                    .eq('user_id', notification.user_id)
                    .single()

                const userName = userData?.nombre || ''
                const deadline = verification?.deadline_at
                    ? new Date(verification.deadline_at).toLocaleString('es-CO', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                    })
                    : 'pronto'

                const subject = metadata.subject || template.subject
                const body = template.body(userName, deadline)

                // Send email via Resend (if configured)
                if (resendApiKey) {
                    const response = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: 'Nido <notificaciones@nido.io>',
                            to: email,
                            subject,
                            text: body
                        })
                    })

                    if (!response.ok) {
                        const errorData = await response.json()
                        throw new Error(`Resend error: ${JSON.stringify(errorData)}`)
                    }

                    console.log(`✅ Email sent to ${email} (${notification_type})`)
                } else {
                    // Log only if Resend not configured
                    console.log(`📧 [MOCK] Would send email to ${email}:`, { subject })
                }

                // Mark notification as sent
                await supabase.rpc('mark_notification_sent', { p_notification_id: id })
                sentCount++

            } catch (err: any) {
                console.error(`❌ Error processing notification ${notification.id}:`, err.message)

                // Update retry count
                await supabase
                    .from('scheduled_notifications')
                    .update({
                        retry_count: supabase.sql`retry_count + 1`,
                        error_message: err.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', notification.id)

                errorCount++
            }
        }

        console.log(`✅ Email job completed. Sent: ${sentCount}, Errors: ${errorCount}`)

        return new Response(
            JSON.stringify({
                success: true,
                sent: sentCount,
                errors: errorCount,
                timestamp: new Date().toISOString()
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('❌ Email job error:', error)

        return new Response(
            JSON.stringify({
                error: 'Email job failed',
                message: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
