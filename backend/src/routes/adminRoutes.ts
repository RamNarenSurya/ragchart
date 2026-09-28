import { Router } from 'express';
import { getAdminStatistics, getLoginLogs } from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/admin/statistics', getAdminStatistics);
router.get('/admin/documents', getAdminStatistics);
router.get('/admin/login-logs', getLoginLogs);

export default router;
