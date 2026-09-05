"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="fatal-error">
      <p className="kicker">Workbench interrupted</p>
      <h1>The incident fixture could not be rendered.</h1>
      <button className="primary-button" onClick={reset}>Reload deterministic state</button>
    </main>
  );
}
