/**
 * @file: use-auth.ts
 * @description: Хук для управления аутентификацией пользователя
 * @dependencies: @tanstack/react-query, auth.ts, telegram.ts, api routes
 * @created: 2026-03-01
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@shared/routes';
import { getAuthToken, setAuthToken, clearAuthToken, isAuthenticated } from '@/lib/auth';
import { getTelegramInitData, getTelegramUserId } from '@/lib/telegram';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  displayName: string;
  email: string | null;
  role: string;
  tariff: 'basic' | 'standard' | 'premium';
  subscriptionEndsAt: string | null;
  trialUsed: boolean;
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  linkTelegram: () => Promise<void>;
}

/**
 * Хук для управления аутентификацией
 */
export function useAuth(): UseAuthReturn {
  const queryClient = useQueryClient();

  // Автоматический логин через Telegram при наличии initData
  const telegramInitData = getTelegramInitData();
  const shouldAutoLoginTelegram = !!telegramInitData && !getAuthToken();

  // Автологин через Telegram
  const telegramLoginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.loginTelegram.path, {
        method: api.auth.loginTelegram.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': telegramInitData || '',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Failed to login via Telegram');
      }

      const data = api.auth.loginTelegram.responses[200].parse(await res.json());
      return data;
    },
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  // Автоматический запуск Telegram логина при монтировании
  useEffect(() => {
    if (shouldAutoLoginTelegram && !telegramLoginMutation.isPending) {
      telegramLoginMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoLoginTelegram]);

  // Получение данных текущего пользователя
  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      if (!getAuthToken()) {
        return null;
      }

      const res = await fetch(api.auth.me.path, {
        method: api.auth.me.method,
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        credentials: 'include',
      });

      if (res.status === 401) {
        clearAuthToken();
        return null;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch user data');
      }

      return api.auth.me.responses[200].parse(await res.json());
    },
    enabled: isAuthenticated() || telegramLoginMutation.isSuccess,
    retry: false,
  });

  // Логин через email/пароль
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Invalid credentials');
      }

      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  // Регистрация
  const registerMutation = useMutation({
    mutationFn: async ({ 
      displayName, 
      email, 
      password 
    }: { 
      displayName: string; 
      email: string; 
      password: string;
    }) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(error.error || 'Failed to register');
      }

      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  // Привязка Telegram к существующему аккаунту
  const linkTelegramMutation = useMutation({
    mutationFn: async () => {
      const telegramUserId = getTelegramUserId();
      
      if (!telegramUserId) {
        throw new Error('Telegram user ID not available');
      }

      const res = await apiRequest(
        api.auth.linkProvider.method,
        api.auth.linkProvider.path,
        {
          provider: 'telegram',
          externalId: String(telegramUserId),
        }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to link Telegram' }));
        throw new Error(error.error || 'Failed to link Telegram');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const logout = () => {
    clearAuthToken();
    queryClient.clear();
    window.location.href = '/login';
  };

  return {
    user: userQuery.data ?? null,
    isLoading: userQuery.isLoading || telegramLoginMutation.isPending,
    isAuthenticated: isAuthenticated() && !!userQuery.data,
    login: async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    register: async (displayName: string, email: string, password: string) => {
      await registerMutation.mutateAsync({ displayName, email, password });
    },
    logout,
    linkTelegram: async () => {
      await linkTelegramMutation.mutateAsync();
    },
  };
}
