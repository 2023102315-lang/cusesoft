import { Router } from 'express';
import {
  getHealth,
  getProducts,
  getPublicConfig,
  getRobots,
  getSitemap,
  renderProductPage,
} from '../controllers/productsController.js';

const router = Router();

router.get('/api/health', getHealth);
router.get('/api/config', getPublicConfig);
router.get('/api/products', getProducts);
router.get('/producto/:id', renderProductPage);
router.get('/sitemap.xml', getSitemap);
router.get('/robots.txt', getRobots);

export default router;
