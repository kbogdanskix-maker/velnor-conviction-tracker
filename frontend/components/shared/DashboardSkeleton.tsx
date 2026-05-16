export default function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="vela-card space-y-3">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-7 w-32 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      ))}
      <div className="md:col-span-3 vela-card h-64 skeleton" />
    </div>
  );
}
