export const dynamic = 'force-dynamic';

export default function BuscarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="buscar-route-wrapper h-[100dvh] overflow-hidden [&>*]:!pt-0">
            {children}
        </div>
    );
}
