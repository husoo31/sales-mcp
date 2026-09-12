import express from 'express';
import cors from 'cors';
import { prisma } from '@spark/database';
import leadsRouter from './routes/leads.js';
import approvalsRouter from './routes/approvals.js';
import followUpsRouter from './routes/followups.js';
import dashboardRouter from './routes/dashboard.js';
import workerRouter from './routes/worker.js';
import mcpRouter from './routes/mcp.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for web-panel
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// Basic health check
app.get('/health', async (req, res) => {
  try {
    // Attempt a basic DB query to ensure connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: String(error) });
  }
});

// API Routes
app.use('/api/leads', leadsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/followups', followUpsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/worker', workerRouter);
app.use('/api/mcp', mcpRouter);

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});

