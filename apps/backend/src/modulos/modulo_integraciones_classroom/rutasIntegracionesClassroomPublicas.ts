import { Router } from 'express';
import { callbackOauthClassroom } from './controladorIntegracionesClassroom';

const router = Router();

router.get('/oauth/callback', callbackOauthClassroom);

export default router;
