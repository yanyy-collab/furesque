
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";

const STATUS_ITEMS = [
  { key: "INTAKE", label: "Intake", color: "bg-sky-400", dot: "bg-sky-400" },
  { key: "ARTIST_QUEUE", label: "Artist Queue", color: "bg-purple-500", dot: "bg-purple-500" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500", dot: "bg-blue-500" },
  { key: "PROOF_REVISION", label: "Proof Revision", color: "bg-amber-400", dot: "bg-amber-400" },
  { key: "REVISION_PENDING", label: "Revision Pending", color: "bg-orange-500", dot: "bg-orange-500" },
  { key: "FINAL_DELIVERY", label: "Final Delivery", color: "bg-indigo-500", dot: "bg-indigo-500" },
  { key: "COMPLETED", label: "Completed", color: "bg-emerald-400", dot: "bg-emerald-400" },
  { key: "CANCELLED", label: "Cancelled", color: "bg-pink-500", dot: "bg-pink-500" },
];

const INITIAL_STATS = {
  totalOrders: 0,
  activeOrders: 0,
  overdueTasks: 0,
  revisionsPending: 0,
  statusCounts: {
    INTAKE: 0,
    ARTIST_QUEUE: 0,
    IN_PROGRESS: 0,
    PROOF_REVISION: 0,
    REVISION_PENDING: 0,
    FINAL_DELIVERY: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  },
};

const STAT_CARDS = [
  {
    key: "totalOrders",
    title: "Total Orders",
    description: "All orders in the system",
    icon: "▤",
    gradient: "from-blue-600 to-sky-400",
    iconBg: "bg-white/20",
    trend: "Overview",
  },
  {
    key: "activeOrders",
    title: "Active Orders",
    description: "Orders currently in progress",
    icon: "▶",
    gradient: "from-emerald-600 to-teal-400",
    iconBg: "bg-white/20",
    trend: "In progress",
  },
  {
    key: "overdueTasks",
    title: "Overdue Tasks",
    description: "Unfinished orders past due date",
    icon: "!",
    gradient: "from-rose-600 to-orange-400",
    iconBg: "bg-white/20",
    trend: "Needs attention",
  },
  {
    key: "revisionsPending",
    title: "Pending Revisions",
    description: "Revisions awaiting resolution",
    icon: "↻",
    gradient: "from-amber-500 to-orange-400",
    iconBg: "bg-white/20",
    trend: "Awaiting action",
  },
];

function StatCard({ card, value }) {
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl bg-linear-to-br ${card.gradient} p-5 text-white shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="pointer-events-none absolute -right-5 -top-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125" />
      <div className="pointer-events-none absolute -bottom-12 right-12 h-24 w-24 rounded-full bg-black/5" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/90">
            {card.title}
          </p>
          <p className="mt-4 text-4xl font-extrabold tracking-tight">
            {value ?? 0}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm ${card.iconBg}`}
          aria-hidden="true"
        >
          {card.icon}
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-3">
        <span className="text-xs text-white/85">{card.description}</span>
        <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {card.trend}
        </span>
      </div>
    </article>
  );
}

function LoadingCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="h-4 w-28 rounded bg-slate-700" />
      <div className="mt-4 h-9 w-16 rounded bg-slate-700" />
      <div className="mt-5 h-3 w-32 rounded bg-slate-800" />
    </div>
  );
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function StatusDonut({ statusCounts, totalOrders }) {
  const colors = [
    "#38bdf8",
    "#a855f7",
    "#3b82f6",
    "#fbbf24",
    "#f97316",
    "#6366f1",
    "#34d399",
    "#ec4899",
  ];

  let cumulative = 0;

  const segments = STATUS_ITEMS.map((item, index) => {
    const count = Number(statusCounts?.[item.key] || 0);
    const percentage =
      totalOrders > 0 ? (count / totalOrders) * 100 : 0;

    const segment = {
      ...item,
      count,
      colorHex: colors[index],
      start: cumulative,
      percentage,
    };

    cumulative += percentage;
    return segment;
  });

  const gradient =
    totalOrders > 0
      ? `conic-gradient(${segments
          .map((segment) => {
            const start = segment.start;
            const end = start + segment.percentage;
            return `${segment.colorHex} ${start}% ${end}%`;
          })
          .join(", ")})`
      : "#1e293b";

  return (
    <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
      <div
        className="relative h-48 w-48 shrink-0 rounded-full"
        style={{ background: gradient }}
        role="img"
        aria-label={`Order status overview for ${totalOrders} total orders`}
      >
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full border border-slate-700 bg-slate-950 shadow-inner">
          <span className="text-3xl font-extrabold text-white">
            {totalOrders}
          </span>
          <span className="mt-1 text-xs text-slate-400">
            Total Orders
          </span>
        </div>
      </div>

      <div className="w-full space-y-3">
        {segments.map((segment) => {
          const percentage =
            totalOrders > 0
              ? Math.round((segment.count / totalOrders) * 100)
              : 0;

          return (
            <div
              key={segment.key}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.colorHex }}
                />
                <span className="truncate text-slate-300">
                  {segment.label}
                </span>
              </div>

              <span className="w-7 text-right font-semibold text-slate-100">
                {segment.count}
              </span>
              <span className="w-10 text-right text-xs text-slate-500">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [statsResponse, ordersResponse] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/orders", {
          params: { limit: 5, page: 1 },
        }),
      ]);

      const statsData = statsResponse.data || {};
      const ordersData = ordersResponse.data || {};

      setStats({
        ...INITIAL_STATS,
        ...statsData,
        statusCounts: {
          ...INITIAL_STATS.statusCounts,
          ...(statsData.statusCounts || {}),
        },
      });

      setOrders(
        Array.isArray(ordersData.orders) ? ordersData.orders : []
      );

      setError("");
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load dashboard data. Please check your server and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalOrders = Number(stats.totalOrders || 0);

  return (
    <main className="min-h-screen bg-[#080f20] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-7">
        {/* Dashboard heading */}
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
              Furesque Management
            </p>

            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Monitor orders, task progress, and pending revisions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-linear-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:from-blue-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60 lg:self-auto"
          >
            <span aria-hidden="true" className="text-lg">
              {refreshing ? "⟳" : "↻"}
            </span>
            {refreshing ? "Refreshing..." : "Refresh Dashboard"}
          </button>
        </header>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex flex-col justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-semibold text-rose-300">
                Dashboard data could not be loaded
              </p>
              <p className="mt-1 text-sm text-rose-200/80">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="rounded-lg border border-rose-400/40 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Statistics cards */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              A quick summary of your current workload.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <LoadingCard key={index} />
                ))
              : STAT_CARDS.map((card) => (
                  <StatCard
                    key={card.key}
                    card={card}
                    value={stats[card.key]}
                  />
                ))}
          </div>
        </section>

        {/* Status breakdown and donut chart */}
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-[#0e192d] p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Order Status Breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Current distribution across all workflow stages.
                </p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2">
                <p className="text-xs text-slate-400">Total Orders</p>
                <p className="text-xl font-extrabold text-white">
                  {totalOrders}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="mb-3 h-4 w-32 rounded bg-slate-700" />
                    <div className="h-2.5 rounded-full bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-7 gap-y-5 md:grid-cols-2">
                {STATUS_ITEMS.map((item) => {
                  const count = Number(
                    stats.statusCounts?.[item.key] || 0
                  );

                  const percentage =
                    totalOrders > 0
                      ? Math.round((count / totalOrders) * 100)
                      : 0;

                  return (
                    <div key={item.key}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`}
                          />
                          <span className="truncate text-sm font-medium text-slate-300">
                            {item.label}
                          </span>
                        </div>

                        <span className="shrink-0 text-sm font-semibold text-slate-100">
                          {count}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            ({percentage}%)
                          </span>
                        </span>
                      </div>

                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-slate-800"
                        role="progressbar"
                        aria-label={`${item.label} orders`}
                        aria-valuenow={percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#0e192d] p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">
                Order Status Overview
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Visual summary of every order status.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-52 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-400" />
              </div>
            ) : (
              <StatusDonut
                statusCounts={stats.statusCounts}
                totalOrders={totalOrders}
              />
            )}
          </section>
        </div>

        {/* Recent orders */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0e192d] shadow-xl shadow-black/10">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                Recent Orders
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                The latest five orders in your system.
              </p>
            </div>

            <span className="self-start rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 sm:self-auto">
              {orders.length} shown
            </span>
          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-8 rounded-lg bg-slate-800" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-2xl text-slate-300">
                ▤
              </div>
              <h3 className="mt-4 font-semibold text-white">
                No orders found
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Orders will appear here when they are added.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-190 text-left text-sm">
                  <thead className="bg-slate-800/70 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Order</th>
                      <th className="px-6 py-4 font-semibold">Customer</th>
                      <th className="px-6 py-4 font-semibold">Artist</th>
                      <th className="px-6 py-4 font-semibold">Due Date</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="transition hover:bg-slate-800/40"
                      >
                        <td className="whitespace-nowrap px-6 py-4 font-bold text-blue-300">
                          {order.etsy_no || order.id || "—"}
                        </td>

                        <td className="px-6 py-4 text-slate-300">
                          {order.customer_name || "—"}
                        </td>

                        <td className="px-6 py-4 text-slate-300">
                          {order.artist_name || "Unassigned"}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-slate-400">
                          {formatDate(order.due_date)}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Order
                        </p>
                        <p className="mt-1 font-bold text-blue-300">
                          {order.etsy_no || order.id || "—"}
                        </p>
                      </div>

                      <StatusBadge status={order.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Customer</p>
                        <p className="mt-1 wrap-break text-sm font-medium text-slate-200">
                          {order.customer_name || "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Artist</p>
                        <p className="mt-1 wrap-break text-sm font-medium text-slate-200">
                          {order.artist_name || "Unassigned"}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Due Date</p>
                        <p className="mt-1 text-sm font-medium text-slate-300">
                          {formatDate(order.due_date)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <footer className="pb-2 text-center text-xs text-slate-500">
          Furesque Order and Task Monitoring System
        </footer>
      </div>
    </main>
  );
}
