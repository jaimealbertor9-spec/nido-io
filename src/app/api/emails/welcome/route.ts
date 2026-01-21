import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Forzamos que sea dinámica para evitar caché raro de Next.js
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    console.log("📨 [DEBUG] Iniciando API de Bienvenida...");

    try {
        // 1. Diagnóstico de la Llave
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error("❌ [DEBUG] FATAL: No existe RESEND_API_KEY en las variables de entorno.");
            return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
        }
        console.log(`🔑 [DEBUG] API Key detectada: ${apiKey.substring(0, 4)}...`);

        // 2. Leer datos del usuario
        const { email, name } = await request.json();
        console.log(`👤 [DEBUG] Enviando a: ${email} | Nombre: ${name}`);

        // 3. Inicializar Cliente
        const resend = new Resend(apiKey);

        // 4. Intento de Envío (HTML Simple para prueba)
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev', // El único remitente permitido en Sandbox
            to: email, // TIENE que ser el mismo email de tu cuenta de Resend
            subject: '¡Bienvenido a Nido! (Prueba de Diagnóstico)',
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>👋 Hola ${name}, bienvenido a Nido</h1>
          <p>Si estás leyendo esto, ¡LA CONEXIÓN CON RESEND FUNCIONA!</p>
          <p>Ya puedes estar tranquilo de que el sistema envía correos.</p>
        </div>
      `,
        });

        if (error) {
            console.error("❌ [DEBUG] Error devuelto por Resend:", error);
            return NextResponse.json({ error }, { status: 400 });
        }

        console.log("✅ [DEBUG] Correo enviado con éxito. ID:", data?.id);
        return NextResponse.json({ success: true, id: data?.id });

    } catch (error: any) {
        console.error("💥 [DEBUG] Error Crítico en el servidor:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
