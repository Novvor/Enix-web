import { useState, useEffect } from "react";

const INVESTMENT_TIERS_GLOBAL = [
  { id: "tier-1", label: "$2.5M – $5M CLP", sublabel: "(~$2.5k – $5k USD)" },
  { id: "tier-2", label: "$5M – $12M CLP", sublabel: "(~$5k – $12k USD)" },
  { id: "tier-3", label: "$12M – $25M CLP", sublabel: "(~$12k – $25k USD)" },
  { id: "tier-4", label: "$25M+ CLP", sublabel: "(~$25k+ USD)" },
];

const INVESTMENT_TIERS_CHILE = [
  { id: "tier-smb", label: "< $2.5M CLP", sublabel: "(Solución Ágil Pyme)" },
  { id: "tier-1", label: "$2.5M – $5M CLP", sublabel: "(Estudio Core)" },
  { id: "tier-2", label: "$5M – $12M CLP", sublabel: "(Transformación B2B)" },
  { id: "tier-3", label: "$12M+ CLP", sublabel: "(Enterprise & NOVVOR)" },
];

const PROJECT_TYPES = [
  "Consultoría Estratégica & Modelo Comercial",
  "Dirección de Arte & Identidad Corporativa",
  "Plataformas Web & Software a Medida",
  "Diseño Industrial & Hardware IoT (con NOVVOR)",
  "Transformación Integral",
];

const TIMELINES = [
  "Inmediato (1–2 meses)",
  "Próximo trimestre (2–4 meses)",
  "Planificación a mediano plazo (4+ meses)",
];

