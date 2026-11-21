import { Router } from 'express';
import {
  adminLogin,
  approve,
  createProductAdmin,
  deleteProductAdmin,
  getOverview,
  getSettingsAdmin,
  listOrders,
  listProductsAdmin,
  listUsers,
  reject,
  serveAdminPage,
  updateProductAdmin,
  updateSettingsAdmin,
} from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/auth.js';
import { otpVerifyLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.post('/api/admin/login', otpVerifyLimiter, adminLogin);
router.get('/api/admin/overview', requireAdmin, getOverview);
router.get('/api/admin/orders', requireAdmin, listOrders);
router.post('/api/admin/orders/:id/approve', requireAdmin, approve);
router.post('/api/admin/orders/:id/reject', requireAdmin, reject);
router.get('/api/admin/products', requireAdmin, listProductsAdmin);
router.post('/api/admin/products', requireAdmin, createProductAdmin);
router.patch('/api/admin/products/:id', requireAdmin, updateProductAdmin);
router.delete('/api/admin/products/:id', requireAdmin, deleteProductAdmin);
router.get('/api/admin/settings', requireAdmin, getSettingsAdmin);
router.patch('/api/admin/settings', requireAdmin, updateSettingsAdmin);
router.get('/api/admin/users', requireAdmin, listUsers);
router.get('/admin', serveAdminPage);

export default router;
