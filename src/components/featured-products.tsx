import prodOxford from "@/assets/prod-oxford.jpg";
import prodChelsea from "@/assets/prod-chelsea.jpg";
import prodMocassim from "@/assets/prod-mocassim.jpg";

const products = [
  {
    category: "Sociais",
    name: "Oxford “Meridiano”",
    price: "R$ 1.890",
    image: prodOxford,
    badge: "Novo",
    badgeClass: "bg-cognac text-ink",
    delay: "80ms",
  },
  {
    category: "Botas",
    name: "Chelsea “Noturno”",
    price: "R$ 2.450",
    image: prodChelsea,
    badge: "Best-seller",
    badgeClass: "bg-bone text-ink",
    delay: "160ms",
  },
  {
    category: "Casuais",
    name: "Mocassim “Vale”",
    price: "R$ 1.290",
    image: prodMocassim,
    badge: null,
    badgeClass: "",
    delay: "240ms",
  },
];

export function FeaturedProducts() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10">
      <div className="mb-8 flex items-end justify-between border-b border-line pb-4">
        <h2 className="font-serif text-3xl tracking-tight text-bone">Em destaque</h2>
        <a
          href="#"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone-dim transition-colors hover:text-cognac"
        >
          Ver tudo →
        </a>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <article key={product.name} className="animate-rise" style={{ animationDelay: product.delay }}>
            <div className="group relative aspect-[4/5] overflow-hidden rounded-[2px] bg-ink-soft outline-1 -outline-offset-1 outline-black/5">
              <img
                src={product.image}
                alt={product.name}
                width={1024}
                height={1280}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              {product.badge && (
                <span
                  className={`absolute left-3 top-3 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${product.badgeClass}`}
                >
                  {product.badge}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim">
                  {product.category}
                </p>
                <h3 className="mt-1 font-serif text-xl text-bone">{product.name}</h3>
              </div>
              <p className="font-mono text-sm text-bone">{product.price}</p>
            </div>
            <button className="mt-4 w-full border border-line py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-cognac hover:bg-cognac hover:text-ink">
              Adicionar
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
