# Media Library API

[![CI](https://github.com/axoo01/media-library-api/actions/workflows/ci.yml/badge.svg)](https://github.com/axoo01/media-library-api/actions/workflows/ci.yml)
[![Uptime Monitoring](https://img.shields.io/badge/UptimeRobot-100%25_Up-success?logo=uptimerobot&logoColor=white)](https://media-library-api-axo8.vercel.app/health)

A REST API for uploading, organizing and searching media assets (images and PDFs), built with Node.js, Express 5, PostgreSQL, Prisma 7, Zod and Multer.

It follows a four-layer architecture, validates every input, returns a consistent response structure, and keeps the database and the upload directory in sync on every success and failure path.

---

## Tech Stack

| Component                | Technology                                                            |
| ------------------------ | --------------------------------------------------------------------- |
| **Runtime & Framework**  | Node.js 24 (ESM), Express 5                                           |
| **Database & ORM**       | PostgreSQL 16 (UTF-8, ICU Collation), Prisma 7 (`@prisma/adapter-pg`) |
| **Validation & Uploads** | Zod 4, Multer 2                                                       |
| **Logging & Health**     | Pino / `pino-http`, `GET /health` with DB ping                        |
| **Testing & CI/CD**      | Jest (`@swc/jest`), Supertest, Newman, GitHub Actions                 |
| **Deployment**           | Vercel (Serverless Functions)                                         |

---

## Quick Start

### Prerequisites

- Node.js **24** (`nvm use`)
- PostgreSQL **15+** with UTF-8 database

### Setup & Run Locally

```bash
# 1. Install dependencies & generate Prisma client
npm install

# 2. Configure environment
cp .env.example .env.development

# 3. Deploy database migrations & start development server
npm run db:deploy
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## API Reference

Base URL: `http://localhost:3000` (Local) | `https://media-library-api-axo8.vercel.app` (Production)

| Method   | Endpoint      | Description                                                |
| -------- | ------------- | ---------------------------------------------------------- |
| `GET`    | `/health`     | Application & database health check                        |
| `POST`   | `/media`      | Upload a single media file with metadata                   |
| `POST`   | `/media/bulk` | Upload up to 5 media files simultaneously                  |
| `GET`    | `/media`      | List media with pagination, filtering, search, and sorting |
| `GET`    | `/media/:id`  | Retrieve a single media item by ID                         |
| `PUT`    | `/media/:id`  | Update media metadata (`title`, `category`, `tags`)        |
| `DELETE` | `/media/:id`  | Delete media record and associated file                    |

---

## Testing & Quality Gate

```bash
# Run unit & integration tests with coverage (Jest + Supertest)
npm test

# Run Postman test suite locally (Newman)
npm run test:postman

# Run Postman test suite against production Vercel deployment
npm run test:postman:prod

# Linting & Code formatting
npm run lint && npm run format:check
```

---

## Production Deployment & Serverless Architecture

### Ephemeral Storage Considerations

Vercel serverless functions operate in a stateless, read-only filesystem except for `/tmp`.

- In production, `UPLOAD_DIR` is set to `/tmp` for short-lived processing.
- For permanent file persistence, integrate cloud object storage (**AWS S3** or **Cloudinary**).

---

## Monitoring & Uptime

The production API is actively monitored using **UptimeRobot**:

- **Health Endpoint**: [`https://media-library-api-axo8.vercel.app/health`](https://media-library-api-axo8.vercel.app/health)
- **Check Frequency**: Every 5 minutes
- **Current Status**: **100% Uptime** (HTTP 200 OK + active DB ping verification)
- **Dashboard Reference**: Configured with 5-minute HTTP/S health check ping and instant incident alert notifications.
