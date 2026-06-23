/**
 * rutasComercial
 *
 * Responsabilidad: Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.
 * Limites: No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  listarEstrategiasMonetizacionComunitaria,
  listarOfertasMonetizacionComunitaria,
  recomendarOfertaMonetizacionComunitaria
} from './controladorComercial';
import { esquemaRecomendacionMonetizacion } from './validacionesComercial';

const router = Router();

router.get(
  '/monetizacion-comunitaria/ofertas',
  requerirPermiso('analiticas:leer'),
  listarOfertasMonetizacionComunitaria
);
router.get(
  '/monetizacion-comunitaria/estrategias',
  requerirPermiso('analiticas:leer'),
  listarEstrategiasMonetizacionComunitaria
);
router.post(
  '/monetizacion-comunitaria/recomendacion',
  requerirPermiso('analiticas:leer'),
  validarCuerpo(esquemaRecomendacionMonetizacion, { strict: true }),
  recomendarOfertaMonetizacionComunitaria
);

export default router;

