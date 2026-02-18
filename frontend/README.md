# Frontend - Online Learning Platform

Modern React frontend with security best practices.

## Features

- JWT-based authentication
- Role-based route protection
- Responsive design
- Progress tracking UI
- Course and lesson management

## Environment Variables

Create a `.env` file:

```
REACT_APP_API_BASE_URL=http://localhost:3000
```

## Installation

```bash
npm install
```

## Running

Development:
```bash
npm start
```

Production build:
```bash
npm run build
```

## Security Features

- JWT token validation with expiration checking
- Role-based access control
- Input validation and sanitization
- URL validation for API calls
- Request timeout enforcement
- XSS protection via React escaping
