'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

const DEFAULT_PREVIEW = '/rentzentro-demo-thumbnail.png';

export default function DashboardPreviewUpload() {
  const [previewSrc, setPreviewSrc] = useState(DEFAULT_PREVIEW);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const onFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    setPreviewSrc(nextUrl);
  };

  return (
    <div className="rz-fade-up rz-delay-3 order-2 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/5 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Sample landlord view</p>
          <p className="text-sm font-semibold text-slate-100">Upload a real dashboard screenshot</p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/35 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileSelected}
            className="hidden"
          />
          Upload preview image
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
        <div className="relative aspect-[16/10] w-full bg-slate-950">
          <Image
            src={previewSrc}
            alt="Landlord dashboard preview"
            fill
            sizes="(min-width: 1280px) 620px, (min-width: 768px) 48vw, 100vw"
            className="object-contain p-1"
            unoptimized={previewSrc.startsWith('blob:')}
            priority
          />
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Tip: upload a current dashboard screenshot to make this homepage preview match the real product exactly.
      </p>
    </div>
  );
}
