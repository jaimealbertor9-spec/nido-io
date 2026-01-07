import { redirect } from 'next/navigation';

/**
 * DEPRECATED: Login page redirect to /bienvenidos
 * 
 * This page is deprecated and now serves as a redirect to the main welcome page.
 * All authentication should go through /bienvenidos which handles both login and registration flows.
 * 
 * Query parameters (like ?intent=propietario or ?error=...) are preserved and passed through.
 */
export default async function LoginPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    // Await searchParams as required in Next.js 15
    const params = await Promise.resolve(searchParams);

    // Construct the destination URL with preserved query params
    const urlParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'string') {
            urlParams.append(key, value);
        } else if (Array.isArray(value)) {
            // Handle array values
            value.forEach(v => urlParams.append(key, v));
        }
    });

    const queryString = urlParams.toString();
    const destination = queryString ? `/bienvenidos?${queryString}` : '/bienvenidos';

    console.log('🔄 /auth/login DEPRECATED - Redirecting to:', destination);

    // Execute Server Redirect
    redirect(destination);
}
