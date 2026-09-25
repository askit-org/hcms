import EditVisitForm from './EditVisitForm';

export default async function EditVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  return <EditVisitForm visitId={visitId} />;
}
