/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev server and `next build` both own `.next` by default, so a build run
  // while `./dev.sh` is up corrupts the dev cache. Set NEXT_DIST_DIR to give a
  // one-off build its own output dir and leave the running dev server alone:
  //   NEXT_DIST_DIR=.next-verify npx next build
  // Caveat: Next rewrites tsconfig.json + next-env.d.ts to point at whichever
  // distDir it just built, so `git checkout` those two afterwards.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
