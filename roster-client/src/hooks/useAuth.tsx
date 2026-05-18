import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'STORE_ADMIN';
  status?: string;
  storeId?: string | null;
  storeName?: string | null;
  store?: { id: string; name: string } | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

function getToken(): string | null {
  const ls = localStorage.getItem('token');
  if (ls) return ls;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return m ? m[1] : null;
}

function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.cookie = 'token=; path=/; max-age=0';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          // sync token to localStorage so both systems stay in sync
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
