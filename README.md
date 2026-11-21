# ENIX Studio v2

Rediseño comercial de ENIX Studio en **Astro 5** + isla **React 19** para el espacio interactivo **«Tu proyecto»**.

## Requisitos

- Node.js 22+
- npm 10+

## Inicio rápido

```bash
cd v2
npm install
npm run dev
```

Abre `http://localhost:4322/`.

## Scripts disponibles

- `npm run dev` — Servidor de desarrollo en el puerto `4322`.
- `npm run check` — Verificación estricta de tipos (`astro check`).
- `npm run build` — Verificación de tipos y compilación de producción (`astro build`).
- `npm run preview` — Vista previa local de la compilación.
- `npm test` — Pruebas unitarias sobre lógica crítica de la ficha (conservación de idea, prioridad de ediciones manuales, control de revisión y exportación).

## Modos de operación y configuración externa

Sin variables de entorno adicionales, el proyecto opera al 100 % de forma local y transparente:

1. **Asistente en Modo guiado local:** preguntas estructuradas con ramificación por categoría, ficha editable en tiempo real, distinción entre `Confirmado`, `Sugerido` y `Por definir`, persistencia local con caducidad de 14 días y descarga en `.md`, `.txt` e impresión/PDF.
2. **Recepción comercial opcional:** sin `RESEND_API_KEY`, el formulario explica claramente qué falta configurar y ofrece descargar el resumen o abrirlo en el cliente de correo (`hello@enix.studio`).

Para activar servicios externos, copia `.env.example` a `.env` y completa las credenciales autorizadas:

```bash
cp .env.example .env
```

- `OPENAI_API_KEY` (y opcionalmente `OPENAI_MODEL`): activa asistencia con IA en `/api/project-assistant`.
- `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`: activa recepción comercial confirmada con idempotencia en `/api/project-submit`.
