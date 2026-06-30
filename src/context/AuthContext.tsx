import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../lib/users';

export interface UserProfile extends User {
  email: string;
  role: string;
  preferences?: any;
  permissionLevel?: number;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
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
          preferences: u.preferences || {},
          avatarUrl: u.avatar_url,
          permissionLevel: u.preferences?.permissionLevel ? Number(u.preferences.permissionLevel) : (u.name?.toLowerCase().includes('cidnei') ? 1 : 2),
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
      preferences: data.preferences || {},
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

  const updateProfile = async (updates: Partial<UserProfile>, newPassword?: string) => {
    if (!currentUser) return { success: false, error: 'Not logged in' };

    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.email) payload.email = updates.email;
    if (updates.role) payload.role = updates.role;
    if (updates.preferences) payload.preferences = updates.preferences;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (newPassword) payload.password = newPassword;

    const { error } = await supabase
      .from('users_profile')
      .update(payload)
      .eq('id', currentUser.id);

    if (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }

    const updatedProfile = { ...currentUser, ...updates };
    if (updates.name) {
      updatedProfile.initials = updates.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    setCurrentUser(updatedProfile);
    localStorage.setItem('@taskmanager:user', JSON.stringify(updatedProfile));
    
    // Update in allUsers array too
    setAllUsers(prev => prev.map(u => u.id === updatedProfile.id ? updatedProfile : u));

    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ currentUser, allUsers, login, logout, updateProfile, loading }}>
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
