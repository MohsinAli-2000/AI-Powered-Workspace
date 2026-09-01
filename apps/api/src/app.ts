import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Application = express();

// Core standard middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export default app;
