import express from 'express';
import routes from './routes/index.js';
import requestLogger from './middlewares/requestLogger.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.disable('x-powered-by');

// First, so every request is logged, including ones rejected by the body parser.
app.use(requestLogger);

// Multipart bodies are parsed per-route by Multer, not globally.
app.use(express.json({ limit: '100kb' }));

app.use(routes);

app.use(notFound);
app.use(errorHandler);

export default app;
