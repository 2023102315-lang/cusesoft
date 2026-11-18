import { Router } from 'express';
import {
  getMe,
  googleLogin,
  login,
  logout,
  register,
  requestOtpCode,
  updateProfile,
  verifyOtpCode,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { otpRequestLimiter, otpVerifyLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.get('/api/auth/me', getMe);
router.post('/api/auth/register', otpVerifyLimiter, register);
router.post('/api/auth/login', otpVerifyLimiter, login);
router.post('/api/auth/otp/request', otpRequestLimiter, requestOtpCode);
router.post('/api/auth/otp/verify', otpVerifyLimiter, verifyOtpCode);
router.post('/api/auth/google', otpVerifyLimiter, googleLogin);
router.post('/api/auth/logout', logout);
router.patch('/api/auth/profile', requireAuth, updateProfile);

export default router;
