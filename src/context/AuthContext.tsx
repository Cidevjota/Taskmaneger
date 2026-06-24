import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../lib/users';

export interface UserProfile extends User {
  email: string;
  role: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent login
    const savedUser = localStorage.getItem('@taskmanager:user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    
    // Fetch all users
    const fetchUsers = async () => {
      const { data, error } = await supabase.from('users_profile').select('*');
      if (data && !error) {
        const formattedUsers = data.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatarUrl: u.avatar_url,
          initials: u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        }));
        setAllUsers(formattedUsers);
        
        // Update current user if it was saved to get latest avatar/name
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          const latest = formattedUsers.find(f => f.id === parsed.id);
          if (latest) {
            setCurrentUser(latest);
            localStorage.setItem('@taskmanager:user', JSON.stringify(latest));
          }
        }
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('users_profile')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.error('Supabase Login Error:', error);
      return { success: false, error: 'Erro do servidor: ' + error.message };
    }
    if (!data) {
      return { success: false, error: `O e-mail "${cleanEmail}" (tamanho: ${cleanEmail.length}) não foi encontrado no sistema.` };
    }
    if (data.password !== pass) {
      return { success: false, error: `Senha incorreta. A senha digitada tem ${pass.length} caracteres.` };
    }

    const profile: UserProfile = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      avatarUrl: data.avatar_url,
      initials: data.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    };

    setCurrentUser(profile);
    localStorage.setItem('@taskmanager:user', JSON.stringify(profile));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('@taskmanager:user');
  };

  return (
    <AuthContext.Provider value={{ currentUser, allUsers, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
