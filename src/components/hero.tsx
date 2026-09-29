import heroOxford from "@/assets/hero-oxford.jpg";

export function Hero() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-14 lg:px-10 lg:pt-20">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <p className="animate-fade font-mono text-[11px] uppercase tracking-[0.3em] text-cognac [animation-delay:60ms]">
            Sapatos masculinos · feitos à mão
          </p>
          <h1 className="animate-rise mt-6 font-serif text-[clamp(3rem,8vw,6.5rem)] leading-[0.92] tracking-tight text-bone [animation-delay:120ms]">
            O ritual de
            <br />
            <span className="italic text-cognac">calçar</span> o
            <br />
            bom.
          </h1>
          <p className="animate-rise mt-8 max-w-[46ch] text-pretty text-base leading-relaxed text-bone-dim [animation-delay:220ms]">
            Cada par nasce em couro selecionado, costurado à mão e acabado como quem abre uma
            caixa nova numa sapataria de bairro. Sem pressa. Sem excesso.
          </p>
          <div className="animate-rise mt-10 flex flex-wrap items-center gap-4 [animation-delay:320ms]">
            <a
              href="#"
              className="bg-cognac px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] text-ink transition-colors hover:bg-bone"
            >
              Ver a coleção
            </a>
            <a
              href="#"
              className="border border-line px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] text-bone transition-colors hover:border-cognac/60"
            >
              Nossa sapataria
            </a>
          </div>
          <div className="animate-rise mt-12 flex gap-10 border-t border-line pt-6 [animation-delay:420ms]">
            <div>
              <p className="font-display text-2xl text-bone">120+</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim">
                Modelos
              </p>
            </div>
            <div>
              <p className="font-display text-2xl text-bone">14</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim">
                Mestres
              </p>
            </div>
            <div>
              <p className="font-display text-2xl text-bone">1962</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim">
                Desde
              </p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="animate-fade relative [animation-delay:200ms]">
            <div className="absolute -inset-3 -z-10 rounded-[2px] bg-cognac/10" />
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2px] bg-ink-soft outline-1 -outline-offset-1 outline-black/5">
              <img
                src={heroOxford}
                alt="Oxford Meridiano em couro costurado à mão sobre pedestal de pedra escura"
                width={1024}
                height={1280}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-[2px] border border-line bg-ink/70 px-5 py-4 backdrop-blur-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cognac">
                Peça 01
              </p>
              <p className="mt-1 font-serif text-lg text-bone">Oxford “Meridiano”</p>
              <p className="font-mono text-[11px] text-bone-dim">R$ 1.890</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
