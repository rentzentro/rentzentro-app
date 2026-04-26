'use client';

import Image from 'next/image';

const DEFAULT_PREVIEW = '/rentzentro-demo-thumbnail.png';

export default function DashboardPreviewUpload() {
  const previewSrc = DEFAULT_PREVIEW;

  return (
    <div className="rz-fade-up rz-delay-3 order-2 lg:self-start">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/5 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          Command center preview
        </p>

        <div className="relative mt-3 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 aspect-[12/11]">
          <Image
            src={previewSrc}
            alt="Landlord dashboard preview"
            fill
            sizes="(min-width: 1280px) 620px, (min-width: 768px) 48vw, 100vw"
            className="object-cover object-top"
            unoptimized={previewSrc.startsWith('blob:')}
            priority
          />
        </div>
      </div>

    </div>
  );
}
