import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const FILTERS = [
  { value: "OVERDUE", label: "Overdue", color: "red" },
  { value: "DUE_TODAY", label: "Due Today", color: "amber" },
  { value: "UPCOMING", label: "Upcoming", color: "blue" },
];

const STATUS_OPTIONS = [
  ["INTAKE", "Intake"],
  ["ARTIST_QUEUE", "Artist Queue"],
  ["IN_PROGRESS", "In Progress"],
  ["PROOF_REVISION", "Proof Revision"],
  ["REVISION_PENDING", "Revision Pending"],
  ["FINAL_DELIVERY", "Final Delivery"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];

const urgencyStyles = {
  OVERDUE: "border-red-500/30 bg-red-500/10 text-red-300",
  DUE_TODAY: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  UPCOMING: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  LATER: "border-gray-500/30 bg-gray-500/10 text-gray-300",
  CLOSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const statusStyles = {
  INTAKE: "bg-gray-500/15 text-gray-300",
  ARTIST_QUEUE: "bg-purple-500/15 text-purple-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-300",
  PROOF_REVISION: "bg-amber-500/15 text-amber-300",
  REVISION_PENDING: "bg-orange-500/15 text-orange-300",
  FINAL_DELIVERY: "bg-cyan-500/15 text-cyan-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-300",
  CANCELLED: "bg-red-500/15 text-red-300",
};

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(dateValue) {
  if (!dateValue) return "No due date";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getUrgency(order) {
  if (order.deadline_status) {
    return order.deadline_status;
  }

  if (order.days_remaining === null || order.days_remaining === undefined) {
    return "LATER";
  }

  const days = Number(order.days_remaining);

  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE_TODAY";
  if (days <= 7) return "UPCOMING";

  return "LATER";
}

function getDeadlineText(order) {
  const urgency = getUrgency(order);

  if (urgency === "CLOSED") return "Closed";
  if (urgency === "OVERDUE") {
    const days = Math.abs(Number(order.days_remaining));
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }

  if (urgency === "DUE_TODAY") return "Due today";

  if (urgency === "UPCOMING") {
    const days = Number(order.days_remaining);

    if (days === 1) return "Due tomorrow";

    return `Due in ${days} days`;
  }

  return "Due later";
}

function getOrderIdentifier(order) {
  return order.order_no ?? order.id;
}

export default function Deadlines() {
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState("OVERDUE");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  const loadDeadlines = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/orders/deadlines");

      setOrders(
        Array.isArray(response.data.orders) ? response.data.orders : []
      );
    } catch (err) {
      console.error("Failed to load deadlines:", err);

      setError(
        err.response?.data?.message ||
          "Failed to retrieve deadline alerts. Please check your backend API."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeadlines();
  }, [loadDeadlines]);

  async function changeStatus(order, newStatus) {
    if (newStatus === order.status) return;

    const orderId = order.id;

    if (orderId === undefined || orderId === null) {
      setError("Cannot update this order because its ID is missing.");
      return;
    }

    setError("");
    setActionMessage("");
    setStatusSavingId(orderId);

    try {
      await api.patch(`/orders/${orderId}/status`, {
        status: newStatus,
      });

      setActionMessage(
        `Order #${getOrderIdentifier(order)} status updated successfully.`
      );

      await loadDeadlines();
    } catch (err) {
      console.error("Failed to update order status:", err);

      setError(
        err.response?.data?.message ||
          "Failed to update order status. Please try again."
      );
    } finally {
      setStatusSavingId(null);
    }
  }

  const counts = useMemo(() => {
    const result = {
      OVERDUE: 0,
      DUE_TODAY: 0,
      UPCOMING: 0,
    };

    orders.forEach((order) => {
      const urgency = getUrgency(order);

      if (Object.prototype.hasOwnProperty.call(result, urgency)) {
        result[urgency] += 1;
      }
    });

    return result;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return orders
      .filter((order) => getUrgency(order) === activeFilter)
      .filter((order) => {
        if (!searchTerm) return true;

        const searchableFields = [
          order.order_no,
          order.etsy_no,
          order.customer_name,
          order.product_type,
          order.artist_name,
          order.status,
        ];

        return searchableFields.some((field) =>
          String(field ?? "").toLowerCase().includes(searchTerm)
        );
      })
      .sort((a, b) => {
        const dateA = a.due_date
          ? new Date(a.due_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        const dateB = b.due_date
          ? new Date(b.due_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        return dateA - dateB;
      });
  }, [orders, activeFilter, search]);

  return (
    <div className="min-h-screen bg-[#101116] p-4 text-gray-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Deadline Alerts
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Monitor orders that are overdue, due today, or approaching their
              deadlines.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDeadlines}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#383a45] bg-[#1b1c23] px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-[#252630] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">↻</span>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter.value;

            const colorStyles = {
              red: {
                border: "border-red-500/30",
                number: "text-red-300",
                dot: "bg-red-400",
              },
              amber: {
                border: "border-amber-500/30",
                number: "text-amber-300",
                dot: "bg-amber-400",
              },
              blue: {
                border: "border-blue-500/30",
                number: "text-blue-300",
                dot: "bg-blue-400",
              },
            };

            const colors = colorStyles[filter.color];

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-2xl border bg-[#191a21] p-5 text-left transition hover:bg-[#202129] ${
                  selected ? colors.border : "border-[#2d2e38]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-400">
                    {filter.label}
                  </span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${colors.dot}`}
                  />
                </div>

                <div className={`mt-3 text-3xl font-bold ${colors.number}`}>
                  {counts[filter.value]}
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  {filter.value === "OVERDUE"
                    ? "Orders past their due date"
                    : filter.value === "DUE_TODAY"
                      ? "Orders due today"
                      : "Orders due within 7 days"}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search and filter controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#2d2e38] bg-[#191a21] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeFilter === filter.value
                    ? "bg-blue-600 text-white"
                    : "bg-[#252630] text-gray-400 hover:text-white"
                }`}
              >
                {filter.label}
                <span className="ml-2 text-xs opacity-80">
                  {counts[filter.value]}
                </span>
              </button>
            ))}
          </div>

          <div className="w-full sm:max-w-xs">
            <label htmlFor="deadline-search" className="sr-only">
              Search deadline alerts
            </label>
            <input
              id="deadline-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders, customers, artists..."
              className="w-full rounded-xl border border-[#383a45] bg-[#111218] px-4 py-2.5 text-sm text-gray-200 outline-none placeholder:text-gray-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {/* Successful status update message */}
        {!loading && actionMessage && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          >
            {actionMessage}
          </div>
        )}

        {/* Orders table */}
        <div className="overflow-hidden rounded-2xl border border-[#2d2e38] bg-[#191a21]">
          <div className="flex flex-col gap-1 border-b border-[#2d2e38] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-white">
              {FILTERS.find((filter) => filter.value === activeFilter)?.label}{" "}
              Orders
            </h2>

            <p className="text-xs text-gray-500">
              {filteredOrders.length} order
              {filteredOrders.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">
              Loading deadline alerts...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-sm font-medium text-gray-300">
                No orders found
              </div>
              <p className="mt-2 text-sm text-gray-500">
                There are no matching orders for this filter and search.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-262.5 text-left text-sm">
                <thead className="border-b border-[#2d2e38] bg-[#15161c] text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Order</th>
                    <th className="px-5 py-4 font-medium">Customer</th>
                    <th className="px-5 py-4 font-medium">Product</th>
                    <th className="px-5 py-4 font-medium">Assigned Artist</th>
                    <th className="px-5 py-4 font-medium">Due Date</th>
                    <th className="px-5 py-4 font-medium">Deadline</th>
                    <th className="px-5 py-4 font-medium">Order Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#2d2e38]">
                  {filteredOrders.map((order) => {
                    const urgency = getUrgency(order);

                    return (
                      <tr
                        key={order.id}
                        className="transition hover:bg-[#202129]"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-semibold text-white">
                            #{getOrderIdentifier(order)}
                          </div>

                          {order.etsy_no && (
                            <div className="mt-1 text-xs text-gray-500">
                              Etsy: {order.etsy_no}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-gray-300">
                          {order.customer_name || "—"}
                        </td>

                        <td className="px-5 py-4 text-gray-300">
                          {order.product_type || "—"}
                        </td>

                        <td className="px-5 py-4 text-gray-300">
                          {order.artist_name || "Unassigned"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-gray-300">
                          {formatDate(order.due_date)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                              urgencyStyles[urgency] ||
                              urgencyStyles.LATER
                            }`}
                          >
                            {getDeadlineText(order)}
                          </span>
                        </td>

                        {/* Status badge and dropdown */}
                        <td className="px-5 py-4">
                          <div className="flex min-w-44 flex-col items-start gap-2">
                            <span
                              className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                                statusStyles[order.status] ||
                                "bg-gray-500/15 text-gray-300"
                              }`}
                            >
                              {formatStatus(order.status)}
                            </span>

                            <label
                              htmlFor={`status-${order.id}`}
                              className="sr-only"
                            >
                              Change status for order #
                              {getOrderIdentifier(order)}
                            </label>

                            <select
                              id={`status-${order.id}`}
                              aria-label={`Change status for order #${getOrderIdentifier(
                                order
                              )}`}
                              value={order.status || "INTAKE"}
                              disabled={statusSavingId === order.id}
                              onChange={(event) =>
                                changeStatus(order, event.target.value)
                              }
                              className="w-full rounded-lg border border-[#383a45] bg-[#17181d] px-3 py-2 text-xs text-gray-200 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {STATUS_OPTIONS.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>

                            {statusSavingId === order.id && (
                              <span className="text-xs text-blue-400">
                                Saving status...
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs leading-5 text-gray-500">
          Deadline alerts display orders returned by your backend deadline API.
          Updating an order to Completed or Cancelled may remove it from this
          list because the endpoint excludes closed orders.
        </p>
      </div>
    </div>
  );
}