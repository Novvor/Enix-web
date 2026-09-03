import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import LazyGlobalSearch from "@/components/search/LazyGlobalSearch";

type HeaderProps = {
  currentPath?: string;
};

const navItems = [
  { label: "Work", href: "/casos/" },
  { label: "Capabilities", href: "/servicios/" },
  { label: "Studio", href: "/nosotros/" },
  { label: "Insights", href: "/blog/" },
];


function isActive(currentPath = "", href: string) {
  if (href.startsWith("/#")) return false;
  if (href === "/") return currentPath === "/";
  return currentPath.startsWith(href);
}

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      className="group flex min-w-0 items-center gap-3"
      href="/"
      aria-label="ENIX STUDIO inicio"
      onClick={onClick}
    >
      <span className="relative flex h-8 w-[115px] items-center overflow-hidden md:h-9 md:w-[130px]">
        <img
          className="h-full w-full object-contain object-left brightness-0 invert transition duration-300 group-hover:opacity-80"
          src="/brand/enix-logo.png"
          alt="ENIX STUDIO"
          width="1578"
          height="447"
          decoding="async"
          fetchPriority="high"
        />
      </span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 sm:inline-block border-l border-white/15 pl-3">
        Studio
      </span>
    </a>
  );
}

export default function Header({ currentPath = "/" }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="fixed left-0 right-0 top-4 z-[120] px-4 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div
          className={[
            "relative flex h-[68px] items-center justify-between gap-4 rounded-full border border-white/10 bg-[#0A0A0A]/90 px-5 shadow-2xl backdrop-blur-xl transition-all duration-300",
            scrolled
              ? "shadow-[0_16px_40px_rgba(0,0,0,0.65)] border-white/15 bg-[#0A0A0A]/95"
              : "shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
          ].join(" ")}
        >
          <div className="relative z-10 flex min-w-0 shrink-0 items-center">
            <Logo />
          </div>

          <nav
            aria-label="Navegación principal"
            className="relative z-10 hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 lg:flex"
          >
            {navItems.map((item) => {
              const active = isActive(currentPath, item.href);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] transition duration-200",
                    active
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-neutral-300 hover:text-white hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <LazyGlobalSearch />

            <a
              href="/contacto/"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-black transition duration-200 hover:bg-neutral-200"
            >
              Start a Project <span className="ml-1 text-[13px]">↗</span>
            </a>


            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={mobileOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:bg-white/10 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[130] lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <div className="absolute left-4 right-4 top-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] text-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <Logo onClick={() => setMobileOpen(false)} />

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-neutral-300 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <nav aria-label="Navegación móvil" className="space-y-1.5">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                  >
                    {item.label}
                    <span className="text-neutral-500 font-mono text-xs">↗</span>
                  </a>
                ))}
              </nav>

              <a
                href="/contacto/"
                onClick={() => setMobileOpen(false)}
                className="mt-5 flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-black shadow-lg transition hover:bg-neutral-200"
              >
                Start a Project ↗
              </a>

            </div>
          </div>
        </div>
      )}
    </header>
  );
}
