import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="font-display text-6xl font-extrabold text-accent">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted">The page you’re looking for doesn’t exist.</p>
        <Link href="/" className="btn-primary mt-8 inline-flex">Return to Home</Link>
      </div>
    </div>
  );
}
