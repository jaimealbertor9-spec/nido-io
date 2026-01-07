import { redirect } from 'next/navigation';

interface Props {
    params: { id: string };
}

// Entry point for the property creation wizard
// Redirects to the first step (paso-1)
export default function PropertyCreationEntryPage({ params }: Props) {
    redirect(`/publicar/crear/${params.id}/paso-1`);
}
