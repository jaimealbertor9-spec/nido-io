// Supabase Edge Function: check-expired-verifications
// Cron Job: Runs every hour to reject expired verification deadlines
// Triggered via cron: 0 * * * * (every hour)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ExpiredVerification {
    id: string
    user_id: string
    deadline_at: string
}

Deno.serve(async (req: Request) => {
    // Allow both POST (cron trigger) and GET (manual trigger)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        )
    }

    console.log('⏰ [check-expired-verifications] Cron job started at:', new Date().toISOString())

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // ═══════════════════════════════════════════════════════════════
        // 1. FIND EXPIRED VERIFICATIONS
        // ═══════════════════════════════════════════════════════════════

        const { data: expired, error: fetchError } = await supabase
            .from('user_verifications')
            .select('id, user_id, deadline_at')
            .eq('status', 'PENDING_UPLOAD')
            .lt('deadline_at', new Date().toISOString())

        if (fetchError) {
            console.error('❌ Error fetching expired verifications:', fetchError)
            throw fetchError
        }

        if (!expired || expired.length === 0) {
            console.log('✅ No expired verifications found')
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No expired verifications',
                    processed: 0
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`🔍 Found ${expired.length} expired verifications`)

        // ═══════════════════════════════════════════════════════════════
        // 2. PROCESS EACH EXPIRED VERIFICATION
        // ═══════════════════════════════════════════════════════════════

        let processedCount = 0
        let errorCount = 0
        const affectedUserIds: string[] = []

        for (const verification of expired as ExpiredVerification[]) {
            try {
                console.log(`⏳ Processing expired verification: ${verification.id} (User: ${verification.user_id})`)

                // Update verification status to REJECTED_KYC
                const { error: updateError } = await supabase
                    .from('user_verifications')
                    .update({
                        status: 'REJECTED_KYC',
                        rejected_at: new Date().toISOString(),
                        rejected_reason: 'Deadline de 72 horas vencido sin subir documentos',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', verification.id)

                if (updateError) {
                    console.error(`❌ Error updating verification ${verification.id}:`, updateError)
                    errorCount++
                    continue
                }

                // Reject all IN_REVIEW listings for this user
                const { data: rejectedListings, error: listingsError } = await supabase
                    .from('inmuebles')
                    .update({
                        estado: 'rechazado',
                        updated_at: new Date().toISOString()
                    })
                    .eq('usuario_id', verification.user_id)
                    .eq('estado', 'en_revision')
                    .select('id')

                if (listingsError) {
                    console.error(`⚠️ Error rejecting listings for user ${verification.user_id}:`, listingsError)
                } else {
                    const rejectedCount = rejectedListings?.length || 0
                    console.log(`📦 Rejected ${rejectedCount} listings for user ${verification.user_id}`)
                }

                // Cancel pending notifications
                await supabase
                    .from('scheduled_notifications')
                    .update({
                        sent: true,
                        sent_at: new Date().toISOString(),
                        error_message: 'Cancelled - verification expired'
                    })
                    .eq('user_id', verification.user_id)
                    .eq('sent', false)

                // Log event for PQR reference
                console.log(`📝 PQR Log: User ${verification.user_id} verification expired at ${verification.deadline_at}`)

                affectedUserIds.push(verification.user_id)
                processedCount++

            } catch (err) {
                console.error(`❌ Error processing verification ${verification.id}:`, err)
                errorCount++
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. SUMMARY RESPONSE
        // ═══════════════════════════════════════════════════════════════

        console.log(`✅ Cron job completed. Processed: ${processedCount}, Errors: ${errorCount}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: `Processed ${processedCount} expired verifications`,
                processed: processedCount,
                errors: errorCount,
                affectedUsers: affectedUserIds.length,
                timestamp: new Date().toISOString()
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('❌ Cron job error:', error)

        return new Response(
            JSON.stringify({
                error: 'Cron job failed',
                message: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
