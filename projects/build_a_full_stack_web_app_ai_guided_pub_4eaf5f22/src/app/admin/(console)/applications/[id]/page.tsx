import ApplicationReviewDetail from '@/components/ApplicationReviewDetail';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminApplicationDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Cổng quản trị</p>
        <h1 className="text-2xl font-bold text-slate-800">Chi tiết hồ sơ — xét duyệt</h1>
        <p className="mt-1 text-sm text-slate-600">
          Admin cũng có thể phê duyệt hoặc trả lại hồ sơ công dân.
        </p>
      </div>
      <ApplicationReviewDetail applicationId={id} listHref="/admin" canReview={false} />
    </main>
  );
}
