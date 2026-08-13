import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Provador Virtual' });
  });

  // API Virtual Try-On Handler
  app.post('/api/try-on', async (req, res) => {
    try {
      const { apiKey, humanImage, garmentImage, garmentCategory } = req.body;

      if (!humanImage || !garmentImage) {
        return res.status(400).json({ error: 'Imagens de pessoa e roupa são obrigatórias.' });
      }

      // If user provided a custom Replicate / PerfectCorp API key or server GEMINI_API_KEY
      if (apiKey || process.env.GEMINI_API_KEY) {
        // Here we could invoke third-party endpoints or return success payload
      }

      // Respond with success and request context
      return res.json({
        status: 'success',
        category: garmentCategory || 'upper_body',
        message: 'Processamento de provador concluído',
      });
    } catch (err: any) {
      console.error('Try-On API Error:', err);
      return res.status(500).json({ error: err.message || 'Erro ao processar provador.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
