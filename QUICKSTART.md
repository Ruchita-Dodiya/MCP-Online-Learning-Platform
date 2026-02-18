# Quick Start Guide

Get the Online Learning Platform up and running in 5 minutes!

## Step 1: Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
JWT_SECRET=this-is-a-secret-key-at-least-32-characters-long-for-development
JWT_EXPIRY=24h
BCRYPT_ROUNDS=12
PORT=3000
NODE_ENV=development
DB_PATH=./learning_platform.db
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

Start the backend:
```bash
npm start
```

You should see: `Server running on http://127.0.0.1:3000`

## Step 2: Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
REACT_APP_API_BASE_URL=http://localhost:3000
```

Start the frontend:
```bash
npm start
```

The browser should automatically open to `http://localhost:3001`

## Step 3: Create Your First Account

1. Click "Register"
2. Choose "Instructor" role
3. Enter your email and password (min 8 characters)
4. Click "Register"

You'll be automatically logged in and redirected to the Instructor Dashboard.

## Step 4: Create Your First Course

1. Click "Create New Course"
2. Enter a title (e.g., "Introduction to Web Development")
3. Enter a description
4. Click "Create"

## Step 5: Add Lessons

1. Click "Manage Lessons" on your course
2. Click "Add Lesson"
3. Fill in:
   - Title: "Lesson 1: Getting Started"
   - Content: Your lesson content here...
   - Order: 1
4. Click "Create"
5. Add more lessons as needed

## Step 6: Test as a Student

1. Logout
2. Click "Register"
3. Choose "Student" role
4. Create a student account
5. Browse available courses
6. Click "Enroll Now" on a course
7. Click "View Course" to start learning!

## Troubleshooting

### Backend won't start
- Make sure `JWT_SECRET` is at least 32 characters
- Make sure `ALLOWED_ORIGINS` is set
- Check that port 3000 is not in use

### Frontend can't connect to backend
- Verify backend is running on port 3000
- Check `REACT_APP_API_BASE_URL` in frontend `.env`
- Make sure `ALLOWED_ORIGINS` in backend includes `http://localhost:3001`

### Database errors
- Delete `learning_platform.db` and restart the backend (it will recreate)
- Make sure you have write permissions in the backend directory

## Next Steps

- Read the full README.md for detailed documentation
- Customize the UI in `frontend/src/App.css`
- Add more features to the backend API
- Deploy to production (see README.md for production setup)
