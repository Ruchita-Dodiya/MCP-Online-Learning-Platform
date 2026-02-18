# Online Learning Platform

A full-stack web platform where instructors can upload courses and students can enroll, watch lessons, and track their progress.

## Features

### For Instructors
- Create, edit, and delete courses
- Add, edit, and delete lessons within courses
- Organize lessons with order indices
- View all courses created

### For Students
- Browse available courses
- Enroll in courses
- View enrolled courses with progress tracking
- Watch lessons sequentially
- Mark lessons as complete
- Track overall course progress

## Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database
- **JWT** authentication
- **bcrypt** for password hashing
- Security features: rate limiting, CORS, helmet, input validation

### Frontend
- **React** 18 with hooks
- **React Router** for navigation
- **Context API** for state management
- Responsive design with modern UI

## Project Structure

```
Online Learning Platform/
├── backend/
│   ├── server.js          # Main API server
│   ├── package.json       # Backend dependencies
│   └── .env.example       # Environment variables template
├── frontend/
│   ├── public/
│   │   └── index.html     # HTML template
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React context providers
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utility functions
│   │   ├── App.js         # Main app component
│   │   └── index.js       # Entry point
│   └── package.json       # Frontend dependencies
└── README.md              # This file
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (copy from `.env.example`):
```bash
# Required environment variables
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long-change-this-in-production
JWT_EXPIRY=24h
BCRYPT_ROUNDS=12
PORT=3000
NODE_ENV=development
DB_PATH=./learning_platform.db
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

**Important**: Change `JWT_SECRET` to a secure random string (at least 32 characters) in production!

4. Start the backend server:
```bash
npm start
```

The server will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
REACT_APP_API_BASE_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3001` (or the next available port)

## Usage

### Creating an Account

1. Open the application in your browser
2. Click "Register"
3. Choose your role (Instructor or Student)
4. Fill in your email and password (minimum 8 characters)
5. Click "Register"

### As an Instructor

1. Login with your instructor account
2. Click "Create New Course"
3. Fill in the course title and description
4. Click "Create"
5. Click "Manage Lessons" on any course
6. Click "Add Lesson" to add lessons
7. Fill in lesson title, content, and order index
8. Lessons are displayed in order based on the order index

### As a Student

1. Login with your student account
2. Browse available courses
3. Click "Enroll Now" on any course
4. Click "View Course" on enrolled courses
5. Navigate through lessons using "Previous Lesson" and "Next Lesson"
6. Click "Mark as Complete" when finished with a lesson
7. Track your progress with the progress bar

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create course (instructor only)
- `PUT /api/courses/:id` - Update course (instructor only)
- `DELETE /api/courses/:id` - Delete course (instructor only)

### Lessons
- `GET /api/courses/:courseId/lessons` - Get lessons for a course
- `GET /api/lessons/:id` - Get lesson by ID
- `POST /api/courses/:courseId/lessons` - Create lesson (instructor only)
- `PUT /api/lessons/:id` - Update lesson (instructor only)
- `DELETE /api/lessons/:id` - Delete lesson (instructor only)

### Enrollments
- `POST /api/enrollments` - Enroll in a course (student only)
- `GET /api/enrollments` - Get student's enrollments
- `DELETE /api/enrollments/:id` - Unenroll from course

### Progress
- `POST /api/progress` - Update lesson progress (student only)
- `GET /api/courses/:courseId/progress` - Get progress for a course

## Security Features

- JWT-based authentication with expiration
- Password hashing with bcrypt (12 rounds)
- Rate limiting (100 requests per 15 minutes per IP)
- CORS protection with allowlist
- Input validation and sanitization
- SQL injection protection via parameterized queries
- XSS protection via React's built-in escaping
- Content Security Policy headers
- Audit logging for all operations

## Database Schema

- **users**: User accounts (instructors and students)
- **courses**: Course information
- **lessons**: Lesson content within courses
- **enrollments**: Student course enrollments
- **progress**: Student lesson completion tracking
- **audit_log**: Security audit trail

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET` (at least 32 characters)
3. Configure `ALLOWED_ORIGINS` with your frontend URL
4. Use a production database (PostgreSQL/MySQL recommended)
5. Enable HTTPS
6. Set up proper logging and monitoring

### Frontend
1. Set `REACT_APP_API_BASE_URL` to your backend URL
2. Build the production bundle: `npm run build`
3. Serve the `build` folder with a web server (nginx recommended)
4. Enable HTTPS
5. Configure proper CORS on the backend

## License

This project is provided as-is for educational purposes.

## Support

For issues or questions, please check the code comments or create an issue in the repository.
