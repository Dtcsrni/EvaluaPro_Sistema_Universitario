# Classroom OAuth de escritorio y E2E real

Guía para validar la integración distribuida con `docente-local`. Cada docente
vincula su propia cuenta Google desde EvaluaPro. El producto usa el OAuth Client
de escritorio compartido, PKCE `S256`, callback loopback y DPAPI `CurrentUser`;
no se copia `.env`, `client_secret` ni `CLASSROOM_TOKEN_CIPHER_KEY` a cada equipo.

## Configuración de Google Cloud

El cliente OAuth creado para EvaluaPro es de tipo **Escritorio** y su Client ID
público versionado por el producto se valida en la spec
[`SPEC-103`](../../specs/SPEC-103_classroom_oauth_distribuido_y_multinstalacion.spec.md).
No reemplazarlo por un cliente web ni añadir redirect URI fijo. Google describe
el flujo instalado con PKCE y callback loopback para aplicaciones de escritorio:
<https://developers.google.com/identity/protocols/oauth2/native-app>.

En Google Auth Platform:

1. Verificar que Google Classroom API esté habilitada y que el Client ID sea de
   escritorio en el proyecto EvaluaPro.
2. Declarar únicamente los scopes que solicita la versión de EvaluaPro: identidad
   básica (`openid`, `email`, `profile`) y lectura de cursos, temas, actividades,
   roster y entregas. No añadir scopes de Drive ni permisos de escritura para
   este flujo.
3. Completar marca, correo de soporte y URLs públicas de inicio, privacidad y
   términos. Los dominios deben pertenecer al responsable de la aplicación.
4. Para pruebas controladas, usar estado `Testing` y agregar explícitamente las
   cuentas de prueba. Esta condición limita el acceso y Google indica que las
   autorizaciones de apps externas en pruebas caducan a los siete días.
5. Para permitir que docentes fuera de la lista de prueba conecten sus cuentas,
   preparar la publicación `In production` y completar la verificación OAuth que
   aplique a los scopes sensibles. La documentación oficial requiere declarar los
   scopes usados y someter los sensibles/restringidos a verificación antes de
   ofrecerlos en producción:
   <https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance?hl=en>.

La pantalla `In production` no demuestra por sí sola que la verificación de
scopes esté aprobada ni que la política institucional de Workspace permita la
conexión. Registrar el resultado comprobado en la evidencia; no marcarlo por
inferencias.

## Validación en la instalación candidata

1. Instalar el bundle `docente-local` que corresponde al SHA candidato en un
   perfil Windows de prueba aislado.
2. Ejecutar `npm run classroom:doctor`. Debe identificar el Client ID de
   escritorio, DPAPI disponible y el flujo OAuth listo; la ausencia de vínculo
   debe indicar que el docente conecte su cuenta, no pedir editar `.env`.
3. Desde EvaluaPro, completar la vinculación Google y comprobar identidad,
   consulta de cursos, temas, actividades, fechas límite, roster y entregas.
   Confirmar que las actividades se filtran por el tema elegido y que fechas
   publicadas/límite se muestran correctamente, incluida una actividad sin fecha
   límite si existe.
4. Revisar el preview de importación, ejecutar una importación autorizada en el
   entorno docente controlado y repetirla para comprobar idempotencia. Verificar
   historial y ausencia de tokens o datos personales en logs.
5. Cerrar/reiniciar la aplicación y comprobar que DPAPI permite recuperar el
   vínculo bajo la misma cuenta Windows. Probar el estado de reconexión en una
   instalación/perfil distinto sin copiar el token.

## Evidencia de release

Después de completar el E2E real, copiar
`docs/release/manual/classroom-e2e-real-mayo-junio.template.json` al archivo
`docs/release/manual/classroom-e2e-real-mayo-junio.json` y registrar hechos
comprobados: versión, SHA completo de la candidata, ventana, hashes no reversibles, curso/actividad, `topicId`,
tema, fecha límite ISO (o `null` si Google no reporta una), cuentas vinculadas,
resultados y referencias de capturas sanitizadas. No guardar tokens, códigos OAuth,
correos completos ni nombres reales de estudiantes. El gate exige Client ID Desktop,
PKCE, callback loopback, DPAPI, scopes y consentimiento disponible para docentes.

```powershell
npm run release:check:classroom-e2e -- --manual=docs/release/manual/classroom-e2e-real-mayo-junio.json --candidate-sha=<sha-completo>
npm run release:validate:stable -- --version=1.2.10 --repo=Dtcsrni/EvaluaPro_Sistema_Universitario --candidate-sha=<sha-completo> --installer-run-id=<run-exitoso>
```

El validador documental no ejecuta Google APIs: solo certifica la evidencia
manual que se registró. La evidencia debe provenir de la instalación candidata
y corresponder exactamente a su versión/SHA.
