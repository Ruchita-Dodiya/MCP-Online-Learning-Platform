import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const redirectPath = user.role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard';
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate]);

  const validateInput = () => {
    if (!formData.email || formData.email.trim().length === 0) {
      setError('Email is required');
      return false;
    }
    if (formData.email.length > 255) {
      setError('Email too long');
      return false;
    }
    if (!formData.password || formData.password.length === 0) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password.length > 128) {
      setError('Password too long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (!['student', 'instructor'].includes(formData.role)) {
      setError('Invalid role selected');
      return false;
    }
    return true;
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateInput()) return;

    setLoading(true);
    try {
      const response = await api.register({
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });
      if (!response || !response.token || !response.user) {
        throw new Error('Invalid server response');
      }
      login(response.user, response.token);
      const redirectPath = response.user.role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Register</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              maxLength={255}
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password (min 8 characters)</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="role">I am a:</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
