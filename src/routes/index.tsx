import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Categories } from "@/components/categories";
import { FeaturedProducts } from "@/components/featured-products";
import { Footer } from "@/components/footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VÉLLE — Sapatos Masculinos Feitos à Mão" },
      {
        name: "description",
        content:
          "Sapatos masculinos em couro, costurados à mão desde 1962. Sociais, tênis, botas e casuais com acabamento artesanal.",
      },
      { property: "og:title", content: "VÉLLE — Sapatos Masculinos Feitos à Mão" },
      {
        property: "og:description",
        content:
          "Cada par nasce em couro selecionado, costurado à mão e acabado sem pressa. Conheça a coleção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VÉLLE — Sapatos Masculinos Feitos à Mão" },
      {
        name: "twitter:description",
        content:
          "Sapatos masculinos em couro, costurados à mão desde 1962. Sociais, tênis, botas e casuais.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-ink font-sans text-bone antialiased">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-cognac/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[520px] rounded-full bg-cognac-deep/25 blur-[120px]" />
      </div>
      <Header />
      <main className="relative z-10">
        <Hero />
        <Categories />
        <FeaturedProducts />
      </main>
      <Footer />
    </div>
  );
}
