import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const link = searchParams.get('link');
    const reference = searchParams.get('reference');

    if (!link) {
        return new NextResponse('Missing link parameter', { status: 400 });
    }

    // Safely construct the Wompi payment link
    const separator = link.includes('?') ? '&' : '?';
    const finalUrl = `${link}${separator}reference=${reference || ''}`;

    // Perform a standard 302 redirect. This avoids triggering WAF 403 errors
    // related to client-side origin tracking (localhost redirects).
    return NextResponse.redirect(finalUrl);
}
