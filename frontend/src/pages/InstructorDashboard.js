import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const InstructorDashboard = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', order_index: 0 });

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCourses();
      // Filter to show only courses created by this instructor
      const myCourses = Array.isArray(data) 
        ? data.filter(course => course.instructor_id === user?.id)
        : [];
      setCourses(myCourses);
    } catch (err) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = () => {
    setCourseForm({ title: '', description: '' });
    setEditingCourse(null);
    setShowCourseModal(true);
  };

  const handleEditCourse = (course) => {
    setCourseForm({ title: course.title || '', description: course.description || '' });
    setEditingCourse(course);
    setShowCourseModal(true);
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await api.deleteCourse(courseId);
      await loadCourses();
    } catch (err) {
      setError(err.message || 'Failed to delete course');
    }
  };

  const handleCourseSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingCourse) {
        await api.updateCourse(editingCourse.id, courseForm);
      } else {
        await api.createCourse(courseForm);
      }
      setShowCourseModal(false);
      await loadCourses();
    } catch (err) {
      setError(err.message || 'Failed to save course');
    }
  };

  const handleManageLessons = async (course) => {
    try {
      const fullCourse = await api.getCourse(course.id);
      const lessons = await api.getLessons(course.id);
      setSelectedCourse({ ...fullCourse, lessons });
    } catch (err) {
      setError(err.message || 'Failed to load course details');
    }
  };

  const handleCreateLesson = () => {
    const maxOrder = selectedCourse?.lessons?.length > 0
      ? Math.max(...selectedCourse.lessons.map(l => l.order_index || 0))
      : 0;
    setLessonForm({ title: '', content: '', order_index: maxOrder + 1 });
    setEditingLesson(null);
    setShowLessonModal(true);
  };

  const handleEditLesson = (lesson) => {
    setLessonForm({
      title: lesson.title || '',
      content: lesson.content || '',
      order_index: lesson.order_index || 0,
    });
    setEditingLesson(lesson);
    setShowLessonModal(true);
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    try {
      await api.deleteLesson(lessonId);
      const lessons = await api.getLessons(selectedCourse.id);
      setSelectedCourse({ ...selectedCourse, lessons });
    } catch (err) {
      setError(err.message || 'Failed to delete lesson');
    }
  };

  const handleLessonSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingLesson) {
        await api.updateLesson(editingLesson.id, lessonForm);
      } else {
        await api.createLesson(selectedCourse.id, lessonForm);
      }
      setShowLessonModal(false);
      const lessons = await api.getLessons(selectedCourse.id);
      setSelectedCourse({ ...selectedCourse, lessons });
    } catch (err) {
      setError(err.message || 'Failed to save lesson');
    }
  };

  return (
    <div>
      <Navbar title="Instructor Dashboard" />
      <div className="dashboard">
        {error && <div className="error-message">{error}</div>}
        
        <div className="dashboard-header">
          <h2>My Courses</h2>
          <button className="btn btn-primary" onClick={handleCreateCourse}>
            Create New Course
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <h4>No courses yet</h4>
            <p>Create your first course to get started</p>
          </div>
        ) : (
          <div className="course-grid">
            {courses.map((course) => (
              <div key={course.id} className="course-card">
                <h4>{course.title}</h4>
                <p>{course.description}</p>
                <div className="course-meta">
                  <span>Instructor: {course.instructor_email}</span>
                </div>
                <div className="course-actions">
                  <button className="btn btn-secondary" onClick={() => handleManageLessons(course)}>
                    Manage Lessons
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleEditCourse(course)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDeleteCourse(course.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCourseModal && (
          <div className="modal-overlay" onClick={() => setShowCourseModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editingCourse ? 'Edit Course' : 'Create Course'}</h3>
              <form onSubmit={handleCourseSubmit}>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    maxLength={5000}
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingCourse ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedCourse && (
          <div className="modal-overlay" onClick={() => setSelectedCourse(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Manage Lessons: {selectedCourse.title}</h3>
              <button className="btn btn-primary" onClick={handleCreateLesson} style={{ marginBottom: '20px' }}>
                Add Lesson
              </button>
              {selectedCourse.lessons && selectedCourse.lessons.length > 0 ? (
                <div className="lesson-list">
                  {selectedCourse.lessons
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    .map((lesson) => (
                      <div key={lesson.id} className="lesson-item">
                        <div className="lesson-info">
                          <h5>#{lesson.order_index} - {lesson.title}</h5>
                        </div>
                        <div className="lesson-actions">
                          <button className="btn btn-secondary" onClick={() => handleEditLesson(lesson)}>
                            Edit
                          </button>
                          <button className="btn btn-danger" onClick={() => handleDeleteLesson(lesson.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No lessons yet</p>
                </div>
              )}
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setSelectedCourse(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showLessonModal && (
          <div className="modal-overlay" onClick={() => setShowLessonModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editingLesson ? 'Edit Lesson' : 'Create Lesson'}</h3>
              <form onSubmit={handleLessonSubmit}>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Content</label>
                  <textarea
                    value={lessonForm.content}
                    onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                    maxLength={50000}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Order</label>
                  <input
                    type="number"
                    value={lessonForm.order_index}
                    onChange={(e) => setLessonForm({ ...lessonForm, order_index: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="1000"
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowLessonModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingLesson ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorDashboard;
