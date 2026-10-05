export default function PageHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <section className="bg-ink-deep text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-3 h-1 w-12 rounded bg-marigold" />
        <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-white/80">{intro}</p>}
      </div>
    </section>
  );
}
