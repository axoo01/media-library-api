import { Router } from 'express';
import * as healthController from '../controllers/healthController.js';
import catchAsync from '../utils/catchAsync.js';

const router = Router();

router.get('/', catchAsync(healthController.getHealth));

export default router;
