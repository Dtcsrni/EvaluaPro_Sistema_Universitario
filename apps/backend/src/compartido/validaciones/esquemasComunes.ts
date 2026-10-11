import { z } from 'zod';

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();
