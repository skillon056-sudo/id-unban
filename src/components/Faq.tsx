const faqs = [
  {
    q: "How do I check if my Free Fire ID is banned?",
    a: "Enter your numeric Free Fire ID in the search box above and tap “Check ID Status”. We’ll show the current status and, if applicable, the ban reason.",
  },
  {
    q: "What does the unban request do?",
    a: "For eligible banned accounts, you can submit an unban request. After payment is verified, your request is queued for manual review. Submitting a request does not guarantee the account will be unbanned.",
  },
  {
    q: "Is my payment secure?",
    a: "Payments are processed by our payment gateway. We verify every transaction on our server before marking a request as submitted — a browser redirect alone never confirms a payment.",
  },
  {
    q: "How long does the review take?",
    a: "Review times vary. You can re-check your ID status any time using the search box to see whether it has moved to Pending or Unbanned.",
  },
  {
    q: "Are you affiliated with Garena / Free Fire?",
    a: "No. This is an independent support portal and is not affiliated with, endorsed by, or sponsored by Garena or Free Fire.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
      <div className="mt-6 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="card group p-5 [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between font-semibold marker:content-['']">
              {f.q}
              <span className="ml-4 text-accent transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
