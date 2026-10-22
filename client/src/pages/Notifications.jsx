
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const READ_STORAGE_KEY = "furesque_notification_read_states";

const REVISION_STATUSES = ["PROOF_REVISION", "REVISION_PENDING"];

function getReadStates() {
  try {
    return JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveReadStates(states) {
  localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(states));
}

function getOrderId(order) {
  return order.id ?? order.order_id;
}

function getDateOnly(value) {
  if (!value) return null;

  const date = String(value).slice(0, 10);
  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function getDaysUntil(value) {
  const dueDate = getDateOnly(value);
  if (!dueDate) return null;

  return Math.round((dueDate - getToday()) / 86400000);
}

function getOrderName(order) {
  return (
    order.etsy_no ||
    order.order_number ||
    order.customer_name ||
    `Order #${getOrderId(order)}`
  );
}

function getNotificationType(order) {
  const status = String(order.status || "").toUpperCase();

  if (REVISION_STATUSES.includes(status)) {
    return "revision";
  }

  const days = getDaysUntil(order.due_date);

  if (days !== null && days < 0 &&
      !["COMPLETED", "CANCELLED"].includes(status)) {
    return "overdue";
  }

  if (
    days !== null &&
    days >= 0 &&
    days <= 3 &&
    !["COMPLETED", "CANCELLED"].includes(status)
  ) {
    return "deadline";
  }

  return null;
}

function buildNotification(order) {
  const type = getNotificationType(order);
  if (!type) return null;

  const id = getOrderId(order);
  const name = getOrderName(order);
  const days = getDaysUntil(order.due_date);

  const details = {
    overdue: {
      title: "Overdue order",
      message: `${name} is past its due date.`,
      color: "border-red-500/40 bg-red-500/10 text-red-300",
    },
    deadline: {
      title: "Approaching deadline",
      message:
        days === 0
          ? `${name} is due today.`
          : `${name} is due in ${days} day${days === 1 ? "" : "s"}.`,
      color: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    },
    revision: {
      title: "Pending revision",
      message: `${name} needs revision follow-up.`,
      color: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    },
  };

  return {
    id: `${type}-${id}`,
    orderId: id,
    type,
    status: order.status || "Unknown",
    dueDate: order.due_date,
    artist: order.artist_name || "Unassigned",
    ...details[type],
  };
}

export default function Notifications() {
  const [orders, setOrders] = useState([]);
  const [readStates, setReadStates] = useState(getReadStates);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/orders", {
        params: { page: 1, limit: 100 },
      });

      const result = response.data;
      const orderList = Array.isArray(result)
        ? result
        : result.orders;

      if (!Array.isArray(orderList)) {
        throw new Error("The orders API did not return an orders array.");
      }

      setOrders(orderList);
    } catch (err) {
      console.error("Notification loading error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const notifications = useMemo(() => {
    return orders
      .map(buildNotification)
      .filter(Boolean)
      .sort((a, b) => {
        const priority = {
          overdue: 0,
          deadline: 1,
          revision: 2,
        };

        return priority[a.type] - priority[b.type];
      });
  }, [orders]);

  const unreadCount = notifications.filter(
    (item) => !readStates[item.id]
  ).length;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === "unread") return !readStates[item.id];
    if (filter === "read") return Boolean(readStates[item.id]);
    return true;
  });

  function toggleRead(notificationId) {
    setReadStates((previous) => {
      const next = {
        ...previous,
        [notificationId]: !previous[notificationId],
      };

      saveReadStates(next);
      return next;
    });
  }

  function markAllAsRead() {
    const next = { ...readStates };

    notifications.forEach((item) => {
      next[item.id] = true;
    });

    saveReadStates(next);
    setReadStates(next);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 pb-10 text-white md:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            Notification Center
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Track deadlines, overdue orders, and pending revisions.
          </p>
        </div>

        <button
          onClick={loadNotifications}
          disabled={loading}
          className="rounded-lg border border-gray-700 px-4 py-2
            text-sm transition hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-[#18191e] p-5">
          <p className="text-sm text-gray-400">Total notifications</p>
          <p className="mt-2 text-3xl font-bold">
            {notifications.length}
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-[#18191e] p-5">
          <p className="text-sm text-gray-400">Unread notifications</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">
            {unreadCount}
          </p>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-[#18191e] p-5">
          <p className="text-sm text-gray-400">Overdue orders</p>
          <p className="mt-2 text-3xl font-bold text-red-400">
            {notifications.filter((item) => item.type === "overdue").length}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-[#18191e] p-4 md:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
              { value: "read", label: "Read" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-lg px-4 py-2 text-sm ${
                  filter === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-[#303239] text-gray-300 hover:bg-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm
              hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark all as read
          </button>
        </div>

        {loading && (
          <p className="py-8 text-center text-gray-400">
            Loading notifications...
          </p>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300">{error}</p>
            <button
              onClick={loadNotifications}
              className="mt-3 text-sm text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && filteredNotifications.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-lg font-semibold">No notifications found</p>
            <p className="mt-2 text-sm text-gray-400">
              There are no notifications for this filter.
            </p>
          </div>
        )}

        {!loading && !error && filteredNotifications.length > 0 && (
          <div className="space-y-3">
            {filteredNotifications.map((item) => {
              const isRead = Boolean(readStates[item.id]);

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border p-4 ${
                    isRead
                      ? "border-gray-800 bg-[#202127]"
                      : "border-blue-500/30 bg-blue-500/5"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex gap-3">
                      <span
                        className={`h-fit rounded-lg border px-3 py-1 text-xs font-semibold ${item.color}`}
                      >
                        {item.title}
                      </span>

                      {!isRead && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-400" />
                      )}
                    </div>

                    <button
                      onClick={() => toggleRead(item.id)}
                      className="text-left text-sm text-blue-300 hover:text-blue-200 sm:text-right"
                    >
                      Mark as {isRead ? "unread" : "read"}
                    </button>
                  </div>

                  <p className="mt-3 font-semibold">{item.message}</p>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
                    <span>Artist: {item.artist}</span>
                    <span>Status: {item.status}</span>
                    {item.dueDate && (
                      <span>
                        Due: {String(item.dueDate).slice(0, 10)}
                      </span>
                    )}
                  </div>

                  <Link
                    to="/orders"
                    className="mt-4 inline-block text-sm text-blue-400 hover:underline"
                  >
                    View orders
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
