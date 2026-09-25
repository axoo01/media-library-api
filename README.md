# Media Library API

[![CI](https://github.com/axoo01/media-library-api/actions/workflows/ci.yml/badge.svg)](https://github.com/axoo01/media-library-api/actions/workflows/ci.yml)

A REST API for uploading, organizing and searching media assets (images and PDFs), built with Node.js, Express 5, PostgreSQL, Prisma 7, Zod and Multer.

It follows a four-layer architecture, validates every input, returns a consistent response structure, and keeps the database and the upload directory in sync on every success and failure path.

## Contents

- [stack used](#tech-stack)
- [Getting started](#getting-started)
- [Env variables](#environment-variables)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [Response format](#response-format)
- [Project structure](#project-structure)
- [Design decisions](#design-decisions)
- [Testing with Postman / Newman](#testing-with-postman--newman)

## Tech stack

| Concern    | Choice                                            |
| ---------- | ------------------------------------------------- |
| Runtime    | Node.js 24 (ES modules, top-level `await`)        |
| Framework  | Express 5                                         |
| Database   | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Validation | Zod 4                                             |
| Uploads    | Multer 2 (disk storage)                           |
| Quality    | ESLint 9, Prettier, Newman                        |

## Getting started

### Prerequisites

- Node.js **22.18+** (24 recommended; `.nvmrc` is included, so run `nvm use`)
- PostgreSQL 15+ (for `createdb --locale-provider`) with a **UTF-8** database

### 1. Create the database

The database must be UTF-8 so the ICU collation used for title sorting is available and case-insensitive search works for non-ASCII text:

```bash
createdb -E UTF8 -T template0 --locale-provider=icu --icu-locale=und --locale=C media_library
```

> If your cluster's default encoding is not UTF-8 (check with `psql -c "SHOW server_encoding"`), also create a UTF-8 shadow database for `prisma migrate dev` with the same command, named `media_library_shadow`, and set `SHADOW_DATABASE_URL`.

### 2. Install and configure

```bash
nvm use
npm install                # also generates the Prisma client (beforeinstall)
cp .env.example .env       # then set DB_URL
```

### 3. Migrate, seed and run

```bash
npm run db:deploy          # apply migrations
npm run db:seed            # optional: 5 sample records with real files
npm run dev                # http://localhost:3000
```

Check it is up: `curl http://localhost:3000/health`

## Environment variables

All variables are validated with Zod at startup; the process exits with a clear message if any are invalid.

| Variable              | Required | Default       | Description                                                |
| --------------------- | -------- | ------------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | –             | PostgreSQL connection URL                                  |
| `NODE_ENV`            | No       | `development` | `development`, `production` or `test`                      |
| `PORT`                | No       | `3000`        | HTTP port                                                  |
| `UPLOAD_DIR`          | No       | `uploads`     | Upload directory, relative to the project root             |
| `SHUTDOWN_TIMEOUT_MS` | No       | `10000`       | Max wait for graceful shutdown before forcing exit         |
| `SHADOW_DATABASE_URL` | No       | –             | UTF-8 shadow database for `prisma migrate dev` (see above) |

## Scripts

| Script                            | Description                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                     | Start with `node --watch`                                                    |
| `npm start`                       | Start in normal mode                                                         |
| `npm run db:migrate`              | Create and apply a migration (development)                                   |
| `npm run db:deploy`               | Apply pending migrations                                                     |
| `npm run db:seed`                 | Replace the seed records (never touches real uploads; refuses in production) |
| `npm run db:studio`               | Open Prisma Studio                                                           |
| `npm run test:postman`            | Run the Postman collection against Development (server must be running)      |
| `npm run test:postman:prod`       | Run the Postman collection against the Production (Vercel) environment       |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                            |

## API reference

Base URL: `http://localhost:3000`

| Method   | Endpoint      | Description                                             |
| -------- | ------------- | ------------------------------------------------------- |
| `POST`   | `/media`      | Upload one file with metadata                           |
| `POST`   | `/media/bulk` | Upload up to 5 files with shared metadata               |
| `GET`    | `/media`      | List media with pagination, filters, search and sorting |
| `GET`    | `/media/:id`  | Get one media item                                      |
| `PUT`    | `/media/:id`  | Update metadata (title, tags, category)                 |
| `DELETE` | `/media/:id`  | Delete the record and its file                          |
| `GET`    | `/health`     | Health check                                            |

### Upload rules

| Rule             | Value                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Accepted types   | `image/jpeg`, `image/png`, `application/pdf` (declared type **and** file signature must match)   |
| Max file size    | 5MB per file                                                                                     |
| Max files (bulk) | 5                                                                                                |
| Categories       | `IMAGE`, `DOCUMENT`, `VIDEO`, `AUDIO`, `ARCHIVE`, `OTHER` (case-insensitive on input)            |
| Tags             | Comma-separated string, repeated fields or JSON array; trimmed, lowercased, deduplicated, max 20 |

### `POST /media`

`multipart/form-data` with fields `file` (required), `title` (required, max 255), `category` (required) and `tags` (optional).

```bash
curl -X POST http://localhost:3000/media \
  -F "file=@photo.png" \
  -F "title=Summer beach sunset" \
  -F "tags=beach, Summer" \
  -F "category=image"
```

`201 Created`

```json
{
  "status": "success",
  "data": {
    "media": {
      "id": "01a0e2ac-9fc6-7163-b7b0-8f9c54fb4123",
      "title": "Summer beach sunset",
      "filePath": "uploads/bd074749-1bf8-46c5-a9c6-5a97ec4223aa.png",
      "originalName": "photo.png",
      "mimeType": "image/png",
      "fileSize": 48213,
      "tags": ["beach", "summer"],
      "category": "IMAGE",
      "createdAt": "2026-09-25T15:01:47.000Z",
      "updatedAt": "2026-09-25T15:01:47.000Z"
    }
  }
}
```

### `POST /media/bulk`

`multipart/form-data` with `files` (1–5 files), `category` (required) and `tags` (optional). Each title is taken from its original filename. All records are inserted in a single statement, so a bulk upload is saved completely or not at all.

`201 Created` → `{ "status": "success", "data": { "results": [ ... ], "count": 2 } }`

### `GET /media`

| Query      | Default     | Rules                                                     |
| ---------- | ----------- | --------------------------------------------------------- |
| `page`     | `1`         | Integer ≥ 1                                               |
| `limit`    | `10`        | Integer 1–50 (`51+` is rejected with 400)                 |
| `category` | –           | One of the categories                                     |
| `tags`     | –           | Comma-separated; matches media having **any** of the tags |
| `search`   | –           | Case-insensitive substring match on title                 |
| `sortBy`   | `createdAt` | `createdAt`, `updatedAt`, `title`, `fileSize`             |
| `order`    | `desc`      | `asc` or `desc`                                           |

Unknown query parameters are rejected. A page beyond the last page returns `200` with empty results.

```bash
curl "http://localhost:3000/media?page=1&limit=10&category=image&tags=beach,travel&search=sunset&sortBy=title&order=asc"
```

```json
{
  "status": "success",
  "data": {
    "results": [],
    "pagination": { "total": 84, "page": 2, "limit": 10, "totalPages": 9 }
  }
}
```

### `PUT /media/:id`

JSON body with at least one of `title`, `tags`, `category`. Any other field (for example `filePath` or `fileSize`) is rejected.

```bash
curl -X PUT http://localhost:3000/media/<id> \
  -H "Content-Type: application/json" \
  -d '{ "title": "New title", "tags": ["travel"] }'
```

`200 OK` → `{ "status": "success", "data": { "media": { ... } } }`

### `DELETE /media/:id`

Deletes the record, then the file on disk. `200 OK` → `{ "status": "success", "data": null }`

## Response format

Every response uses the same envelope.

```json
{ "status": "success", "data": {} }
```

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": [
    { "field": "title", "message": "Title is required" },
    { "field": "limit", "message": "Limit cannot exceed 50" }
  ]
}
```

| Status | When                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| `400`  | Validation errors, unsupported or spoofed file type, file over 5MB, too many files, unknown fields, malformed JSON |
| `404`  | Unknown route or media id                                                                                          |
| `409`  | Unique constraint conflict                                                                                         |
| `413`  | JSON body over 100kb                                                                                               |
| `500`  | Unexpected error (generic message; details are logged, never sent)                                                 |

## Project structure

```
├── prisma/
│   ├── migrations/          # SQL migrations (incl. hand-written ICU collation)
│   ├── schema.prisma        # Media model and MediaCategory enum
│   └── seed.js              # Idempotent development seed
├── postman/                 # Collection, environment and fixtures
├── src/
│   ├── config/              # env validation, Prisma client, storage paths
│   ├── controllers/         # HTTP in/out only
│   ├── middlewares/         # validate, upload, errorHandler, notFound
│   ├── models/              # Domain constants (categories, file types, limits)
│   ├── repositories/        # Prisma queries and file-system access
│   ├── routes/              # Route definitions and middleware order
│   ├── services/            # Business logic
│   ├── utils/               # AppError, catchAsync, logger, responses, process handlers
│   ├── validators/          # Zod request schemas
│   └── app.js               # Express app (no port binding, importable by tests)
├── uploads/                 # Stored files (git-ignored)
└── server.js                # Bootstrap: DB check, listen, graceful shutdown
```

## Design decisions

### Layering

`routes → controllers → services → repositories`, each with one job:

- **Routes** declare the middleware order and nothing else.
- **Controllers** read `req.validated`, call one service function and send the response.
- **Services** hold the business rules (building records from uploads, pagination maths, delete ordering, not-found handling). They never import Prisma or `fs`.
- **Repositories** are the only code touching storage: `mediaRepository` translates domain filters (`{ category, tags, search }`) into Prisma syntax, and `fileRepository` wraps the file system. Prisma's `P2025` is converted to `null` there, so services don't depend on ORM error codes.

### Middleware order on uploads

Multer must run **before** validation: until it parses the multipart stream, `req.body` and `req.file` don't exist. Because of this, a file is already on disk when validation (or anything later) fails. The global error handler therefore removes every file in `req.file` / `req.files` before responding, so a failed request never leaves an orphaned file.

### Validation

A single `validate(schema)` middleware parses `{ body, query, params, file, files }` in one pass, so "file is required" is just another field error. Parsed values are stored on `req.validated` because `req.query` is read-only in Express 5. Multipart and query strings deliver everything as strings, so the schemas coerce numbers, normalize enum case, accept tags in every shape clients send, and use strict objects to block unknown fields (mass assignment on `PUT`, typos in query parameters).

### Upload security

- Stored filenames are UUIDs; the client's `originalname` is kept only as metadata (no path traversal, no collisions).
- The MIME allow-list uses `Object.hasOwn`, so a declared type like `constructor` cannot match an inherited property.
- The declared MIME type can be spoofed, so each file's **magic bytes** are verified after upload.
- `fileRepository` refuses to read or delete anything outside the upload directory.

### Delete order

The record is deleted first (the delete returns the row, so no extra lookup is needed), then the file. An orphaned file is harmless; a record pointing to a missing file is a user-visible bug. A missing file (`ENOENT`) counts as success.

### Pagination with `Promise.all`

`findMany` and `count` run in parallel with the same `where` clause. Sorting always adds `id` as a tie-breaker, so records with equal sort values never repeat or disappear across pages.

### Case-insensitive sorting and search

Prisma has no case-insensitive `orderBy`, so the `title` column uses the ICU collation `und-x-icu` (set in a hand-written migration). Titles sort alphabetically regardless of case, and unlike a nondeterministic collation it still supports `ILIKE` for search. Tags are stored lowercase, which makes tag filtering case-insensitive too. A GIN index backs the `tags` filter.

### Error handling and process lifecycle

- `AppError` marks operational errors; anything else becomes a generic 500 with the full error logged.
- The error handler maps Multer errors to 400 and Prisma `P2025`/`P2002` to 404/409.
- `catchAsync` wraps every controller. Express 5 already forwards rejected promises, but the wrapper keeps the error path explicit.
- Process handlers are the first import in `server.js`. `uncaughtException` exits immediately; `unhandledRejection`, `SIGTERM` and `SIGINT` close the HTTP server, then the database, with a forced-exit timeout.
- The code uses `async`/`await` only; an ESLint rule forbids `.then()` / `.catch()` chains.

### Serverless deployment & Ephemeral filesystem limitations

Vercel functions run in ephemeral, stateless serverless containers:

- **Disk Storage**: Serverless environments provide a read-only filesystem, except for `/tmp`. In production on Vercel, `UPLOAD_DIR` must be configured to `/tmp`.
- **Ephemeral Files**: Uploaded files written to `/tmp` are short-lived and discarded when serverless instances spin down or restart.
- **Production Storage Solution**: For permanent file storage in production, local disk storage (`Multer.diskStorage`) should be replaced with an object storage service such as **AWS S3** or **Cloudinary**, using pre-signed upload URLs or SDK direct streams.

## Testing with Postman / Newman

The collection `postman/media-library-api.postman_collection.json` covers every endpoint and the edge cases from the lab brief: invalid file type, spoofed file, oversized file, missing fields and invalid query parameters. Every request checks its status code; every JSON response is checked for the standard envelope, and media objects for all required fields.

Two environments define `{{BASE_URL}}` and `{{MEDIA_ID}}`:

| Environment | File                                                             | `BASE_URL`                |
| ----------- | ---------------------------------------------------------------- | ------------------------- |
| Development | `postman/media-library-api.development.postman_environment.json` | `http://localhost:3000`   |
| Production  | `postman/media-library-api.production.postman_environment.json`  | the Vercel deployment URL |

```bash
npm run test:postman        # Development (server must be running)
npm run test:postman:prod   # Production
```

Both scripts generate the oversized fixture (`postman/fixtures/large.png`, git-ignored) and run Newman. "Upload media" stores `MEDIA_ID` in the active environment, and the lifecycle deletes everything it creates. The oversized-file test accepts 400 (the API's own limit) or 413 (Vercel rejects request bodies over 4.5MB before they reach the API).

To use the Postman app: import the collection and both environments, set the working directory to the project root (Settings → General) so fixture paths resolve, run `node postman/generate-large-fixture.js` once, then run the collection in order.

## Deployment & Monitoring

### Vercel Deployment Setup

1. **Database Migration**:
   Apply pending Prisma migrations to your production PostgreSQL database (e.g. Neon):
   ```bash
   DATABASE_URL="postgresql://<user>:<password>@<neon-host>/media_library?sslmode=require" npm run db:deploy
   ```
2. **Environment Variables**:
   Configure the following environment variables in Vercel Dashboard (**Settings → Environment Variables**):
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `DATABASE_URL`: `postgresql://<user>:<password>@<neon-host>/media_library?sslmode=require`
   - `JWT_SECRET`: `<32+-char-secret>`
   - `MAX_FILE_SIZE_MB`: `5`
   - `UPLOAD_DIR`: `/tmp`
   - `LOG_LEVEL`: `info`

3. **Production Verification**:
   Once deployed, update `postman/media-library-api.production.postman_environment.json` with your live Vercel URL and run:
   ```bash
   npm run test:postman:prod
   ```

### Uptime Monitoring (UptimeRobot / Better Stack)

Monitor the API health and DB connectivity using the `/health` endpoint:

- **Monitor Type**: HTTP(s)
- **URL**: `https://<your-vercel-app>.vercel.app/health`
- **Interval**: 5 minutes
- **Expected Keyword / Status**: `200 OK` with body containing `"status":"ok"`
