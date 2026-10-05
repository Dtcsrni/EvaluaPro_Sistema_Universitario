# Estado de releases

## Estado actual

La API pública de GitHub consultada el 2026-10-04 confirma `v1.2.3` como la
última release publicada. La rama `fix/release-gates-v1.2.4` declara `1.2.4` y
contiene cambios candidatos del workflow de publicación y E2E. Esa candidata no
se considera publicada hasta que el EXE se descargue del release draft, pase la
E2E completa de instalación/upgrade y el workflow la convierta en pública.

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
