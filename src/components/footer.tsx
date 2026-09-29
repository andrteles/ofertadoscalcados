const shopLinks = ["Sociais", "Tênis", "Botas", "Casuais"];
const atelierLinks = ["Sapataria", "Cuidado", "Contato"];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-line bg-ink-soft/40 backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-6 py-14 lg:px-10">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-display text-3xl tracking-[0.14em] text-bone">VÉLLE</p>
            <p className="mt-4 max-w-[40ch] text-pretty text-sm leading-relaxed text-bone-dim">
              Sapatos masculinos feitos à mão. Couro, costura e paciência — desde 1962.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cognac">Loja</p>
            <ul className="mt-4 space-y-2 text-sm text-bone-dim">
              {shopLinks.map((label) => (
                <li key={label}>
                  <a href="#" className="transition-colors hover:text-bone">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cognac">Ateliê</p>
            <ul className="mt-4 space-y-2 text-sm text-bone-dim">
              {atelierLinks.map((label) => (
                <li key={label}>
                  <a href="#" className="transition-colors hover:text-bone">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim sm:flex-row sm:justify-between">
          <p>© 2026 VÉLLE — Feito à mão</p>
          <p>São Paulo · Lisboa</p>
        </div>
      </div>
    </footer>
  );
}
