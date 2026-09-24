# Estado de releases

## Estado actual

El checkout observado el 2026-09-24 declara `1.1.6` y se describe como
`v1.1.6-14-g3337afd8-dirty`; contiene la etiqueta Git local `v1.1.6` y cambios
locales extensos. Esto no acredita que `v1.1.6` esté publicado ni que ese árbol
sea una release reproducible.

La vista pública de [Releases de GitHub](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases),
consultada el 2026-09-24, todavía muestra `v1.1.1` como Latest y
`v1.1.1-beta.2`. Esto contradice la afirmación histórica de que no hay releases
publicados o tags. No se pudo confirmar el estado remoto de tags ni los últimos
10 resultados de CI porque GitHub CLI no está autenticada y la vista de Actions
no expuso las conclusiones de las corridas.

Por tanto, **no hay una candidata estable aprobada desde este checkout**. No
descargar ni presentar artefactos QA locales como release. Antes del próximo
ship, reconciliar el inventario remoto (releases, tags, assets y checksums) con
el estado del repositorio y conservar evidencia verificable del ciclo docente.

## Criterio para la próxima estable

## Candidata nominal y SemVer

La candidata de producto se denomina **EvaluaPro Tlanahuatil-panoloani**.
`Tlanahuatil-panoloani` se toma de la transcripción oficial de náhuatl de la
UNAM para la idea de un aviso/mensaje que se transmite; conecta el propósito
del sistema —instrumentos de evaluación, registro y comunicación de resultados
en contextos escolares nahuas— sin afirmar que el software traduzca o
represente por sí solo una variante comunitaria. La referencia lingüística es
la transcripción institucional de la UNAM:
https://historicas.unam.mx/publicaciones/publicadigital/libros/081b/081b_05_04_transcripcion.pdf

La versión objetivo es **v1.2.0**: incorpora funcionalidad compatible nueva
(dataset OMR externo, ciclo de vida del Hub y protección contra downgrade), por
lo que corresponde al incremento `MINOR` de SemVer. La candidata previa debe
usar `v1.2.0-rc.1`; no se debe crear la release estable mientras el estado del
checkout, la release pública, el bundle firmado, los checksums y los gates no
estén reconciliados. La regla de precedencia aplicada por el updater sigue
SemVer 2.0.0: https://semver.org/lang/es/

Solo se podrá crear una nueva tag/release estable cuando exista evidencia de:

- bundle firmado y hash coincidente;
- gate de payload nativo SQLite verde;
- UX/UI interactiva completa con capturas y estados esperados;
- ciclo `instalar -> datos dummy -> reparar -> actualizar -> desinstalar` verde;
- gates contractuales y de seguridad verdes;
- ramas de release sincronizadas.
