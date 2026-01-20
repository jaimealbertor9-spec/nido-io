import { AuthProvider } from '@/components/AuthProvider';

export default function MisInmueblesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // This layout does NOT include the global Header
    // The Dashboard has its own Sidebar navigation
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}
