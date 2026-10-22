
import { useEffect, useState } from "react";
import api from "../services/api";

const initialForm = {
  etsy_no: "",
  customer_name: "",
  product_type: "",
  product_size: "L",
  heads_no: 3,
  reworks_no: 0,
  is_repeat: false,
  assigned_to: "",
  due_date: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-700 " +
  "bg-[#303239] p-3 text-white outline-none " +
  "focus:border-blue-500";

export default function NewEntry() {
  const [form, setForm] = useState(initialForm);
  const [artists, setArtists] = useState([]);
  const [artistsError, setArtistsError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load artist options from the backend.
  useEffect(() => {
    let ignore = false;

    async function loadArtists() {
      try {
        const response = await api.get("/artists");

        const rows = Array.isArray(response.data)
          ? response.data
          : response.data?.artists;

        if (!Array.isArray(rows)) {
          throw new Error("Invalid artists API response");
        }

        if (!ignore) {
          setArtists(rows);
          setArtistsError("");
        }
      } catch (err) {
        console.error("Failed to load artists:", err);

        if (!ignore) {
          setArtistsError(
            err.response?.data?.message ||
              "Unable to load artists. Check the artists API."
          );
        }
      }
    }

    loadArtists();

    return () => {
      ignore = true;
    };
  }, []);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await api.post("/orders", {
        ...form,
        heads_no: Number(form.heads_no),
        reworks_no: Number(form.reworks_no),
        assigned_to: form.assigned_to
          ? Number(form.assigned_to)
          : null,
        due_date: form.due_date || null,
      });

      setMessage(
        `Order #${response.data.order_no} created successfully.`
      );

      setForm({ ...initialForm });
    } catch (err) {
      console.error("Failed to create order:", err);

      setError(
        err.response?.data?.message ||
          "Could not create the order."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-[#111216]
        p-5 text-white md:p-8"
    >
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold">
          New Entry
        </h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl
            bg-[#22242a] p-5"
        >
          {/* Etsy Order Number */}
          <div>
            <label className="mb-1 block text-sm">
              Etsy Order Number
            </label>

            <input
              name="etsy_no"
              value={form.etsy_no}
              onChange={updateField}
              className={inputClass}
              placeholder="e.g. G9H1"
            />
          </div>

          {/* Customer Name */}
          <div>
            <label className="mb-1 block text-sm">
              Customer Name *
            </label>

            <input
              required
              name="customer_name"
              value={form.customer_name}
              onChange={updateField}
              className={inputClass}
              placeholder="Enter customer name"
            />
          </div>

          {/* Product Type */}
          <div>
            <label className="mb-1 block text-sm">
              Product Type *
            </label>

            <select
              required
              name="product_type"
              value={form.product_type}
              onChange={updateField}
              className={inputClass}
            >
              <option value="">Select product</option>
              <option value="Pet Portrait">
                Pet Portrait
              </option>
              <option value="Family Drawing">
                Family Drawing
              </option>
              <option value="Character Art">
                Character Art
              </option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Product Size */}
          <div>
            <label className="mb-1 block text-sm">
              Product Size
            </label>

            <select
              name="product_size"
              value={form.product_size}
              onChange={updateField}
              className={inputClass}
            >
              <option value="S">Small</option>
              <option value="M">Medium</option>
              <option value="L">Large</option>
            </select>
          </div>

          {/* Heads and Reworks */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm">
                Number of Heads
              </label>

              <input
                type="number"
                min="1"
                name="heads_no"
                value={form.heads_no}
                onChange={updateField}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">
                Reworks
              </label>

              <input
                type="number"
                min="0"
                name="reworks_no"
                value={form.reworks_no}
                onChange={updateField}
                className={inputClass}
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-1 block text-sm">
              Due Date
            </label>

            <input
              type="date"
              name="due_date"
              value={form.due_date}
              onChange={updateField}
              className={inputClass}
            />
          </div>

          {/* Repeat Order */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_repeat"
              checked={form.is_repeat}
              onChange={updateField}
            />
            Repeat order
          </label>

          {/* Artist Assignment Dropdown */}
          <div>
            <label className="mb-1 block text-sm">
              Assigned Artist
            </label>

            <select
              name="assigned_to"
              value={form.assigned_to}
              onChange={updateField}
              className={inputClass}
            >
              <option value="">Unassigned</option>

              {artists.map((artist) => (
                <option
                  key={artist.id}
                  value={artist.id}
                >
                  {artist.name }
                </option>
              ))}
            </select>

            {artistsError && (
              <p className="mt-1 text-sm text-red-400">
                {artistsError}
              </p>
            )}
          </div>

          {/* Success and Error Messages */}
          {message && (
            <p role="status" className="text-green-400">
              {message}
            </p>
          )}

          {error && (
            <p role="alert" className="text-red-400">
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600
              p-3 font-semibold hover:bg-blue-500
              disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit Entry"}
          </button>
        </form>
      </div>
    </main>
  );
}
