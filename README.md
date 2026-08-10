# Intelligent Media Processing Pipeline

A small backend service for asynchronous vehicle image quality analysis.

## Architecture

- `POST /upload`: accepts multipart image uploads and stores image metadata in SQLite.
- In-memory queue: uploads are enqueued and processed in the background.
- Background worker: runs image heuristics and writes structured analysis, status, and failure info.
- `GET /status/:id`: returns current status (`pending`, `processing`, `completed`, `failed`).
- `GET /results/:id`: returns analysis details, issues found, and metadata.

## Features

- Blur detection via gradient variance
- Brightness and low-light detection
- Duplicate detection using perceptual hash against prior uploads
- Screenshot/photo-of-photo heuristics using border and edge density
- Image dimension validation and suspicious edit heuristics

## Running Locally

### Native Node.js

1. Install dependencies:

```bash
npm install
```

2. Start the service:

```bash
npm start
```

3. Use the API:

- Upload: `POST http://localhost:3000/upload` with field `image`
- Status: `GET http://localhost:3000/status/:id`
- Results: `GET http://localhost:3000/results/:id`

### Docker

1. Build the container:

```bash
docker build -t vehicle-image-analyzer .
```

2. Run the container:

```bash
docker run -p 3000:3000 -v "${PWD}/uploads:/usr/src/app/uploads" -v "${PWD}/data.db:/usr/src/app/data.db" vehicle-image-analyzer
```

Or use Docker Compose:

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`.

## Sample Requests

Upload example using `curl`:

```bash
curl -F "image=@vehicle.jpg" http://localhost:3000/upload
```

If you want local samples, use the provided `sample-images` folder:

```bash
curl -F "image=@sample-images/vehicle-normal.jpg" http://localhost:3000/upload
```

Fetch status:

```bash
curl http://localhost:3000/status/<processingId>
```

Fetch results:

```bash
curl http://localhost:3000/results/<processingId>
```

## AI Usage Disclosure

- Used AI to help structure the service, choose heuristics, and draft code architecture.
- Validated generated code manually by reviewing logic and running the service.
- No AI-produced code was used without verification.

## Trade-offs and Improvements

### Simplifications
- Used an in-memory queue instead of Redis/BullMQ for simplicity.
- Used SQLite for persistence so the service runs locally without database setup.
- Avoided heavy external OCR dependencies to keep installation lightweight.

### What I'd improve with more time
- Add Redis-backed queue for durability and concurrency.
- Add proper authentication and rate limiting.
- Replace heuristics with a small ML model or OCR for license plate validation.
- Add end-to-end tests and Docker Compose for full stack startup.

### Scalability / Reliability Notes
- Current queue is single-process and does not survive restarts.
- SQLite is fine for prototypes, but a client should use PostgreSQL/MySQL in production.
- More robust retry and failure handling would be needed in multi-node deployments.
