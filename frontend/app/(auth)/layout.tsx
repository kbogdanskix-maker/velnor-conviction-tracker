export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-vela-bg atmospheric-bg noise-overlay">
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
