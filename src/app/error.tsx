"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  // Never render raw error details to the user.
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted">An unexpected error occurred. Please try again.</p>
        <button onClick={reset} className="btn-primary mt-8">Try again</button>
      </div>
    </div>
  );
}
