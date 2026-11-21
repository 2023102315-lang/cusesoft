import { Router } from 'express';
import { confirm, create, download, getById, listMine } from '../controllers/ordersController.js';
import { requireAuth } from '../middlewares/auth.js';
import { orderLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.post('/api/orders', requireAuth, orderLimiter, create);
router.get('/api/orders', requireAuth, listMine);
router.get('/api/orders/:id', requireAuth, getById);
router.post('/api/orders/:id/confirm', requireAuth, orderLimiter, confirm);
router.get('/api/download/:token', download);

export default router;