export default function ProjectInquiry() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChile, setIsChile] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
      if (tz.includes("santiago") || tz.includes("chile") || navigator.language.includes("es-CL")) {
        setIsChile(true);
      }
    } catch {
      // Fallback
    }
  }, []);

  const tiers = isChile ? INVESTMENT_TIERS_CHILE : INVESTMENT_TIERS_GLOBAL;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    website: "",
    projectType: PROJECT_TYPES[0],
    investment: "$5M – $12M CLP",
    timeline: TIMELINES[0],
    message: "",
  });

  const isSmallBudget = formData.investment === "< $2.5M CLP";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        type: "contact",
        name: formData.name,
        email: formData.email,
        company: `${formData.company} (${formData.role})`,
        website: formData.website,
        service: formData.projectType,
        reason: `Inversión: ${formData.investment} | Plazo: ${formData.timeline} | Geo: ${isChile ? "Chile" : "Global"}`,
        message: formData.message,
        origin: isSmallBudget ? "Project Inquiry (WebBase Bridge Referral)" : "Project Inquiry (Executive Advisory Intake)",
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        consent: true,
      };

      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("No se pudo enviar la solicitud. Por favor intente nuevamente.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido al procesar la solicitud.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="section py-20 md:py-28 px-4 md:px-8 bg-[#0A0A0A] text-[#F7F7F4]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column: Executive Framing & Roadmap */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 block mb-3">
                Advisory Intake · Direct Access
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Inicie una conversación con la dirección del estudio.
              </h2>
            </div>

            <p className="text-sm md:text-base text-neutral-300 font-light leading-relaxed">
              Cada proyecto es analizado confidencialmente por nuestros Socios Directores de estrategia, diseño e ingeniería. Evaluamos factibilidad, impacto de negocio y encaje mutuo antes de proponer una sesión ejecutiva.
            </p>

            {/* Protocol Steps for Empresa B (Certidumbre absoluta) */}
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
              <span className="font-mono text-xs text-neutral-400 uppercase tracking-widest block">
                Proceso de Incorporación de Clientes:
              </span>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-red-500 font-bold">01</span>
                  <div>
                    <strong className="text-white block">Revisión de Alcance en 24h</strong>
                    <span className="text-neutral-400">Verificación de disponibilidad de equipo directivo y firma de NDA si se requiere.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-red-500 font-bold">02</span>
                  <div>
                    <strong className="text-white block">Sesión Estratégica Directiva (30 min)</strong>
                    <span className="text-neutral-400">Conversación directa con socios (sin intermediarios comerciales ni juniors).</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-red-500 font-bold">03</span>
                  <div>
                    <strong className="text-white block">Propuesta con Alcance & Presupuesto Cerrado</strong>
                    <span className="text-neutral-400">Roadmap técnico detallado, entregables garantizados y fechas definitivas.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Contact Channels */}
            <div className="space-y-3 pt-2 font-mono text-xs text-neutral-400">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Canal Directo:</span>
                <a href="mailto:hello@enix.studio" className="text-white hover:underline">
                  hello@enix.studio
                </a>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Confidencialidad:</span>
                <span className="text-white">NDA Previo Garantizado</span>
              </div>
              <div className="flex justify-between">
                <span>Alianza Industrial:</span>
                <span className="text-white">Engineering by NOVVOR</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Ticket Qualification Form */}
          <div className="lg:col-span-7">
            {submitted ? (
              <div className="p-10 md:p-14 rounded-3xl border border-white/15 bg-white/[0.03] space-y-6 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-black font-bold text-xl">
                  ✓
                </span>
                <h3 className="text-3xl font-black text-white">Solicitud Recibida</h3>
                <p className="text-sm md:text-base text-neutral-300 leading-relaxed max-w-md mx-auto font-light">
                  {isSmallBudget
                    ? "Hemos registrado su solicitud. Nuestro equipo coordinará la mejor alternativa técnica y comercial a través de WebBase by NOVVOR."
                    : "Su consulta ha sido derivada directamente a la dirección de ENIX Studio. Un socio director se pondrá en contacto en menos de 24 horas hábiles."}
                </p>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="btn-editorial btn-editorial-outline-white text-xs"
                  >
                    Enviar otra consulta
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-8 md:p-12 rounded-3xl border border-white/10 bg-white/[0.02] space-y-8">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-xl font-bold text-white">Cuéntenos sobre su iniciativa</h3>
                  <p className="text-xs text-neutral-400 mt-1">Información confidencial para calificar el alcance de su proyecto.</p>
                </div>

                {error && (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs">
                    {error}
                  </div>
                )}

                {/* Primary Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Rodrigo Valenzuela"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                      Email Corporativo *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="rodrigo@empresa.com"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Company & Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                      Empresa u Organización *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Ej. Altair Systems"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                      Cargo / Rol *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="Ej. Gerente General / Director"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                    Sitio Web Actual (si aplica)
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://www.empresa.com"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none"
                  />
                </div>

                {/* Project Type */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                    Tipo de Proyecto o Desafío Principal
                  </label>
                  <select
                    value={formData.projectType}
                    onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                  >
                    {PROJECT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Investment Tiers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400">
                      Rango de Inversión Estimado *
                    </label>
                    {isChile && (
                      <span className="text-[10px] font-mono text-neutral-500">
                        Mostrando opciones para Chile
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {tiers.map((tier) => {
                      const selected = formData.investment === tier.label;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, investment: tier.label })}
                          className={`p-3 text-left rounded-xl border transition-all text-xs ${
                            selected
                              ? "border-white bg-white text-black font-semibold shadow-md"
                              : "border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/20"
                          }`}
                        >
                          <span className="block font-medium">{tier.label}</span>
                          <span className={`block text-[10px] mt-0.5 ${selected ? "text-neutral-700" : "text-neutral-500"}`}>
                            {tier.sublabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* WebBase Bridge for Empresa A (Chile Only) */}
                {isChile && isSmallBudget && (
                  <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] space-y-2 text-xs text-neutral-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <strong className="text-amber-200 font-semibold font-mono uppercase tracking-wider">
                        Ruta recomendada para su presupuesto en Chile: WebBase
                      </strong>
                    </div>
                    <p className="leading-relaxed font-light text-neutral-300">
                      Para iniciativas con presupuestos menores a $2.5M CLP que buscan una solución ágil y empaquetada, canalizamos el requerimiento a través de <strong className="text-white font-medium">WebBase by NOVVOR</strong>.
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Al enviar el formulario, nuestro equipo evaluará su proyecto y lo derivará directamente al equipo de WebBase para atenderle de forma inmediata.
                    </p>
                  </div>
                )}


                {/* Project Brief */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                    ¿Qué objetivo o transformación comercial busca conseguir? *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describa el contexto de su empresa, los problemas de mercado o tecnología que busca resolver y qué representaría un éxito tangible..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-[11px] font-mono text-neutral-400">
                    Confidencialidad garantizada · NDA previa a solicitud.
                  </span>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-black shadow-xl transition hover:bg-neutral-200 disabled:opacity-50"
                  >
                    {loading ? "Procesando..." : "Solicitar Evaluación de Proyecto ↗"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
