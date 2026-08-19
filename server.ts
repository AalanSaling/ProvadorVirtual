// server.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './server/config/env.js';
import { logger } from './server/utils/logger.js';
import { ProviderRegistry } from './server/providers/registry/ProviderRegistry.js';
import { PerfectCorpTryOnProvider } from './server/providers/PerfectCorpTryOnProvider.js';
import { GoogleTryOnProvider } from './server/providers/GoogleTryOnProvider.js';
import { StorageService } from './server/services/StorageService.js';
import { healthRouter } from './server/routes/healthRoutes.js';
import { tryOnRouter } from './server/routes/tryOnRoutes.js';
import { catalogRouter } from './server/routes/catalogRoutes.js';
import { storeRouter } from './server/routes/storeRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '20mb' }));

// 1. Initialize ProviderRegistry with real PerfectCorp and Google providers
const registry = ProviderRegistry.getInstance();
registry.register(new PerfectCorpTryOnProvider());
registry.register(new GoogleTryOnProvider());

// 2. Initialize Storage Buckets
const storageService = new StorageService();
storageService.initializeBuckets().catch(err => {
  logger.error('Failed to auto-initialize storage buckets', err);
});

// 3. Register Routes
app.use('/api', healthRouter);
app.use('/api/try-on', tryOnRouter);
app.use('/api/products', catalogRouter);
app.use('/api/store', storeRouter);

// 4. Serve Expo Web Static Bundle for AI Studio Preview with safe public env injection
const distWebPath = path.join(__dirname, 'dist-web');
if (fs.existsSync(distWebPath)) {
  const normalizeSupabaseUrl = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    const dashboardMatch = trimmed.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
    if (dashboardMatch && dashboardMatch[1]) {
      return `https://${dashboardMatch[1]}.supabase.co`;
    }
    return trimmed.replace(/\/+$/, '');
  };

  const getInjectedHtml = () => {
    try {
      const rawHtml = fs.readFileSync(path.join(distWebPath, 'index.html'), 'utf-8');
      // Strictly ONLY inject the two public client-side credentials
      const publicEnv = {
        EXPO_PUBLIC_SUPABASE_URL: normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''),
        EXPO_PUBLIC_SUPABASE_ANON_KEY: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim(),
      };
      const scriptTag = `<script id="expo-public-env">window.__EXPO_PUBLIC_ENV__ = ${JSON.stringify(publicEnv)};</script>`;
      if (rawHtml.includes('</head>')) {
        return rawHtml.replace('</head>', `${scriptTag}</head>`);
      }
      return `${scriptTag}${rawHtml}`;
    } catch {
      return fs.readFileSync(path.join(distWebPath, 'index.html'), 'utf-8');
    }
  };

  app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getInjectedHtml());
  });

  app.get('/index.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getInjectedHtml());
  });

  app.use(express.static(distWebPath, { index: false }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getInjectedHtml());
  });
} else {
  app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head><title>Provador Virtual</title></head>
<body style="background:#090a0f;color:#fff;font-family:sans-serif;padding:32px;">
  <h2>Carregando interface Expo Web...</h2>
</body>
</html>`);
  });
}

// Start Server
app.listen(env.PORT, () => {
  logger.info(`ProvadorVirtual Greenfield Backend running on port ${env.PORT}`, {
    env: env.NODE_ENV,
    googleModel: env.GOOGLE_IMAGE_MODEL,
    ttlDays: env.TRY_ON_RESULTS_TTL_DAYS,
  });
});
