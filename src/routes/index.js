import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import mediaRoutes from './mediaRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/media', mediaRoutes);

export default router;
