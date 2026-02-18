export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const validateToken = () => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = parseJWT(token);
    if (!payload || !payload.exp) {
      clearAuthToken();
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp < currentTime) {
      clearAuthToken();
      return null;
    }

    if (!payload.userId || !payload.role) {
      clearAuthToken();
      return null;
    }

    return {
      id: payload.userId,
      email: payload.email || '',
      name: payload.name || '',
      role: payload.role,
    };
  } catch (error) {
    clearAuthToken();
    return null;
  }
};

const parseJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};
