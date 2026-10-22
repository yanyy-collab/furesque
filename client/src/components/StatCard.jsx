export default function StatCard({
  title,
  value,
  color = "border-l-blue-500",
  description = "Current total",
  icon = "↗",
}) {
  return (
    <article
      className={`rounded-2xl border border-slate-200 border-l-4 ${color} bg-white p-5 text-slate-800 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            {value ?? 0}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-slate-700">
          {icon}
        </div>
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {description}
      </p>
    </article>
  );
}