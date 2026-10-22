
import { useEffect, useState } from "react";
import api from "../services/api";

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/activity");
      setActivities(response.data.activities || []);
    } catch (err) {
      console.error("Activity Log error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load activity logs. Check the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  return (
    <div className="min-h-screen bg-[#202127] p-6 text-white">
      <h1 className="mb-2 text-2xl font-bold">Activity Log</h1>
      <p className="mb-6 text-gray-400">
        Track recorded order changes and system activities.
      </p>

      <button
        onClick={loadActivities}
        disabled={loading}
        className="mb-4 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-500"
      >
        {loading ? "Loading..." : "Refresh Activity"}
      </button>

      {error && (
        <p className="mb-4 rounded bg-red-900 p-3 text-red-200">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-left">
          <thead className="bg-[#303239]">
            <tr>
              <th className="p-3">Date &amp; Time</th>
              <th className="p-3">Order ID</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-4 text-center">
                  Loading activity...
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              activities.map((item) => (
                <tr key={item.id} className="border-t border-gray-700">
                  <td className="p-3">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-3">{item.order_id ?? "—"}</td>
                  <td className="p-3">{item.actor || "System"}</td>
                  <td className="p-3">{item.action}</td>
                  <td className="p-3">{item.details || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
