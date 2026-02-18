# Backend API - Online Learning Platform

Production-ready Node.js/Express backend API with comprehensive security features.

## Security Features

- JWT authentication with expiration validation
- Password hashing with bcrypt (configurable rounds)
- Rate limiting (100 requests per 15 minutes per IP)
- CORS with explicit allowlist
- Helmet.js security headers
- Input validation with express-validator
- SQL injection protection via parameterized queries
- Audit logging for all operations
- Role-based access control (RBAC)

## Environment Variables

Required environment variables (see `.env.example`):

- `JWT_SECRET`: Must be at least 32 characters (REQUIRED)
- `JWT_EXPIRY`: Token expiration time (default: 24h)
- `BCRYPT_ROUNDS`: Password hashing rounds, 10-15 (default: 12)
- `PORT`: Server port (default: 3000)
- `DB_PATH`: SQLite database path (default: ./learning_platform.db)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins (REQUIRED)
- `NODE_ENV`: Environment (development/production)

## Installation

```bash
npm install
```

## Running

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Documentation

All endpoints require JWT authentication except `/health`.

See main README.md for endpoint details.
