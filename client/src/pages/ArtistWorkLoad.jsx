
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

function StatCard({ title, value, description, accent }) {
  const accents = {
    blue: "text-blue-300 border-blue-500/30",
    green: "text-emerald-300 border-emerald-500/30",
    red: "text-red-300 border-red-500/30",
    purple: "text-purple-300 border-purple-500/30",
  };

  return (
    <div
      className={`rounded-2xl border bg-[#191a21] p-5 ${
        accents[accent] || accents.blue
      }`}
    >
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>
  );
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isOverdue(order) {
  if (
    !order.due_date ||
    ["COMPLETED", "CANCELLED"].includes(order.status)
  ) {
    return false;
  }

  // Compare calendar dates, not timestamps.
  const dueDate = String(order.due_date).slice(0, 10);
  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return dueDate < todayString;
}

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

export default function ArtistWorkload() {
  const [artists, setArtists] = useState([]);
  const [selectedArtistId, setSelectedArtistId] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadWorkload = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/orders/workload");
      const data = response.data.artists;

      setArtists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load artist workload:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load artist workload. Check your backend API."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkload();
  }, [loadWorkload, refreshKey]);

  const totals = useMemo(() => {
    return artists.reduce(
      (result, artist) => {
        result.assigned += Number(artist.assigned_orders || 0);
        result.completed += Number(artist.completed_orders || 0);
        result.active += Number(artist.active_orders || 0);
        result.overdue += Number(artist.overdue_orders || 0);
        return result;
      },
      { assigned: 0, completed: 0, active: 0, overdue: 0 }
    );
  }, [artists]);

  const maxActive = useMemo(() => {
    return Math.max(
      1,
      ...artists.map((artist) => Number(artist.active_orders || 0))
    );
  }, [artists]);

  const filteredArtists = useMemo(() => {
    const term = search.trim().toLowerCase();

    return artists.filter((artist) => {
      const matchesArtist =
        selectedArtistId === "all" ||
        String(artist.artist_id) === selectedArtistId;

      const matchesSearch =
        !term ||
        String(artist.artist_name || "").toLowerCase().includes(term);

      return matchesArtist && matchesSearch;
    });
  }, [artists, selectedArtistId, search]);

  const selectedArtist = useMemo(() => {
    if (selectedArtistId === "all") return null;

    return (
      artists.find(
        (artist) => String(artist.artist_id) === selectedArtistId
      ) || null
    );
  }, [artists, selectedArtistId]);

  const [detailOrders, setDetailOrders] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadArtistOrders = useCallback(async () => {
    if (!selectedArtist) {
      setDetailOrders([]);
      setDetailError("");
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    setDetailError("");

    try {
      // Reuse the existing orders API and filter its results by artist.
      // Fetch pages until the API has returned all orders.
      const limit = 100;
      const firstResponse = await api.get("/orders", {
        params: { page: 1, limit },
      });

      const firstData = firstResponse.data;
      let allOrders = Array.isArray(firstData.orders)
        ? firstData.orders
        : [];

      const totalPages = Number(firstData.totalPages || 1);

      for (let page = 2; page <= totalPages; page += 1) {
        const response = await api.get("/orders", {
          params: { page, limit },
        });

        if (Array.isArray(response.data.orders)) {
          allOrders = allOrders.concat(response.data.orders);
        }
      }

      const matchingOrders = allOrders.filter(
        (order) =>
          String(order.assigned_to) === String(selectedArtist.artist_id)
      );

      setDetailOrders(matchingOrders);
    } catch (err) {
      console.error("Failed to load artist orders:", err);

      setDetailError(
        err.response?.data?.message ||
          "Unable to load this artist's orders."
      );
    } finally {
      setDetailLoading(false);
    }
  }, [selectedArtist]);

  useEffect(() => {
    loadArtistOrders();
  }, [loadArtistOrders]);

  return (
    <div className="min-h-screen bg-[#101116] p-4 text-gray-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Artist Workload
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Monitor assignments, completed orders, overdue work, and workload balance.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="rounded-xl border border-[#383a45] bg-[#1b1c23] px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-[#252630] disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Assigned Orders"
            value={totals.assigned}
            description="All orders assigned to artists"
            accent="blue"
          />
          <StatCard
            title="Active Orders"
            value={totals.active}
            description="Orders not completed or cancelled"
            accent="purple"
          />
          <StatCard
            title="Completed Tasks"
            value={totals.completed}
            description="Orders marked completed"
            accent="green"
          />
          <StatCard
            title="Overdue Work"
            value={totals.overdue}
            description="Active orders past their due date"
            accent="red"
          />
        </div>

        {/* Search and artist filter */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#2d2e38] bg-[#191a21] p-4 sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search artist name..."
            className="w-full rounded-xl border border-[#383a45] bg-[#111218] px-4 py-2.5 text-sm text-gray-200 outline-none placeholder:text-gray-500 focus:border-blue-500"
          />

          <select
            value={selectedArtistId}
            onChange={(event) => setSelectedArtistId(event.target.value)}
            className="w-full rounded-xl border border-[#383a45] bg-[#111218] px-4 py-2.5 text-sm text-gray-200 outline-none focus:border-blue-500 sm:max-w-xs"
          >
            <option value="all">All artists</option>
            {artists.map((artist) => (
              <option
                key={artist.artist_id}
                value={String(artist.artist_id)}
              >
                {artist.artist_name}
              </option>
            ))}
          </select>
        </div>

        {/* Errors */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {/* Workload balance */}
        <section className="rounded-2xl border border-[#2d2e38] bg-[#191a21] p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Workload Balance</h2>
            <p className="mt-1 text-xs text-gray-500">
              Bars compare active orders across artists. A longer bar means more active assignments.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading workload...</p>
          ) : filteredArtists.length === 0 ? (
            <p className="text-sm text-gray-500">No artists found.</p>
          ) : (
            <div className="space-y-5">
              {filteredArtists.map((artist) => {
                const active = Number(artist.active_orders || 0);
                const width = (active / maxActive) * 100;

                return (
                  <div key={artist.artist_id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        {artist.artist_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {active} active · {Number(artist.overdue_orders || 0)} overdue
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-[#30313b]">
                      <div
                        className={`h-full rounded-full ${
                          Number(artist.overdue_orders || 0) > 0
                            ? "bg-red-400"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Artist overview table */}
        <section className="overflow-hidden rounded-2xl border border-[#2d2e38] bg-[#191a21]">
          <div className="border-b border-[#2d2e38] px-5 py-4">
            <h2 className="font-semibold text-white">Artist Performance</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">
              Loading artists...
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No artist records found. Check that your users table has artists.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-175 text-left text-sm">
                <thead className="border-b border-[#2d2e38] bg-[#15161c] text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Artist</th>
                    <th className="px-5 py-4 font-medium">Assigned</th>
                    <th className="px-5 py-4 font-medium">Active</th>
                    <th className="px-5 py-4 font-medium">Completed</th>
                    <th className="px-5 py-4 font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2e38]">
                  {filteredArtists.map((artist) => (
                    <tr
                      key={artist.artist_id}
                      className="cursor-pointer transition hover:bg-[#202129]"
                      onClick={() =>
                        setSelectedArtistId(String(artist.artist_id))
                      }
                    >
                      <td className="px-5 py-4 font-medium text-white">
                        {artist.artist_name}
                      </td>
                      <td className="px-5 py-4 text-gray-300">
                        {Number(artist.assigned_orders || 0)}
                      </td>
                      <td className="px-5 py-4 text-blue-300">
                        {Number(artist.active_orders || 0)}
                      </td>
                      <td className="px-5 py-4 text-emerald-300">
                        {Number(artist.completed_orders || 0)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                            Number(artist.overdue_orders || 0) > 0
                              ? "bg-red-500/10 text-red-300"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {Number(artist.overdue_orders || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Selected artist orders */}
        <section className="overflow-hidden rounded-2xl border border-[#2d2e38] bg-[#191a21]">
          <div className="border-b border-[#2d2e38] px-5 py-4">
            <h2 className="font-semibold text-white">
              {selectedArtist
                ? `Orders assigned to ${selectedArtist.artist_name}`
                : "Artist Order Details"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {selectedArtist
                ? "Orders assigned to the selected artist."
                : "Select an artist from the table or dropdown to see their orders."}
            </p>
          </div>

          {!selectedArtist ? (
            <div className="p-8 text-sm text-gray-500">
              Choose an artist to view their assigned orders.
            </div>
          ) : detailLoading ? (
            <div className="p-8 text-sm text-gray-400">
              Loading assigned orders...
            </div>
          ) : detailError ? (
            <div role="alert" className="p-8 text-sm text-red-300">
              {detailError}
            </div>
          ) : detailOrders.length === 0 ? (
            <div className="p-8 text-sm text-gray-500">
              No orders are assigned to this artist.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-187.5 text-left text-sm">
                <thead className="border-b border-[#2d2e38] bg-[#15161c] text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Order</th>
                    <th className="px-5 py-4 font-medium">Customer</th>
                    <th className="px-5 py-4 font-medium">Product</th>
                    <th className="px-5 py-4 font-medium">Due Date</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2e38]">
                  {detailOrders.map((order) => {
                    const overdue = isOverdue(order);

                    return (
                      <tr key={order.id} className="hover:bg-[#202129]">
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-white">
                          #{order.order_no ?? order.id}
                        </td>
                        <td className="px-5 py-4 text-gray-300">
                          {order.customer_name || "—"}
                        </td>
                        <td className="px-5 py-4 text-gray-300">
                          {order.product_type || "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-300">
                          {formatDate(order.due_date)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                              statusStyles[order.status] ||
                              "bg-gray-500/15 text-gray-300"
                            }`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {overdue ? (
                            <span className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300">
                              Overdue
                            </span>
                          ) : ["COMPLETED", "CANCELLED"].includes(
                              order.status
                            ) ? (
                            <span className="text-xs text-gray-500">
                              Closed
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-300">
                              On track
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
