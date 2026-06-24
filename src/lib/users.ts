export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  initials: string;
}

export const USERS: User[] = [
  {
    id: 'user-1',
    name: 'João Silva',
    avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    initials: 'JS'
  },
  {
    id: 'user-2',
    name: 'Maria Costa',
    avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    initials: 'MC'
  }
];
