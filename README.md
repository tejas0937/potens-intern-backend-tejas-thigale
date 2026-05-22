# Tamper-Evident Append Only Log Service

A backend service where every event is written once and can never be edited or deleted. Each entry is cryptographically linked to the previous one using SHA-256 chaining, so any tampering is immediately detectable.

Built with Node.js, Express and PostgreSQL.

## How to Run

### Prerequisites
- Node.js v18 or above
- PostgreSQL running locally

### Setup

1. Clone the repo
   git clone https://github.com/tejas0937/potens-intern-backend-tejas-thigale.git
   cd potens-intern-backend-tejas-thigale

2. Install dependencies
   npm install

3. Create a PostgreSQL database
   psql -U postgres
   CREATE DATABASE demo_log;
   \q

4. Create a .env file in the root with these values
   PORT=3000
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=demo_log
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432
   API_KEY=myapikey123

5. Run the migration to create the logs table
   npm run migrate

6. Start the server
   npm run dev

Server will be running at http://localhost:3000

## API Endpoints

All endpoints require the header x-api-key: myapikey123

### POST /log
Add a new log entry. Automatically computes and stores a SHA-256 chain hash linking to the previous entry.

Request body:
{
  "name": "tejas",
  "action": "user_login",
  "payload": { "ip": "192.168.1.1" }
}

### GET /log/:id
Returns a single log entry by id along with a chain_valid field indicating whether its hash is still intact.

### GET /verify
Scans the entire chain from first to last entry. Returns pass if all hashes are valid or fail with the first broken entry id if tampering is detected.

### GET /export
Returns a filtered JSON export of log entries. Supports optional query params:
- name (filter by name)
- from (start date, ISO format)
- to (end date, ISO format)

Example: GET /export?name=tejas&from=2026-01-01&to=2026-12-31

## Design Decisions
## Request Flow (POST /log)

```
Request comes in
      |
      v
API key check (middleware)        < blocked if no valid key
      |
      v
Rate limit check (middleware)     < blocked if too many requests
      |
      v
Controller receives name, action, payload
      |
      v
Fetch last entry hash from DB
      |
      v
Compute new hash = SHA256(prevHash + name + action + payload)
      |
      v
Insert new row into PostgreSQL
      |
      v
Return the saved entry as JSON
```

### SHA-256 Chain Hashing
Each log entry stores a hash computed from the previous entry's hash combined with the current entry's name, action and payload. This means every entry is mathematically linked to the one before it. If any entry is edited after insertion, its hash will no longer match what was computed at insert time, and the verify endpoint will catch it immediately.

### Why prev_hash is stored explicitly
Storing prev_hash in each row makes verification self-contained. A third party can verify the entire chain without any external state, just the table itself.

### JSON payload serialization
PostgreSQL stores JSONB in its own internal order which can differ from insertion order. To ensure the hash computed at insert time always matches the hash computed at verify time, payload keys are sorted before hashing using JSON.stringify with a key sorter. This was a real bug caught during development and fixing it taught me a lot about how databases handle JSON internally.

### Rate limiting on POST
The POST /log endpoint is rate limited to 30 requests per minute per IP using express-rate-limit. This prevents spam and abuse while being generous enough for legitimate use.

### API key auth
A simple API key check via x-api-key header protects all endpoints. In a production system this would be replaced with JWT tokens and per-client key management, but for this scope it keeps things clean and auditable.

## What is Broken or Unfinished

- No pagination on GET /export, if the table has millions of rows this will be slow
- API key is a single shared key, in production each client should have their own key
- No soft delete or archival mechanism, the append-only constraint is enforced by convention not by database-level permissions
- TRUNCATE is possible by a superuser, a production setup would revoke that permission from the app user

## What I Would Build Next

- Merkle tree batching so GET /verify stays fast on 100k+ entries instead of scanning every row
- A CLI command npm run verify that runs the full chain check from the terminal
- Per-client API key management with a keys table
- Pagination and cursor-based scrolling on GET /export
- Database-level INSERT-only permissions so even the app cannot update or delete rows
- Docker setup so anyone can boot the whole thing with one command

## AI Use Log

| Tool - Claude (claude.ai)
| Approximate Messages ~50 messages
| Used For - 
1. Project architecture guidance
2. Understanding how Express maps to Java Spring Boot concepts I already knew (routes = @RestController, controllers = service logic, middleware = Spring filters, db = repository layer)
3. Debugging the JSONB hash mismatch issue
4. Docker implementation assistance