import { DISCLAIMER } from '@/lib/constants';

export default function SourceFooter({
  sourceUrl,
  version,
  lastCheckedAt,
  showDisclaimer = true,
  eco = false,
}: {
  sourceUrl?: string;
  version?: string;
  lastCheckedAt?: string | Date;
  showDisclaimer?: boolean;
  eco?: boolean;
}) {
  let isHttps = false;
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol === 'https:') {
        isHttps = true;
      }
    } catch (_) {
      // Ignored
    }
  }

  let formattedDate: string | null = null;
  if (lastCheckedAt) {
    const d = typeof lastCheckedAt === 'string' ? new Date(lastCheckedAt) : lastCheckedAt;
    if (d && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    }
  }

  const infoParts: string[] = [];
  if (version) {
    infoParts.push(`Phiên bản: ${version}`);
  }
  if (formattedDate) {
    infoParts.push(`Cập nhật: ${formattedDate}`);
  }
  const infoText = infoParts.join(' · ');

  return (
    <footer className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-4">
      {showDisclaimer && (
        <p className="leading-relaxed text-slate-400 italic">
          {DISCLAIMER}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {sourceUrl && (
            <span className="inline-flex items-center">
              {isHttps ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:text-amber-700 underline font-medium"
                >
                  Nguồn: {sourceUrl}
                </a>
              ) : (
                <span>Nguồn: {sourceUrl}</span>
              )}
            </span>
          )}
          {infoText && (
            <span className="text-slate-400 font-medium">
              {infoText}
            </span>
          )}
        </div>

        {eco && (
          <div className="flex items-center">
            <span className="badge-eco" />
          </div>
        )}
      </div>
    </footer>
  );
}