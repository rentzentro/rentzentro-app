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
    <div className="rz-fade-up rz-delay-3 order-2 h-full">
      <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/5 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          Command center preview
        </p>

        <div className="relative mt-3 min-h-[430px] w-full flex-1 overflow-hidden rounded-2xl sm:min-h-[520px]">
          <Image
            src={previewSrc}
            alt="Landlord dashboard preview"
            fill
            sizes="(min-width: 1280px) 620px, (min-width: 768px) 48vw, 100vw"
            className="object-contain"
            unoptimized={previewSrc.startsWith('blob:')}
            priority
          />
        </div>
      </div>

      <label className="mt-3 inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-white/35 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileSelected}
          className="hidden"
        />
        Upload preview image
      </label>
    </div>
  );
}
