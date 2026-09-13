import dotenv from 'dotenv';
import { createApp } from './app';
import { getDb } from './db';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log(`🚀 Fruit TD Backend API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize MongoDB connection:', err);
    app.listen(PORT, () => {
      console.log(`⚠️ Fruit TD Backend API running without Mongo on http://localhost:${PORT}`);
    });
  }
}

start();
