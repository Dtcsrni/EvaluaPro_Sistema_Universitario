/**
 * Express API entry point (copy of backend/src/index.ts).
 * Not used by root scripts unless referenced explicitly.
 */
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import healthRouter from './routes/health';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI;

async function start() {
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection failed', error);
    }
  } else {
    console.warn('MONGODB_URI is not set; skipping database connection');
  }

  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Server failed to start', error);
  process.exit(1);
});
