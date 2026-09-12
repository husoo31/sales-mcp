import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get('/scan-stream', (req, res) => {
  const district = req.query.district as string;
  const count = req.query.count as string;

  if (!district) {
    return res.status(400).json({ error: 'District is required' });
  }

  // Setup SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders(); // flush the headers to establish SSE connection

  const sendEvent = (type: string, data: any) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('log', { message: `[00:00] Tarama servisine bağlandı. Parametreler hazırlanıyor...` });
  sendEvent('log', { message: `[00:01] ${district} bölgesinde otonom tarama başlatıldı (Hedef: ${count || 5})...` });

  const workerScript = path.resolve(__dirname, '../../../worker/live-audit-base64.js');

  const child = spawn(process.execPath, [workerScript, district, count || '5'], {
    cwd: path.resolve(__dirname, '../../../worker')
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim() !== '');
    for (const line of lines) {
      sendEvent('log', { message: `[Live] ${line}` });
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim() !== '');
    for (const line of lines) {
      sendEvent('log', { message: `[Error] ${line}` });
    }
  });

  child.on('close', (code) => {
    sendEvent('log', { message: `[Worker] İşlem tamamlandı (Çıkış Kodu: ${code}).` });
    sendEvent('done', { success: code === 0 });
    res.end();
  });
});

export default router;
