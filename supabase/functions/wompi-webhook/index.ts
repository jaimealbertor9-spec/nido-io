// Supabase Edge Function: wompi-webhook
// Recibe notificaciones de Wompi y actualiza el estado del inmueble en la BD
// VERSIÓN 2.0: Implementa Identity & Publication Lifecycle
// - Usuarios verificados: publicación instantánea
// - Usuarios no verificados: en_revision + timer 72hrs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tipos para el webhook de Wompi
interface WompiTransaction {
    id: string
    status: string
    reference: string
    amount_in_cents: number
    currency: string
    customer_email: string
    payment_method_type: string
    created_at: string
    finalized_at: string
}

interface WompiWebhookPayload {
    event: string
    data: {
        transaction: WompiTransaction
    }
    sent_at: string
    timestamp: number
    signature: {
        properties: string[]
        checksum: string
    }
}

interface InmuebleBorrador {
    id: string
    estado: string
    usuario_id: string
}

// Servidor HTTP Deno
Deno.serve(async (req: Request) => {
    // Solo aceptar POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        )
    }

    try {
        // 1. Leer el cuerpo del request
        const payload: WompiWebhookPayload = await req.json()
        console.log('📥 Wompi Webhook recibido:', JSON.stringify(payload, null, 2))

        // 2. Verificar el tipo de evento
        if (payload.event !== 'transaction.updated') {
            console.log('ℹ️ Evento ignorado:', payload.event)
            return new Response(
                JSON.stringify({ message: 'Evento ignorado', event: payload.event }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // 3. Extraer datos de la transacción
        const { transaction } = payload.data
        const { status, reference, id: transactionId, customer_email } = transaction

        console.log(`💳 Transacción: ${transactionId}`)
        console.log(`📋 Referencia: ${reference}`)
        console.log(`📊 Estado: ${status}`)

        // 4. Solo procesar transacciones APPROVED
        if (status !== 'APPROVED') {
            console.log(`⏭️ Estado ${status} no requiere acción`)
            return new Response(
                JSON.stringify({
                    message: 'Transacción no aprobada, sin cambios',
                    status
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // 5. Extraer el segmento UUID parcial de la referencia
        let uuidPrefix: string

        if (reference.startsWith('NIDO-')) {
            const parts = reference.split('-')
            if (parts.length >= 2) {
                uuidPrefix = parts[1]
                console.log(`🔍 Prefijo UUID extraído: ${uuidPrefix}`)
            } else {
                throw new Error(`Formato de referencia inválido: ${reference}`)
            }
        } else {
            uuidPrefix = reference.substring(0, 8)
            console.log(`🔍 Usando primeros 8 chars de referencia: ${uuidPrefix}`)
        }

        // 6. Inicializar cliente de Supabase con Service Role Key
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 7. Buscar inmueble borrador
        console.log('💾 Buscando inmuebles en estado borrador...')

        const { data: borradores, error: fetchError } = await supabase
            .from('inmuebles')
            .select('id, estado, usuario_id')
            .eq('estado', 'borrador')

        if (fetchError) {
            console.error('❌ Error consultando borradores:', fetchError)
            throw fetchError
        }

        if (!borradores || borradores.length === 0) {
            console.log('⚠️ No hay inmuebles en estado borrador')
            return new Response(
                JSON.stringify({
                    error: 'No hay borradores pendientes',
                    reference
                }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📋 Borradores encontrados: ${borradores.length}`)

        // 8. Filtrar inmueble por prefijo UUID
        const inmuebleEncontrado = borradores.find((inmueble: InmuebleBorrador) =>
            inmueble.id.startsWith(uuidPrefix)
        )

        if (!inmuebleEncontrado) {
            console.error(`❌ No se encontró inmueble con ID que empiece con: ${uuidPrefix}`)
            return new Response(
                JSON.stringify({
                    error: 'Inmueble no encontrado',
                    reference,
                    searchedPrefix: uuidPrefix
                }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            )
        }

        const inmuebleId = inmuebleEncontrado.id
        const usuarioId = inmuebleEncontrado.usuario_id
        console.log(`✅ Inmueble encontrado: ${inmuebleId}`)
        console.log(`👤 Usuario propietario: ${usuarioId}`)

        // ═══════════════════════════════════════════════════════════════
        // 9. VERIFICAR ESTADO DE VERIFICACIÓN DEL USUARIO
        // ═══════════════════════════════════════════════════════════════

        let isUserVerified = false
        let userEmail = customer_email

        // Obtener email del usuario y verificar estado
        const { data: userData } = await supabase
            .from('usuarios')
            .select('email')
            .eq('id', usuarioId)
            .single()

        if (userData?.email) {
            userEmail = userData.email
        }

        // Verificar si el usuario tiene status VERIFIED
        const { data: verification } = await supabase
            .from('user_verifications')
            .select('status')
            .eq('user_id', usuarioId)
            .single()

        if (verification && verification.status === 'VERIFIED') {
            isUserVerified = true
            console.log('✅ Usuario VERIFICADO - Publicación instantánea')
        } else {
            console.log('⏳ Usuario NO VERIFICADO - Requiere verificación KYC')
        }

        // ═══════════════════════════════════════════════════════════════
        // 10. APLICAR LÓGICA CONDICIONAL
        // ═══════════════════════════════════════════════════════════════

        let nuevoEstado: string
        let verificationId: string | null = null

        if (isUserVerified) {
            // RUTA VERIFICADA: Publicación instantánea
            nuevoEstado = 'publicado'
            console.log('🚀 Ruta rápida: Usuario verificado → publicado')
        } else {
            // RUTA NO VERIFICADA: Retener para revisión + iniciar timer
            nuevoEstado = 'en_revision'
            console.log('⏳ Ruta de verificación: Usuario no verificado → en_revision')

            // Iniciar timer de 72 horas usando la función de BD
            const { data: timerId, error: timerError } = await supabase.rpc(
                'start_verification_timer',
                { p_user_id: usuarioId }
            )

            if (timerError) {
                console.error('⚠️ Error iniciando timer de verificación:', timerError)
            } else {
                verificationId = timerId
                console.log(`⏱️ Timer de 72hrs iniciado. Verification ID: ${verificationId}`)

                // Programar notificaciones de email
                if (userEmail && verificationId) {
                    const { error: notifError } = await supabase.rpc(
                        'schedule_verification_notifications',
                        {
                            p_user_id: usuarioId,
                            p_verification_id: verificationId,
                            p_user_email: userEmail
                        }
                    )

                    if (notifError) {
                        console.error('⚠️ Error programando notificaciones:', notifError)
                    } else {
                        console.log('📧 Notificaciones programadas (20min y 48hrs)')
                    }
                }
            }
        }

        // 11. Actualizar el estado del inmueble
        const { error: updateError } = await supabase
            .from('inmuebles')
            .update({
                estado: nuevoEstado,
                updated_at: new Date().toISOString()
            })
            .eq('id', inmuebleId)

        if (updateError) {
            console.error('❌ Error actualizando inmueble:', updateError)
            return new Response(
                JSON.stringify({
                    error: 'Error actualizando inmueble',
                    details: updateError.message
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // 12. Respuesta exitosa
        const message = isUserVerified
            ? 'Inmueble publicado exitosamente'
            : 'Pago recibido. Inmueble en revisión pendiente de verificación KYC.'

        console.log(`🎉 Inmueble ${inmuebleId} actualizado a '${nuevoEstado}'`)

        return new Response(
            JSON.stringify({
                success: true,
                message,
                inmuebleId,
                transactionId,
                reference,
                estado: nuevoEstado,
                requiresVerification: !isUserVerified,
                verificationId
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('❌ Error procesando webhook:', error)

        return new Response(
            JSON.stringify({
                error: 'Error interno del servidor',
                message: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})

