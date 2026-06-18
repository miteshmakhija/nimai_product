import { useEffect, useState } from 'react';
import { docxTemplateApi } from '../api';
import { FileText } from 'lucide-react';

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

export default function DocxTemplate() {
  const [tplInfo, setTplInfo] = useState<{ active: boolean; name?: string; uploaded_at?: string } | null>(null);
  const [tplUploading, setTplUploading] = useState(false);

  useEffect(() => {
    docxTemplateApi.get().then((r) => setTplInfo(r.data)).catch(() => setTplInfo({ active: false }));
  }, []);

  async function handleTplUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTplUploading(true);
    try {
      const { data } = await docxTemplateApi.upload(file);
      setTplInfo({ active: true, name: data.name, uploaded_at: data.uploaded_at });
    } finally {
      setTplUploading(false);
      e.target.value = '';
    }
  }

  async function handleTplRemove() {
    await docxTemplateApi.remove();
    setTplInfo({ active: false });
  }

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[640px]">
        <div className="mb-6">
          <h1 className="text-[24px] font-bold tracking-[-0.03em] text-foreground">Document Template</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Upload a .docx template to customise exported quotation layouts.
          </p>
        </div>

        <div className="rounded-[18px] border border-border bg-card p-6 shadow-[var(--elevated-shadow)]">
          {tplInfo === null ? (
            <p className="text-[13px] text-muted-foreground">Loading…</p>
          ) : tplInfo.active ? (
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand/10 text-brand">
                <FileText className="h-5 w-5" strokeWidth={1.9} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{tplInfo.name}</p>
                {tplInfo.uploaded_at && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Uploaded {new Date(tplInfo.uploaded_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-muted/40 text-muted-foreground">
                <FileText className="h-5 w-5" strokeWidth={1.9} />
              </div>
              <div>
                <p className="font-semibold text-foreground">No active template</p>
                <p className="text-[13px] text-muted-foreground">Exports use the default layout.</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <label
              className={`flex h-9 cursor-pointer items-center rounded-[10px] px-4 text-[13px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(54,148,252,0.5)] transition-[transform,filter] duration-150 hover:-translate-y-px ${BRAND_GRADIENT} ${tplUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {tplUploading ? 'Uploading…' : 'Upload New Template'}
              <input type="file" accept=".docx" className="hidden" onChange={handleTplUpload} disabled={tplUploading} />
            </label>
            {tplInfo?.active && (
              <button
                className="flex h-9 items-center rounded-[10px] border border-border px-4 text-[13px] font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                onClick={handleTplRemove}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
