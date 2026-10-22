
const styles = {
  INTAKE: "bg-slate-600 text-white",
  ARTIST_QUEUE: "bg-blue-700 text-white",
  IN_PROGRESS: "bg-emerald-600 text-white",
  PROOF_REVISION: "bg-amber-400 text-black",
  REVISION_PENDING: "bg-amber-400 text-black",
  FINAL_DELIVERY: "bg-indigo-600 text-white",
  COMPLETED: "bg-green-700 text-white",
  CANCELLED: "bg-gray-600 text-white",
};

export default function StatusBadge({ status }) {
  const label = (status || "INTAKE")
    .replaceAll("_", " ");

  return (
    <span className={`inline-block rounded-lg px-3 py-1
      text-xs font-bold ${styles[status] || styles.INTAKE}`}>
      {label}
    </span>
  );
}
