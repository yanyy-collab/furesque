import { useEffect, useState } from "react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";

const EMPTY_ORDER = {
  order_no: "",
  etsy_no: "",
  customer_name: "",
  product_type: "",
  product_size: "",
  heads_no: 1,
  reworks_no: 0,
  is_repeat: 0,
  assigned_to: "",
  due_date: "",
  status: "INTAKE",
};

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

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString();
}

export default function AllOrders() {
  const [orders, setOrders] = useState([]);
  const [artists, setArtists] = useState([]);
  const [artistsError, setArtistsError] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState(null);

  const [editingOrder, setEditingOrder] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Revision tracking state
  const [revisionOrder, setRevisionOrder] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [resolvingRevisionId, setResolvingRevisionId] = useState(null);
  const [revisionError, setRevisionError] = useState("");
  const [revisionMessage, setRevisionMessage] = useState("");

  // Load orders
  useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/orders", {
          params: {
            search,
            page,
            limit: 5,
          },
        });

        const rows = Array.isArray(response.data)
          ? response.data
          : response.data?.orders;

        if (!Array.isArray(rows)) {
          throw new Error("Unexpected orders API response");
        }

        if (!ignore) {
          setOrders(rows);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load orders:", err);
          setError(
            err.response?.data?.message ||
              "Failed to load orders."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      ignore = true;
    };
  }, [search, page, refreshKey]);

  // Load artists
  useEffect(() => {
    let ignore = false;

    async function loadArtists() {
      try {
        const response = await api.get("/artists");

        const rows = Array.isArray(response.data)
          ? response.data
          : response.data?.artists;

        if (!Array.isArray(rows)) {
          throw new Error("Unexpected artists API response");
        }

        if (!ignore) {
          setArtists(rows);
          setArtistsError("");
        }
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load artists:", err);
          setArtistsError(
            err.response?.data?.message ||
              "Could not load artists. Check the artists API."
          );
        }
      }
    }

    loadArtists();

    return () => {
      ignore = true;
    };
  }, []);

  function updateField(field, value) {
    setEditingOrder((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditing(order) {
    setActionMessage("");
    setError("");

    setEditingOrder({
      ...EMPTY_ORDER,
      ...order,
      due_date: order.due_date
        ? String(order.due_date).slice(0, 10)
        : "",
      etsy_no: order.etsy_no || "",
      product_size: order.product_size || "",
      heads_no: order.heads_no ?? 1,
      reworks_no: order.reworks_no ?? 0,
      is_repeat: order.is_repeat ?? 0,
      assigned_to:
        order.assigned_to == null
          ? ""
          : String(order.assigned_to),
    });
  }

  async function saveOrder(event) {
    event.preventDefault();

    if (!editingOrder) return;

    setSavingOrder(true);
    setError("");
    setActionMessage("");

    try {
      const payload = {
        ...editingOrder,
        heads_no: Number(editingOrder.heads_no),
        reworks_no: Number(editingOrder.reworks_no),
        is_repeat: Number(editingOrder.is_repeat),
        assigned_to:
          editingOrder.assigned_to === ""
            ? null
            : Number(editingOrder.assigned_to),
        due_date: editingOrder.due_date || null,
      };

      await api.put(`/orders/${editingOrder.id}`, payload);

      setEditingOrder(null);
      setActionMessage("Order updated successfully.");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("Failed to update order:", err);

      setError(
        err.response?.data?.message ||
          "Failed to update order."
      );
    } finally {
      setSavingOrder(false);
    }
  }

  async function changeStatus(order, newStatus) {
    if (newStatus === order.status) return;

    setError("");
    setActionMessage("");
    setStatusSavingId(order.id);

    try {
      await api.patch(`/orders/${order.id}/status`, {
        status: newStatus,
      });

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? { ...item, status: newStatus }
            : item
        )
      );

      setActionMessage(
        `Order #${order.order_no ?? order.id} status updated.`
      );

      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("Failed to update order status:", err);

      setError(
        err.response?.data?.message ||
          "Failed to update order status."
      );
    } finally {
      setStatusSavingId(null);
    }
  }

  async function deleteOrder(order) {
    const confirmed = window.confirm(
      `Permanently delete order #${order.order_no ?? order.id}?`
    );

    if (!confirmed) return;

    setError("");
    setActionMessage("");

    try {
      await api.delete(`/orders/${order.id}`);

      setActionMessage("Order deleted successfully.");

      if (revisionOrder?.id === order.id) {
        closeRevisionHistory();
      }

      if (orders.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((key) => key + 1);
      }
    } catch (err) {
      console.error("Failed to delete order:", err);

      setError(
        err.response?.data?.message ||
          "Failed to delete order."
      );
    }
  }

  // Open revision history for an order
  async function openRevisionHistory(order) {
    setRevisionOrder(order);
    setRevisions([]);
    setRevisionNote("");
    setRevisionError("");
    setRevisionMessage("");
    setRevisionLoading(true);

    try {
      const response = await api.get(
        `/revisions/order/${order.id}`
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.revisions;

      if (!Array.isArray(rows)) {
        throw new Error("Unexpected revision API response");
      }

      setRevisions(rows);
    } catch (err) {
      console.error("Failed to load revisions:", err);

      setRevisionError(
        err.response?.data?.message ||
          "Failed to load revision history."
      );
    } finally {
      setRevisionLoading(false);
    }
  }

  function closeRevisionHistory() {
    setRevisionOrder(null);
    setRevisions([]);
    setRevisionNote("");
    setRevisionError("");
    setRevisionMessage("");
  }

  // Add a revision note
  async function addRevision(event) {
    event.preventDefault();

    if (!revisionOrder || !revisionNote.trim()) {
      setRevisionError("Please enter a revision note.");
      return;
    }

    setRevisionSaving(true);
    setRevisionError("");
    setRevisionMessage("");

    try {
      await api.post("/revisions", {
        order_id: revisionOrder.id,
        revision_note: revisionNote.trim(),
      });

      setRevisionNote("");
      setRevisionMessage("Revision note added successfully.");

      // Reload revision history after saving
      const response = await api.get(
        `/revisions/order/${revisionOrder.id}`
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.revisions;

      setRevisions(Array.isArray(rows) ? rows : []);

      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("Failed to add revision:", err);

      setRevisionError(
        err.response?.data?.message ||
          "Failed to add revision note."
      );
    } finally {
      setRevisionSaving(false);
    }
  }

  // Mark a revision as resolved
  async function resolveRevision(revisionId) {
    setResolvingRevisionId(revisionId);
    setRevisionError("");
    setRevisionMessage("");

    try {
      await api.patch(
        `/revisions/${revisionId}/resolve`
      );

      setRevisionMessage("Revision marked as resolved.");

      const response = await api.get(
        `/revisions/order/${revisionOrder.id}`
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.revisions;

      setRevisions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Failed to resolve revision:", err);

      setRevisionError(
        err.response?.data?.message ||
          "Failed to resolve revision."
      );
    } finally {
      setResolvingRevisionId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#111216] p-5 text-white md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">All Orders</h1>

        <span className="text-sm text-gray-400">
          Page {page}
        </span>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search customer, Etsy number, or order..."
        className="mb-5 w-full rounded-lg bg-[#25272d] p-3 outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Main messages */}
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-950 p-3 text-red-300"
        >
          {error}
        </p>
      )}

      {actionMessage && (
        <p
          role="status"
          className="mb-3 rounded-lg bg-green-950 p-3 text-green-300"
        >
          {actionMessage}
        </p>
      )}

      {loading && (
        <p className="mb-3 text-sm text-gray-400">
          Loading orders...
        </p>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="flex flex-col justify-between gap-4 rounded-xl bg-[#25272d] p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-400">
                Order #{order.order_no ?? order.id} ·{" "}
                {order.customer_name}
              </p>

              <h2 className="mt-1 font-semibold">
                {order.product_type}
                {order.product_size
                  ? ` (${order.product_size})`
                  : ""}
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Artist: {order.artist_name || "Unassigned"}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Due:{" "}
                {order.due_date
                  ? String(order.due_date).slice(0, 10)
                  : "Not set"}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Reworks: {order.reworks_no ?? 0}
              </p>
            </div>

            {/* Status controls */}
            <div className="flex flex-col gap-2 sm:min-w-44">
              <StatusBadge status={order.status} />

              <select
                aria-label={`Change status for order ${
                  order.order_no ?? order.id
                }`}
                value={order.status || "INTAKE"}
                disabled={statusSavingId === order.id}
                onChange={(event) =>
                  changeStatus(order, event.target.value)
                }
                className="w-full rounded-lg border border-gray-600 bg-[#111216] px-3 py-2 text-sm disabled:opacity-50"
              >
                {STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {statusSavingId === order.id && (
                <span className="text-xs text-gray-400">
                  Saving status...
                </span>
              )}
            </div>

            {/* Order actions */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openRevisionHistory(order)}
                className="rounded-lg bg-purple-700 px-3 py-2 text-sm hover:bg-purple-600"
              >
                Revisions
              </button>

              <button
                type="button"
                onClick={() => startEditing(order)}
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm hover:bg-blue-600"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => deleteOrder(order)}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </article>
        ))}

        {!loading && orders.length === 0 && !error && (
          <p className="rounded-xl bg-[#25272d] p-5 text-gray-400">
            No matching orders found.
          </p>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => current - 1)}
          className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-40"
        >
          Previous
        </button>

        <span className="text-sm text-gray-400">
          Page {page}
        </span>

        <button
          type="button"
          disabled={orders.length < 5}
          onClick={() => setPage((current) => current + 1)}
          className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* Edit order modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <form
            onSubmit={saveOrder}
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#1b1d23] p-5 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Edit Order #{editingOrder.order_no}
              </h2>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="rounded-lg px-3 py-2 text-gray-300 hover:bg-gray-700"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">
                Etsy Number
                <input
                  value={editingOrder.etsy_no ?? ""}
                  onChange={(event) =>
                    updateField("etsy_no", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Customer Name
                <input
                  required
                  value={editingOrder.customer_name ?? ""}
                  onChange={(event) =>
                    updateField("customer_name", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Product Type
                <input
                  required
                  value={editingOrder.product_type ?? ""}
                  onChange={(event) =>
                    updateField("product_type", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Product Size
                <input
                  value={editingOrder.product_size ?? ""}
                  onChange={(event) =>
                    updateField("product_size", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Number of Heads
                <input
                  type="number"
                  min="1"
                  required
                  value={editingOrder.heads_no}
                  onChange={(event) =>
                    updateField("heads_no", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Number of Reworks
                <input
                  type="number"
                  min="0"
                  required
                  value={editingOrder.reworks_no}
                  onChange={(event) =>
                    updateField("reworks_no", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Assigned Artist
                <select
                  value={editingOrder.assigned_to ?? ""}
                  onChange={(event) =>
                    updateField("assigned_to", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>

                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name ??
                        artist.full_name ??
                        `Artist #${artist.id}`}
                    </option>
                  ))}
                </select>

                {artistsError && (
                  <span className="mt-1 block text-xs text-red-400">
                    {artistsError}
                  </span>
                )}
              </label>

              <label className="text-sm text-gray-300">
                Due Date
                <input
                  type="date"
                  value={editingOrder.due_date ?? ""}
                  onChange={(event) =>
                    updateField("due_date", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="text-sm text-gray-300">
                Repeat Order
                <select
                  value={String(editingOrder.is_repeat ?? 0)}
                  onChange={(event) =>
                    updateField("is_repeat", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="rounded-lg bg-gray-700 px-4 py-2 hover:bg-gray-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingOrder}
                className="rounded-lg bg-blue-700 px-4 py-2 hover:bg-blue-600 disabled:opacity-50"
              >
                {savingOrder ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revision history modal */}
      {revisionOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="revision-title"
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#1b1d23] p-5 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="revision-title"
                  className="text-xl font-bold"
                >
                  Revision History
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Order #{revisionOrder.order_no ?? revisionOrder.id}
                  {" · "}
                  {revisionOrder.customer_name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRevisionHistory}
                className="rounded-lg px-3 py-2 text-gray-300 hover:bg-gray-700"
              >
                Close
              </button>
            </div>

            {/* Revision messages */}
            {revisionError && (
              <p
                role="alert"
                className="mb-3 rounded-lg bg-red-950 p-3 text-sm text-red-300"
              >
                {revisionError}
              </p>
            )}

            {revisionMessage && (
              <p
                role="status"
                className="mb-3 rounded-lg bg-green-950 p-3 text-sm text-green-300"
              >
                {revisionMessage}
              </p>
            )}

            {/* Add revision */}
            <form onSubmit={addRevision} className="mb-6">
              <label
                htmlFor="revision-note"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Add Revision Note
              </label>

              <textarea
                id="revision-note"
                required
                rows={3}
                maxLength={5000}
                value={revisionNote}
                onChange={(event) =>
                  setRevisionNote(event.target.value)
                }
                placeholder="Example: Change the background color to blue."
                className="w-full rounded-lg bg-[#111216] p-3 outline-none focus:ring-2 focus:ring-purple-500"
              />

              <button
                type="submit"
                disabled={revisionSaving || !revisionNote.trim()}
                className="mt-3 rounded-lg bg-purple-700 px-4 py-2 hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revisionSaving ? "Saving..." : "Add Revision"}
              </button>
            </form>

            <div className="border-t border-gray-700 pt-5">
              <h3 className="mb-3 font-semibold">
                Previous Revisions
              </h3>

              {revisionLoading && (
                <p className="text-sm text-gray-400">
                  Loading revision history...
                </p>
              )}

              {!revisionLoading && revisions.length === 0 && !revisionError && (
                <p className="rounded-lg bg-[#25272d] p-4 text-sm text-gray-400">
                  No revision notes have been recorded for this order.
                </p>
              )}

              <div className="space-y-3">
                {revisions.map((revision) => {
                  const resolved = revision.status === "RESOLVED";

                  return (
                    <article
                      key={revision.id}
                      className="rounded-xl border border-gray-700 bg-[#25272d] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-gray-400">
                          Revision #{revision.id}
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            resolved
                              ? "bg-green-950 text-green-300"
                              : "bg-yellow-950 text-yellow-300"
                          }`}
                        >
                          {resolved ? "Resolved" : "Pending"}
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap wrap-break text-sm text-gray-200">
                        {revision.revision_note}
                      </p>

                      <p className="mt-3 text-xs text-gray-400">
                        Requested: {formatDate(revision.requested_at)}
                      </p>

                      {revision.resolved_at && (
                        <p className="mt-1 text-xs text-gray-400">
                          Resolved: {formatDate(revision.resolved_at)}
                        </p>
                      )}

                      {!resolved && (
                        <button
                          type="button"
                          disabled={resolvingRevisionId === revision.id}
                          onClick={() =>
                            resolveRevision(revision.id)
                          }
                          className="mt-3 rounded-lg bg-green-700 px-3 py-2 text-sm hover:bg-green-600 disabled:opacity-50"
                        >
                          {resolvingRevisionId === revision.id
                            ? "Updating..."
                            : "Mark as Resolved"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}