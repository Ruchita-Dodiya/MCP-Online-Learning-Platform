import { getAuthToken, clearAuthToken } from './auth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
const REQUEST_TIMEOUT = 30000;

if (!API_BASE_URL || API_BASE_URL.trim() === '') {
  throw new Error('REACT_APP_API_BASE_URL must be configured');
}

const sanitizeURL = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch (error) {
    throw new Error('Invalid URL');
  }
};

const createAbortController = () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  return { controller, timeoutId };
};

const apiRequest = async (endpoint, options = {}) => {
  const { controller, timeoutId } = createAbortController();
  
  try {
    const url = sanitizeURL(`${API_BASE_URL}${endpoint}`);
    const token = getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Request failed');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

export const api = {
  register: (data) => {
    if (!data.email || !data.password || !data.role) {
      throw new Error('Missing required fields');
    }
    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: (data) => {
    if (!data.email || !data.password) {
      throw new Error('Missing required fields');
    }
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCourses: async () => {
    const data = await apiRequest('/api/courses');
    return Array.isArray(data.courses) ? data.courses : [];
  },

  getCourse: (id) => {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid course ID');
    }
    return apiRequest(`/api/courses/${id}`).then(data => data.course);
  },

  createCourse: (data) => {
    if (!data.title || !data.description) {
      throw new Error('Missing required fields');
    }
    return apiRequest('/api/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(data => data.course);
  },

  updateCourse: (id, data) => {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid course ID');
    }
    return apiRequest(`/api/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then(data => data.course);
  },

  deleteCourse: (id) => {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid course ID');
    }
    return apiRequest(`/api/courses/${id}`, {
      method: 'DELETE',
    });
  },

  getLessons: (courseId) => {
    if (!courseId || typeof courseId !== 'number') {
      throw new Error('Invalid course ID');
    }
    return apiRequest(`/api/courses/${courseId}/lessons`).then(data => data.lessons || []);
  },

  createLesson: (courseId, data) => {
    if (!courseId || typeof courseId !== 'number') {
      throw new Error('Invalid course ID');
    }
    if (!data.title || !data.content) {
      throw new Error('Missing required fields');
    }
    return apiRequest(`/api/courses/${courseId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(data => data.lesson);
  },

  updateLesson: (id, data) => {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid lesson ID');
    }
    return apiRequest(`/api/lessons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then(data => data.lesson);
  },

  deleteLesson: (id) => {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid lesson ID');
    }
    return apiRequest(`/api/lessons/${id}`, {
      method: 'DELETE',
    });
  },

  enrollCourse: (courseId) => {
    if (!courseId || typeof courseId !== 'number') {
      throw new Error('Invalid course ID');
    }
    return apiRequest('/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ course_id: courseId }),
    });
  },

  getEnrollments: () => apiRequest('/api/enrollments').then(data => data.enrollments || []),

  getProgress: (courseId) => {
    if (!courseId || typeof courseId !== 'number') {
      throw new Error('Invalid course ID');
    }
    return apiRequest(`/api/courses/${courseId}/progress`).then(data => data.progress || []);
  },

  updateProgress: (lessonId, completed) => {
    if (!lessonId || typeof lessonId !== 'number') {
      throw new Error('Invalid lesson ID');
    }
    return apiRequest('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: lessonId, completed }),
    }).then(data => data.progress);
  },
};
