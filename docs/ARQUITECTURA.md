# Arquitectura

## Resumen
La plataforma se divide en dos piezas:
1) Backend y frontend docente local (monolito modular).
2) Servicio cloud separado para portal alumno (solo lectura).

## Componentes principales
- Backend docente: Express + MongoDB + TypeScript.
- Frontend docente/alumno: React + Vite + TypeScript.
- Cloud Run: servicio portal alumno (API lectura + UI app_alumno).

## Capas del backend
- `modulos/`: dominio de negocio (alumnos, banco, PDF, OMR, calificacion, etc.).
- `infraestructura/`: adaptadores externos (DB, archivos, correo).
- `compartido/`: errores, validaciones, tipos y utilidades.

## Diagrama de arquitectura (logico)

```mermaid
flowchart LR
  classDef user fill:#fff6e5,stroke:#f59e0b,color:#7c2d12;
  classDef svc fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
  classDef db fill:#ecfccb,stroke:#65a30d,color:#365314;
  classDef store fill:#f5f5f4,stroke:#78716c,color:#1c1917;
  classDef cloud fill:#ede9fe,stroke:#7c3aed,color:#4c1d95;
  classDef ext fill:#fde2e2,stroke:#dc2626,color:#7f1d1d;

  subgraph Local["Entorno local (Docente)"]
    userDoc[Docente]:::user
    webDoc[Web Docente<br/>React + Vite]:::svc
    apiDoc[API Docente<br/>Express + TS]:::svc
    mongo[(MongoDB Local)]:::db
    pdfStore[[PDFs locales<br/>data/examenes]]:::store
    omr[Modulo OMR/PDF/QR<br/>sharp + pdf-lib + qrcode]:::svc
  end

  subgraph Cloud["Nube (Portal Alumno)"]
    userAlu[Alumno]:::user
    webAlu[Web Alumno<br/>React app_alumno]:::svc
    apiPortal[API Portal Alumno<br/>Express + TS]:::cloud
    mongoCloud[(MongoDB Cloud)]:::db
  end

  userDoc --> webDoc
  webDoc -->|HTTP JSON| apiDoc
  apiDoc -->|CRUD| mongo
  apiDoc -->|genera PDF| pdfStore
  apiDoc -->|procesa imagenes| omr

  apiDoc -->|publicacion resultados<br/>API Key| apiPortal
  apiPortal -->|persistencia| mongoCloud

  userAlu --> webAlu
  webAlu -->|HTTP JSON| apiPortal

  extMail[Correo opcional]:::ext
  apiDoc -.->|codigo acceso| extMail
```

![Arquitectura logica](diagramas/arquitectura-logica.svg)

## Diagrama de despliegue (local + nube)

```mermaid
flowchart TB
  classDef svc fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
  classDef db fill:#ecfccb,stroke:#65a30d,color:#365314;
  classDef store fill:#f5f5f4,stroke:#78716c,color:#1c1917;
  classDef cloud fill:#ede9fe,stroke:#7c3aed,color:#4c1d95;
  classDef user fill:#fff6e5,stroke:#f59e0b,color:#7c2d12;

  subgraph Docker["Docker Compose (local)"]
    mongo_local[(mongo_local)]:::db
    api_docente_local[api_docente_local]:::svc
    web_docente_local[web_docente_local]:::svc
    pdf_local[[data/examenes]]:::store
  end

  docente[Docente]:::user --> web_docente_local
  web_docente_local --> api_docente_local
  api_docente_local --> mongo_local
  api_docente_local --> pdf_local

  subgraph CloudRun["Nube (Cloud Run / similar)"]
    portal_api[portal_alumno_cloud]:::cloud
    mongo_cloud[(MongoDB Cloud)]:::db
  end

  subgraph Static["Hosting estatico"]
    web_alumno[web_alumno - build app_alumno]:::svc
  end

  alumno[Alumno]:::user --> web_alumno
  web_alumno --> portal_api
  api_docente_local -->|sync + API Key| portal_api
  portal_api --> mongo_cloud
```

![Arquitectura despliegue](diagramas/arquitectura-despliegue.svg)

Ver todos los diagramas en `docs/DIAGRAMAS.md`.

Ver la version C4 en `docs/ARQUITECTURA_C4.md`.

## Decisiones clave
- Monolito modular local: menos complejidad, facil mantenimiento.
- Servicio cloud separado: alta disponibilidad para alumno sin exponer red local.
- Calificacion exacta: Decimal.js y fraccion almacenada.
- PDF carta: baja tinta, margenes seguros y QR en cada pagina.
- PDFs locales se almacenan en `data/examenes` (ignorado por git).
- Autenticacion docente con JWT y validacion por objeto.
- Portal alumno con codigo de acceso temporal (12h, 1 uso).
- OMR guiado por mapa de posiciones generado junto al PDF.
- Sincronizacion local -> cloud protegida por API key.

## Nomenclatura
- Rutas, variables y modulos en espanol mexicano con camelCase.
- Colecciones en plural (docentes, alumnos, etc.).
