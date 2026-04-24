type BrandWordmarkProps = {
  subtitle?: string;
  iconClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  llcBadgeClassName?: string;
};

export default function BrandWordmark({
  subtitle,
  iconClassName = 'h-10 w-10 rounded-xl text-lg',
  titleClassName = 'text-sm',
  subtitleClassName = 'text-[11px] text-slate-400',
  llcBadgeClassName = 'text-[10px] px-1.5 py-0.5',
}: BrandWordmarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-emerald-300/30 to-cyan-300/20 ring-1 ring-emerald-200/40 ${iconClassName}`}
      >
        <span className="font-semibold text-emerald-400">RZ</span>
      </div>

      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <p className={`font-semibold tracking-tight text-slate-50 ${titleClassName}`}>
            RentZentro
          </p>
          <span
            className={`inline-flex items-center rounded-md border border-emerald-300/40 bg-emerald-500/10 font-semibold uppercase tracking-wide text-emerald-200 ${llcBadgeClassName}`}
          >
            LLC
          </span>
        </div>
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
