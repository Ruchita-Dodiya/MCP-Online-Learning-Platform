import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';

const StudentDashboard = () => {
  const [allCourses, setAllCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [coursesData, enrollmentsData] = await Promise.all([
        api.getCourses(),
        api.getEnrollments(),
      ]);
      setAllCourses(Array.isArray(coursesData) ? coursesData : []);
      setEnrolledCourses(Array.isArray(enrollmentsData) ? enrollmentsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await api.enrollCourse(courseId);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to enroll');
    }
  };

  const handleViewCourse = (courseId) => {
    navigate(`/student/course/${courseId}`);
  };

  const enrolledCourseIds = new Set(enrolledCourses.map((e) => e.course_id));
  const availableCourses = allCourses.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <div>
      <Navbar title="Student Dashboard" />
      <div className="dashboard">
        {error && <div className="error-message">{error}</div>}

        <div className="section">
          <h3>My Enrolled Courses</h3>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : enrolledCourses.length === 0 ? (
            <div className="empty-state">
              <h4>No enrolled courses</h4>
              <p>Browse available courses below to get started</p>
            </div>
          ) : (
            <div className="course-grid">
              {enrolledCourses.map((enrollment) => {
                const course = allCourses.find((c) => c.id === enrollment.course_id);
                if (!course) return null;
                return (
                  <div key={course.id} className="course-card" onClick={() => handleViewCourse(course.id)}>
                    <h4>{course.title}</h4>
                    <p>{course.description}</p>
                    <div className="course-meta">
                      <span>Enrolled: {new Date(enrollment.enrolled_at).toLocaleDateString()}</span>
                    </div>
                    <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleViewCourse(course.id); }}>
                      View Course
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="section">
          <h3>Available Courses</h3>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : availableCourses.length === 0 ? (
            <div className="empty-state">
              <h4>No available courses</h4>
              <p>You are enrolled in all courses</p>
            </div>
          ) : (
            <div className="course-grid">
              {availableCourses.map((course) => (
                <div key={course.id} className="course-card">
                  <h4>{course.title}</h4>
                  <p>{course.description}</p>
                  <div className="course-meta">
                    <span>Instructor: {course.instructor_email}</span>
                  </div>
                  <button className="btn btn-primary" onClick={() => handleEnroll(course.id)}>
                    Enroll Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
