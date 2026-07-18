import ApplicationReviewDetail from '@/components/ApplicationReviewDetail';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ManagerApplicationDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
          Cổng người quản lý
        </p>
        <h1 className="text-2xl font-bold text-slate-800">Chi tiết hồ sơ — xét duyệt</h1>
        <p className="mt-1 text-sm text-slate-600">
          Xem nội dung khai báo, phê duyệt hoặc trả lại để người dân bổ sung.
        </p>
      </div>
      <ApplicationReviewDetail applicationId={id} listHref="/manager" canReview />
    </main>
  );
}
