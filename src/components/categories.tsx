import catSociais from "@/assets/cat-sociais.jpg";
import catTenis from "@/assets/cat-tenis.jpg";
import catBotas from "@/assets/cat-botas.jpg";
import catCasuais from "@/assets/cat-casuais.jpg";

const categories = [
  { name: "Sociais", count: "24 modelos", image: catSociais, delay: "80ms" },
  { name: "Tênis", count: "18 modelos", image: catTenis, delay: "140ms" },
  { name: "Botas", count: "16 modelos", image: catBotas, delay: "200ms" },
  { name: "Casuais", count: "22 modelos", image: catCasuais, delay: "260ms" },
];

export function Categories() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-20 lg:px-10">
      <div className="mb-8 flex items-end justify-between border-b border-line pb-4">
        <h2 className="font-serif text-3xl tracking-tight text-bone">Navegue por categoria</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone-dim">
          (a) — (d)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {categories.map((category) => (
          <a key={category.name} href="#" className="group animate-rise" style={{ animationDelay: category.delay }}>
            <div className="relative aspect-[3/4] overflow-hidden rounded-[2px] bg-ink-soft outline-1 -outline-offset-1 outline-black/5">
              <img
                src={category.image}
                alt={`Categoria ${category.name}`}
                width={768}
                height={1024}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-ink/60 px-4 py-3 backdrop-blur-md">
                <p className="font-serif text-lg text-bone">{category.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cognac">
                  {category.count}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
