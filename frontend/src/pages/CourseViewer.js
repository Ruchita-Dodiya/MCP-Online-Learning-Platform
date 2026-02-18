import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';

const CourseViewer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    setLoading(true);
    setError('');
    try {
      const courseIdNum = parseInt(courseId);
      if (isNaN(courseIdNum)) {
        throw new Error('Invalid course ID');
      }
      const [courseData, progressData] = await Promise.all([
        api.getCourse(courseIdNum),
        api.getProgress(courseIdNum),
      ]);
      setCourse(courseData);
      setProgress(progressData);
      
      if (courseData.lessons && courseData.lessons.length > 0) {
        const sortedLessons = [...courseData.lessons].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        const completedSet = new Set(progressData.map(p => p.lesson_id));
        const firstIncomplete = sortedLessons.findIndex(l => !completedSet.has(l.id));
        setCurrentLessonIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = async (lessonId) => {
    try {
      await api.updateProgress(lessonId, true);
      await loadCourseData();
    } catch (err) {
      setError(err.message || 'Failed to mark lesson as complete');
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar title="Loading..." />
        <div className="loading">Loading course...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div>
        <Navbar title="Error" />
        <div className="dashboard">
          <div className="error-message">{error || 'Course not found'}</div>
          <button className="btn btn-secondary" onClick={() => navigate('/student/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const sortedLessons = course.lessons ? [...course.lessons].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)) : [];
  const completedLessonIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const completedCount = sortedLessons.filter(l => completedLessonIds.has(l.id)).length;
  const totalLessons = sortedLessons.length;
  const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const currentLesson = sortedLessons[currentLessonIndex];

  const handleNextLesson = () => {
    if (currentLessonIndex < sortedLessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  const handlePreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  return (
    <div>
      <Navbar title={course.title} />
      <div className="dashboard">
        {error && <div className="error-message">{error}</div>}
        
        <div className="section">
          <h3>Course Progress</h3>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercentage}%` }}>
              {progressPercentage}%
            </div>
          </div>
          <div className="progress-text">
            {completedCount} of {totalLessons} lessons completed
          </div>
        </div>

        {sortedLessons.length === 0 ? (
          <div className="empty-state">
            <h4>No lessons available</h4>
            <p>This course doesn't have any lessons yet</p>
          </div>
        ) : (
          <>
            <div className="lesson-viewer">
              <h3>{currentLesson?.title}</h3>
              <div className="lesson-content">
                {currentLesson?.content}
              </div>
              {currentLesson && !completedLessonIds.has(currentLesson.id) && (
                <button
                  className="btn btn-success"
                  onClick={() => handleCompleteLesson(currentLesson.id)}
                >
                  Mark as Complete
                </button>
              )}
              {currentLesson && completedLessonIds.has(currentLesson.id) && (
                <div className="success-message">Lesson completed!</div>
              )}
              <div className="lesson-navigation">
                <button
                  className="btn btn-secondary"
                  onClick={handlePreviousLesson}
                  disabled={currentLessonIndex === 0}
                >
                  Previous Lesson
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleNextLesson}
                  disabled={currentLessonIndex === sortedLessons.length - 1}
                >
                  Next Lesson
                </button>
              </div>
            </div>

            <div className="section">
              <h3>All Lessons</h3>
              <div className="lesson-list">
                {sortedLessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className={`lesson-item ${
                      completedLessonIds.has(lesson.id) ? 'completed' : ''
                    } ${index === currentLessonIndex ? 'active' : ''}`}
                    onClick={() => setCurrentLessonIndex(index)}
                  >
                    <div className="lesson-info">
                      <h5>#{lesson.order_index} - {lesson.title}</h5>
                      <p>{completedLessonIds.has(lesson.id) ? 'Completed' : 'Not completed'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="btn btn-secondary" onClick={() => navigate('/student/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default CourseViewer;
