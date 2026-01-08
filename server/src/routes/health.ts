/**
 * Health endpoint for monitoring API and database state.
 */
import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (_req, res) => {
  const state = mongoose.connection.readyState; // 0,1,2,3
  const stateText = ['disconnected', 'connected', 'connecting', 'disconnecting'][state] ?? 'unknown';
  res.json({ status: 'ok', uptime: process.uptime(), db: { state, status: stateText } });
});

export default router;
