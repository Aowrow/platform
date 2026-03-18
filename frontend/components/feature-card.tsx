import Link from 'next/link';

type FeatureCardProps = {
  code: string;
  name: string;
  description: string;
  resultType: string;
};

export function FeatureCard({ code, name, description, resultType }: FeatureCardProps) {
  return (
    <Link
      href={`/features/${code}`}
      className="group rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft transition hover:-translate-y-1 hover:border-blue-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Feature</p>
          <h3 className="mt-3 text-2xl font-semibold text-ink">{name}</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{resultType}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-6 text-sm font-medium text-brand">进入功能页</div>
    </Link>
  );
}
