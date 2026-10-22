
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

function downloadCSV(filename, rows) {
  if (!rows.length) {
    alert("There is no data to export.");
    return;
  }

  const columns = Object.keys(rows[0]);

  const escapeCSV = (value) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    columns.map(escapeCSV).join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCSV(row[column])).join(",")
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState({
    summary: {
      totalOrders: 0,
      completedOrders: 0,
      activeOrders: 0,
      cancelledOrders: 0,
    },
    artistStats: [],
    orders: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reports", {
        params: {
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
      });

      setReport(response.data);
    } catch (err) {
      console.error("Reports request failed:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load reports. Check the backend API."
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const exportOrders = () => {
    const rows = report.orders.map((order) => ({
      Order_ID: order.id,
      Etsy_Number: order.etsy_no,
      Customer: order.customer_name,
      Product: order.product_type,
      Artist: order.artist_name || "Unassigned",
      Status: order.status,
      Due_Date: order.due_date || "",
      Created_At: order.created_at || "",
    }));

    downloadCSV("furesque-orders-report.csv", rows);
  };

  const exportArtists = () => {
    const rows = report.artistStats.map((artist) => ({
      Artist: artist.artist_name,
      Total_Orders: artist.total_orders,
      Completed_Orders: artist.completed_orders,
      Active_Orders: artist.active_orders,
    }));

    downloadCSV("furesque-artist-productivity.csv", rows);
  };

  const summaryCards = [
    ["Total Orders", report.summary.totalOrders],
    ["Completed", report.summary.completedOrders],
    ["Active", report.summary.activeOrders],
    ["Cancelled", report.summary.cancelledOrders],
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 text-white md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Reports & Export</h1>
        <p className="mt-1 text-sm text-gray-400">
          Review order totals and artist productivity, then export your data.
        </p>
      </div>

      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-800 bg-[#18191e] p-4">
        <label className="flex flex-col gap-2 text-sm text-gray-300">
          Start date
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-[#25262d] p-2 text-white"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-gray-300">
          End date
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-[#25262d] p-2 text-white"
          />
        </label>

        <button
          onClick={loadReports}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Report"}
        </button>

        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
          }}
          className="rounded-lg border border-gray-700 px-4 py-2 hover:bg-gray-800"
        >
          Clear Dates
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-200">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-gray-800 bg-[#18191e] p-5"
          >
            <p className="text-sm text-gray-400">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-800 bg-[#18191e]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-lg font-semibold">Artist Productivity</h2>
            <p className="text-sm text-gray-400">
              Order counts for the selected creation-date range.
            </p>
          </div>
          <button
            onClick={exportArtists}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm hover:bg-emerald-600"
          >
            Export Artist CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#25262d] text-gray-300">
              <tr>
                <th className="p-3">Artist</th>
                <th className="p-3">Total</th>
                <th className="p-3">Completed</th>
                <th className="p-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {report.artistStats.map((artist) => (
                <tr
                  key={artist.artist_name}
                  className="border-t border-gray-800"
                >
                  <td className="p-3">{artist.artist_name}</td>
                  <td className="p-3">{artist.total_orders}</td>
                  <td className="p-3">{artist.completed_orders}</td>
                  <td className="p-3">{artist.active_orders}</td>
                </tr>
              ))}
              {!report.artistStats.length && (
                <tr>
                  <td colSpan="4" className="p-5 text-center text-gray-400">
                    No artist data for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-800 bg-[#18191e]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-lg font-semibold">Order Summary</h2>
            <p className="text-sm text-gray-400">
              {report.orders.length} orders in the current report.
            </p>
          </div>
          <button
            onClick={exportOrders}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm hover:bg-blue-600"
          >
            Export Orders CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#25262d] text-gray-300">
              <tr>
                <th className="p-3">Etsy No.</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Product</th>
                <th className="p-3">Artist</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {report.orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-800">
                  <td className="p-3">{order.etsy_no || order.id}</td>
                  <td className="p-3">{order.customer_name || "—"}</td>
                  <td className="p-3">{order.product_type || "—"}</td>
                  <td className="p-3">{order.artist_name || "Unassigned"}</td>
                  <td className="p-3">{order.status || "—"}</td>
                  <td className="p-3">{order.due_date || "—"}</td>
                </tr>
              ))}
              {!report.orders.length && (
                <tr>
                  <td colSpan="6" className="p-5 text-center text-gray-400">
                    No orders found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
