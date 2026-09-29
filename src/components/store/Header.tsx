import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useCampaignLogo } from "@/lib/campaign";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const navLinks = [{ label: "Outlet", search: {} }];

const announcements = [
  "Frete Grátis para todo Brasil",
  "Garantia de troca em 30 dias, direto com a loja",
];

function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((current) => (current + 1) % announcements.length);
        setVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-primary py-2.5 text-center text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
      <span
        className={cn(
          "inline-block transition-all duration-300 ease-in-out",
          visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
        )}
      >
        {announcements[index]}
      </span>
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { totalItems, openCart } = useCart();
  const showCampaignLogo = useCampaignLogo();

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({ to: "/produtos", search: query.trim() ? { busca: query.trim() } : {} });
    setMenuOpen(false);
  }

  return (
    <>
      <AnnouncementBar />

      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            {showCampaignLogo ? (
              <img
                src="/democrata-logo.png"
                alt="Democrata"
                className="hidden h-6 w-auto shrink-0 sm:block sm:h-7"
              />
            ) : null}

            <button
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-secondary sm:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {showCampaignLogo ? (
              <div className="flex flex-1 items-center justify-center sm:hidden">
                <img src="/democrata-logo.png" alt="Democrata" className="h-6 w-auto" />
              </div>
            ) : null}

            <form
              onSubmit={handleSearch}
              className={cn(
                "items-center gap-2 rounded-full border border-input px-3 py-2 focus-within:ring-1 focus-within:ring-ring",
                showCampaignLogo ? "hidden flex-1 sm:flex" : "flex flex-1",
              )}
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produtos"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </form>

            <button
              type="button"
              aria-label="Abrir sacola"
              onClick={openCart}
              className="relative ml-auto grid size-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-secondary"
            >
              <ShoppingBag className="size-5" />
              {totalItems > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 grid size-4.5 place-items-center rounded-full bg-[#3BAE8A] text-[10px] font-bold text-white">
                  {totalItems}
                </span>
              ) : null}
            </button>
          </div>

          {showCampaignLogo ? (
            <form
              onSubmit={handleSearch}
              className="mt-2 flex items-center gap-2 rounded-full border border-input px-3 py-2 focus-within:ring-1 focus-within:ring-ring sm:hidden"
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produtos"
                className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </form>
          ) : null}
        </div>

        {menuOpen ? (
          <div className="border-b border-border px-4 py-4 sm:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2.5 text-foreground hover:bg-secondary"
              >
                Início
              </Link>
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  to="/produtos"
                  search={item.search}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-2 py-2.5 text-foreground hover:bg-secondary"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/produtos"
                search={{}}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2.5 text-foreground hover:bg-secondary"
              >
                Todos os produtos
              </Link>
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}
