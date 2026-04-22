import type { Metadata } from 'next';
import BuscarClient from './_components/BuscarClient';

export const metadata: Metadata = {
    title: 'Buscar Propiedades con IA | Nido',
    description:
        'Encuentra tu hogar ideal con Nido IA. Busca apartamentos, casas y fincas cerca de parques, hospitales, transporte y más. Búsqueda conversacional inteligente.',
    openGraph: {
        title: 'Buscar Propiedades con IA | Nido',
        description: 'Encuentra tu hogar ideal con Nido IA. Búsqueda conversacional inteligente.',
        type: 'website',
    },
};

export default function BuscarPage() {
    return <BuscarClient />;
}
