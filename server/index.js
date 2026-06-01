import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { initScheduler } from './scheduler/index.js';
import weatherRoutes from './routes/weather.js';
import greenhouseRoutes from './routes/greenhouse.js';
import cropRoutes from './routes/crop.js';
import operationRoutes from './routes/operation.js';
import dataRecordRoutes from './routes/dataRecord.js';
import experimentRoutes from './routes/experiment.js';
import templateRoutes from './routes/template.js';
import inventoryRoutes from './routes/inventory.js';
import knowledgeRoutes from './routes/knowledge.js';
import aiRoutes from './routes/ai.js';
import configRoutes from './routes/config.js';
import decisionsRoutes from './routes/decisions.js';
import pluginRegistry from './plugins/index.js';
import openMeteoPlugin from './plugins/weather/openMeteo.js';
import wttrPlugin from './plugins/weather/wttr.js';
import initRoutes from './routes/init.js';
import { STATIC_DIR } from './services/paths.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

// Register weather plugins
pluginRegistry.register('weather', 'openMeteo', openMeteoPlugin);
pluginRegistry.register('weather', 'wttr', wttrPlugin);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from client build
// Static files: HTML should never be cached (service worker picks up new JS via new HTML)
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/setup') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(STATIC_DIR, { maxAge: '1h' }));

// API routes
app.use('/api/weather', weatherRoutes);
app.use('/api/greenhouses', greenhouseRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/data-records', dataRecordRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/config', configRoutes);
app.use('/api/decisions', decisionsRoutes);
app.use('/api/init', initRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(STATIC_DIR, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`农事专家服务器运行于 http://localhost:${PORT}`);
  initScheduler();
});
