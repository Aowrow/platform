export function StatCard(props: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-soft">
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{props.value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{props.hint}</p>
    </div>
  );
}
