export function PageHeader(props: { title: string; description: string; actionLabel?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-soft backdrop-blur md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-3xl font-semibold text-ink">{props.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{props.description}</p>
      </div>
      {props.actionLabel ? (
        <button className="rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
          {props.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
