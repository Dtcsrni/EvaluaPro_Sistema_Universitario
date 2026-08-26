/**
 * VersionInfoPage
 *
 * Responsabilidad: Centro de versión y especificación técnica de EvaluaPro.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import { useEffect, useMemo, useState } from 'react';
import { obtenerVersionApp, obtenerVersionTecnicaApp } from './versionInfo';

type VersionInfoPayload = {
  app?: { name?: string; version?: string; displayVersion?: string };
  repositoryUrl?: string;
  technologies?: Array<{ id?: string; label?: string; logoUrl?: string; website?: string }>;
  system?: {
    node?: string;
    platform?: string;
    arch?: string;
    hostname?: string;
    env?: string;
    uptimeSec?: number;
    generatedAt?: string;
  };
  developer?: { nombre?: string; rol?: string };
  changelog?: string;
};

type TecnologiaVersion = { id?: string; label?: string; logoUrl?: string; website?: string };

type VersionViewModel = {
  version: string;
  technicalVersion: string;
  nombre: string;
  developer: string;
  rol: string;
  changelog: string;
  repositoryUrl: string;
  technologies: TecnologiaVersion[];
  node: string;
  platform: string;
  arch: string;
  hostname: string;
  env: string;
  generatedAt: string;
};

const TECNOLOGIAS_DEFAULT: TecnologiaVersion[] = [
  { id: 'react', label: 'React 19', website: 'https://react.dev' },
  { id: 'typescript', label: 'TypeScript 5.9', website: 'https://www.typescriptlang.org' },
  { id: 'vite', label: 'Vite 8', website: 'https://vite.dev' },
  { id: 'nodejs', label: 'Node.js 24 LTS', website: 'https://nodejs.org' },
  { id: 'sqlite', label: 'SQLite 3 Local', website: 'https://www.sqlite.org' },
  { id: 'prisma', label: 'Prisma ORM', website: 'https://www.prisma.io' },
  { id: 'omr', label: 'Motor OMR Óptico', website: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario' },
  { id: 'crypto', label: 'Criptografía AES-256', website: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario' }
];

const CHANGELOG_DEFAULT = `# EvaluaPro Suite Universitaria - v1.1.1 (Estable)

### Novedades y Optimizaciones
- UI/UX Docente: Rediseño completo con arquitectura visual panorámica, iconos SVG de alta definición y Bento Workspace de 2 filas.
- Calificación Automatizada OMR: Procesamiento óptico local de hojas de respuestas con reconocimiento QR de alta precisión.
- Base de Datos Local Segura: Almacenamiento 100% privado en SQLite 3 local gestionado con Prisma ORM.
- Criptografía Integrada: Respaldo y sincronización protegidos con cifrado de nivel bancario AES-256-GCM.
`;

function renderIconoTecnologia(id: string) {
  switch (id.toLowerCase()) {
    case 'react':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(30 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(90 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(150 12 12)" />
          <circle cx="12" cy="12" r="2" fill="#38bdf8" />
        </svg>
      );
    case 'typescript':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" className="version-tech-svg">
          <rect width="18" height="18" x="3" y="3" rx="3" stroke="#60a5fa" />
          <path d="M8 8h6M11 8v8" />
          <path d="M15 15c1 1 3 0 3-1.5s-2-1.5-2-2.5 1.5-1.5 2.5-.5" />
        </svg>
      );
    case 'vite':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="version-tech-svg">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(167, 139, 250, 0.2)" stroke="#a78bfa" />
        </svg>
      );
    case 'nodejs':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <path d="M12 2l9 5.2v10.4L12 22.8l-9-5.2V7.2L12 2z" fill="rgba(74, 222, 128, 0.15)" stroke="#4ade80" />
          <circle cx="12" cy="12" r="3" fill="#4ade80" />
        </svg>
      );
    case 'sqlite':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case 'prisma':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="version-tech-svg">
          <polygon points="12 2 2 20 22 20 12 2" fill="rgba(45, 212, 191, 0.2)" stroke="#2dd4bf" />
          <line x1="12" y1="2" x2="12" y2="20" />
        </svg>
      );
    case 'omr':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#f43f5e" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'crypto':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="version-tech-svg">
          <rect width="18" height="11" x="3" y="11" rx="2" fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#fbbf24" />
          <circle cx="12" cy="16" r="1.5" fill="#fbbf24" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
  }
}

function comoTexto(valor: unknown, fallback: string) {
  const texto = typeof valor === 'string' ? valor : '';
  return texto || fallback;
}

function viewModelSistema(data: VersionInfoPayload | null) {
  return {
    node: comoTexto(data?.system?.node, 'v24.18.0'),
    platform: comoTexto(data?.system?.platform, 'win32'),
    arch: comoTexto(data?.system?.arch, 'x64'),
    hostname: comoTexto(data?.system?.hostname, 'Localhost'),
    env: comoTexto(data?.system?.env, 'production'),
    generatedAt: comoTexto(data?.system?.generatedAt, new Date().toISOString())
  };
}

const DEFAULT_DEV_NOMBRE = 'I.S.C. Erick Renato Vega Ceron';
const DEFAULT_DEV_ROL = 'Desarrollo';
const DEFAULT_REPO_URL = 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario';

function resolverDesarrollador(data: VersionInfoPayload | null) {
  const envNombre = String(import.meta.env.VITE_DEVELOPER_NAME || DEFAULT_DEV_NOMBRE);
  const envRol = String(import.meta.env.VITE_DEVELOPER_ROLE || DEFAULT_DEV_ROL);
  return {
    developer: comoTexto(data?.developer?.nombre, envNombre),
    rol: comoTexto(data?.developer?.rol, envRol),
    repositoryUrl: comoTexto(data?.repositoryUrl, DEFAULT_REPO_URL)
  };
}

function viewModelBase(data: VersionInfoPayload | null, fallbackVersion: string) {
  const technicalVersion = comoTexto(data?.app?.version, obtenerVersionTecnicaApp() || '1.1.1');
  const techs = Array.isArray(data?.technologies) ? data.technologies : TECNOLOGIAS_DEFAULT;
  const changelog = comoTexto(data?.changelog, '').trim() || CHANGELOG_DEFAULT;
  const version = comoTexto(data?.app?.displayVersion, fallbackVersion || technicalVersion || '1.1.1');

  return {
    version,
    technicalVersion,
    nombre: comoTexto(data?.app?.name, 'evaluapro'),
    changelog,
    technologies: techs,
    ...resolverDesarrollador(data)
  };
}

function leerPortalDesdeHash() {
  try {
    const hash = String(window.location.hash || '');
    const idx = hash.indexOf('?');
    if (idx < 0) return 'docente';
    const search = new URLSearchParams(hash.slice(idx + 1));
    const portal = String(search.get('portal') || '').toLowerCase();
    return portal === 'alumno' ? 'alumno' : 'docente';
  } catch {
    return 'docente';
  }
}

function VersionTechList({ technologies }: { technologies: TecnologiaVersion[] }) {
  if (!technologies.length) {
    return <p className="version-error">Sin tecnologías registradas.</p>;
  }
  return (
    <>
      {technologies.map((tech, idx) => {
        const id = String(tech?.id || idx);
        const label = String(tech?.label || tech?.id || 'Tecnología');
        const website = String(tech?.website || '#');
        return (
          <a
            key={id}
            href={website}
            target="_blank"
            rel="noreferrer noopener"
            className="version-tech-item"
            data-tooltip={`Visitar documentación oficial de ${label}`}
          >
            <div className="version-tech-icon-box" aria-hidden="true">
              {renderIconoTecnologia(id)}
            </div>
            <span>{label}</span>
          </a>
        );
      })}
    </>
  );
}

function buildViewModel(data: VersionInfoPayload | null, fallbackVersion: string): VersionViewModel {
  return {
    ...viewModelBase(data, fallbackVersion),
    ...viewModelSistema(data)
  };
}

const RELEASES_NOTAS = [
  {
    version: 'v1.1.1',
    etiqueta: 'Versión Actual · Estable',
    fecha: 'Agosto 2026',
    tipo: 'major',
    destacados: [
      {
        categoria: '🎨 UI/UX Panorámica',
        color: '#38bdf8',
        items: [
          'Rediseño panorámico de la suite docente con aprovechamiento del 100% del ancho de pantalla.',
          'Formulario de registro de materias en 2 filas limpias, eliminando solapamientos en cualquier resolución.',
          'Cabeceras enriquecidas con Mini-KPIs en tiempo real (Materias, Grupos y Por Cerrar) y orbe temático de 54px.',
          'Modernización de la sección de Materias Archivadas con Bento Glassmorphism y tarjetas métricas.'
        ]
      },
      {
        categoria: '📷 Motor OMR Óptico',
        color: '#f43f5e',
        items: [
          'Calificación asistida de hojas de respuestas mediante reconocimiento óptico local.',
          'Lectura y vinculación automática con códigos QR institucionales.'
        ]
      },
      {
        categoria: '🗄️ Persistencia & Seguridad',
        color: '#10b981',
        items: [
          'Migración completa a SQLite 3 Local gestionado con Prisma ORM (100% privado y offline-first).',
          'Cifrado simétrico AES-256-GCM para respaldo seguro y exportación de paquetes.'
        ]
      }
    ]
  },
  {
    version: 'v1.1.0',
    etiqueta: 'Lanzamiento Inicial',
    fecha: 'Julio 2026',
    tipo: 'minor',
    destacados: [
      {
        categoria: '👥 Gestión Académica',
        color: '#a78bfa',
        items: [
          'Módulos para administración de alumnos, pase de asistencia institucional y cálculo ponderado.',
          'Diseñador de plantillas de examen y banco reactivo de preguntas.'
        ]
      }
    ]
  }
];

function resolverEtiquetaEntorno(rawEnv?: string): string {
  const limpio = String(rawEnv || '').toLowerCase().trim();
  if (limpio === 'production' || limpio === 'prod') {
    return 'Producción Local (Offline-First)';
  }
  if (limpio === 'development' || limpio === 'dev') {
    return 'Desarrollo Local (Activo)';
  }
  if (limpio === 'test' || limpio === 'testing') {
    return 'Entorno de Pruebas Automatizadas';
  }
  return 'Local / Escritorio Autónomo';
}

function VersionChangelogVisual({ rawChangelog }: { rawChangelog: string }) {
  const [modoRaw, setModoRaw] = useState(false);

  return (
    <div className="version-changelog-container">
      <div className="version-changelog-toolbar">
        <span className="version-changelog-desc">Historial y notas de las versiones publicadas:</span>
        <button
          type="button"
          className="boton-toggle-raw"
          onClick={() => setModoRaw((prev) => !prev)}
          data-tooltip="Alternar entre formato visual y log markdown crudo"
        >
          {modoRaw ? '✨ Ver Formato Diseñado' : '📄 Ver Markdown Raw'}
        </button>
      </div>

      {modoRaw ? (
        <pre className="version-changelog">{rawChangelog || 'Sin changelog disponible.'}</pre>
      ) : (
        <div className="version-timeline">
          {RELEASES_NOTAS.map((rel) => (
            <article key={rel.version} className="version-timeline__release">
              <header className="version-timeline__head">
                <div className="version-timeline__badge-group">
                  <span className="version-timeline__tag-version">{rel.version}</span>
                  <span className="version-timeline__tag-status">{rel.etiqueta}</span>
                </div>
                <span className="version-timeline__date">📅 {rel.fecha}</span>
              </header>

              <div className="version-timeline__blocks">
                {rel.destacados.map((bloque) => (
                  <div key={bloque.categoria} className="version-timeline__cat-block">
                    <h4 className="version-timeline__cat-title" style={{ color: bloque.color }}>
                      {bloque.categoria}
                    </h4>
                    <ul className="version-timeline__list">
                      {bloque.items.map((item, i) => (
                        <li key={i} className="version-timeline__item">
                          <span className="version-timeline__bullet" style={{ borderColor: bloque.color }} aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function VersionInfoPage() {
  const [data, setData] = useState<VersionInfoPayload | null>(null);
  const portal = useMemo(() => leerPortalDesdeHash(), []);
  const fallbackVersion = obtenerVersionApp();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/salud/version-info', { cache: 'no-store' });
        if (res.ok) {
          const contentType = typeof res.headers?.get === 'function' ? (res.headers.get('content-type') || '') : '';
          if (!contentType || contentType.includes('application/json')) {
            const json = await res.json();
            if (!cancelado && json && typeof json === 'object') {
              setData(json as VersionInfoPayload);
            }
          }
        }
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const vm = buildViewModel(data, fallbackVersion);
  const etiquetaEntorno = resolverEtiquetaEntorno(vm.env);

  return (
    <main className="version-page">
      <section className="version-hero">
        <p className="version-eyebrow">EvaluaPro · {portal === 'alumno' ? 'Portal Alumno' : 'Portal Docente'}</p>
        <h1>Version Center</h1>
        <div className="version-badges-row">
          <span className="version-sub">
            <span className="version-pulse" /> {vm.nombre} v{vm.version}
          </span>
          <span className="version-sub version-sub--tech">
            Base técnica: {vm.technicalVersion}
          </span>
          <a className="version-repo-link" href={vm.repositoryUrl} target="_blank" rel="noreferrer noopener">
            Repositorio del desarrollador
          </a>
        </div>
      </section>

      <section className="version-grid">
        <article className="version-card">
          <h2>Sistema & Ejecución</h2>
          <div className="version-info-rows">
            <div className="version-info-row">
              <span className="version-info-label">Entorno:</span>
              <span className="version-env-badge">{etiquetaEntorno}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Arquitectura:</span>
              <span className="version-info-val">Suite de Escritorio Autónomo (Offline-First)</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Runtime:</span>
              <span className="version-info-val">{vm.node} ({vm.platform} / {vm.arch})</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Host de Trabajo:</span>
              <span className="version-info-val">{vm.hostname} (127.0.0.1)</span>
            </div>
          </div>
        </article>

        <article className="version-card">
          <h2>Desarrollador & Créditos</h2>
          <div className="version-info-rows">
            <div className="version-info-row">
              <span className="version-info-label">Autor / Ingeniero:</span>
              <span className="version-info-val"><strong>{vm.developer}</strong></span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Rol:</span>
              <span className="version-info-val">{vm.rol}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Compilación:</span>
              <span className="version-info-val">{new Date(vm.generatedAt).toLocaleString()}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Licencia:</span>
              <span className="version-info-val">Uso Académico e Institucional Universitario</span>
            </div>
          </div>
        </article>
      </section>

      <section className="version-card version-card-wide">
        <h2>Tecnologías utilizadas</h2>
        <div className="version-tech-grid">
          <VersionTechList technologies={vm.technologies} />
        </div>
      </section>

      <section className="version-card version-card-wide">
        <h2>Notas de la Versión y Novedades</h2>
        <VersionChangelogVisual rawChangelog={vm.changelog} />
      </section>
    </main>
  );
}
