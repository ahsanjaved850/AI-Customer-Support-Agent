import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { configRouter } from './routes/config.js';
import { documentsRouter } from './routes/documents.js';
import { searchRouter } from './routes/search.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', configRouter);
app.use('/api', documentsRouter);
app.use('/api', searchRouter);
app.use('/api', chatRouter);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
