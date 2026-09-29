const navLinks = ["Coleção", "Ateliê", "Sapataria", "Contato"];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 lg:px-10">
        <a href="/" className="font-display text-2xl tracking-[0.14em] text-bone">
          VÉLLE
        </a>
        <nav className="hidden items-center gap-9 font-mono text-[11px] uppercase tracking-[0.22em] text-bone-dim md:flex">
          {navLinks.map((label) => (
            <a key={label} href="#" className="transition-colors hover:text-bone">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-5">
          <a
            href="#"
            className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-bone-dim transition-colors hover:text-bone sm:block"
          >
            Buscar
          </a>
          <a
            href="#"
            className="group flex items-center gap-2 border border-line px-3 py-2 transition-colors hover:border-cognac/60"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone-dim transition-colors group-hover:text-bone">
              Carrinho
            </span>
            <span className="grid size-5 place-items-center bg-cognac font-mono text-[10px] font-medium text-ink">
              2
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
