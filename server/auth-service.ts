/**
 * @file: auth-service.ts
 * @description: Сервис аутентификации для мультипровайдерной системы
 * @dependencies: bcryptjs, jose, drizzle-orm, shared/schema
 * @created: 2026-03-01
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import { users, authProviders } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Ensure crypto is available globally for jose
if (!globalThis.crypto) {
  globalThis.crypto = crypto as any;
}

const BCRYPT_ROUNDS = 12;
const JWT_ALGORITHM = 'HS256';
const DEFAULT_JWT_TTL = '7d';
const TELEGRAM_AUTH_DATE_MAX_AGE_SECONDS = 600;

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    console.warn('[AuthService] JWT_SECRET not set, using default for development');
    return new TextEncoder().encode('dev-secret-change-in-production');
  }
  return new TextEncoder().encode(secret);
}

function getJWTExpiry(): string {
  return process.env.JWT_EXPIRES_IN || DEFAULT_JWT_TTL;
}

export interface JWTPayload {
  sub: number;
  role: string;
  iat?: number;
  exp?: number;
}

export interface User {
  id: number;
  displayName: string;
  email: string | null;
  role: string;
  isBlocked: boolean;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateJWT(userId: number, role: string): Promise<string> {
    const secret = getJWTSecret();
    const ttl = getJWTExpiry();

    const token = await new SignJWT({ role })
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setSubject(String(userId))
      .setIssuedAt()
      .setExpirationTime(ttl)
      .sign(secret);

    return token;
  }

  async verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
      const secret = getJWTSecret();
      const { payload } = await jwtVerify(token, secret, {
        algorithms: [JWT_ALGORITHM],
      });

      const sub = typeof payload.sub === 'string' ? Number(payload.sub) : payload.sub;
      
      if (!Number.isFinite(sub) || typeof payload.role !== 'string') {
        return null;
      }

      return {
        sub: sub as number,
        role: payload.role as string,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      console.error('[AuthService] JWT verification failed:', error);
      return null;
    }
  }

  async findOrCreateUserByProvider(
    provider: 'telegram' | 'email' | 'phone',
    externalId: string,
    metadata?: Record<string, unknown>
  ): Promise<User> {
    const existingProvider = await db
      .select()
      .from(authProviders)
      .where(and(eq(authProviders.provider, provider), eq(authProviders.externalId, externalId)))
      .limit(1);

    if (existingProvider.length > 0) {
      const userId = existingProvider[0].userId;
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (user.length === 0) {
        throw new Error('User not found for existing provider');
      }

      return {
        id: user[0].id,
        displayName: user[0].displayName,
        email: user[0].email,
        role: user[0].role,
        isBlocked: user[0].isBlocked,
      };
    }

    const displayName = this.generateDisplayName(provider, externalId, metadata);

    // Автоматическая активация Trial для новых пользователей (14 дней)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [newUser] = await db
      .insert(users)
      .values({
        displayName,
        email: null,
        passwordHash: null,
        role: 'user',
        isBlocked: false,
        tariff: 'standard',
        subscriptionEndsAt: trialEndsAt,
        trialUsed: true,
      })
      .returning();

    await db.insert(authProviders).values({
      userId: newUser.id,
      provider,
      externalId,
      metadata: metadata || null,
    });

    return {
      id: newUser.id,
      displayName: newUser.displayName,
      email: newUser.email,
      role: newUser.role,
      isBlocked: newUser.isBlocked,
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
    };
  }

  async linkProvider(
    userId: number,
    provider: 'telegram' | 'email' | 'phone',
    externalId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const existing = await db
      .select()
      .from(authProviders)
      .where(and(eq(authProviders.userId, userId), eq(authProviders.provider, provider)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Provider ${provider} already linked to this user`);
    }

    const externalIdExists = await db
      .select()
      .from(authProviders)
      .where(and(eq(authProviders.provider, provider), eq(authProviders.externalId, externalId)))
      .limit(1);

    if (externalIdExists.length > 0) {
      throw new Error(`External ID already linked to another user`);
    }

    await db.insert(authProviders).values({
      userId,
      provider,
      externalId,
      metadata: metadata || null,
    });
  }

  validateTelegramAuthDate(authDate: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    return age <= TELEGRAM_AUTH_DATE_MAX_AGE_SECONDS;
  }

  private generateDisplayName(
    provider: string,
    externalId: string,
    metadata?: Record<string, unknown>
  ): string {
    if (provider === 'telegram' && metadata) {
      const firstName = metadata.first_name as string | undefined;
      const lastName = metadata.last_name as string | undefined;
      const username = metadata.username as string | undefined;
      
      if (firstName) {
        return lastName ? `${firstName} ${lastName}` : firstName;
      }
      if (username) {
        return username;
      }
    }

    return `${provider}_${externalId}`;
  }
}

export const authService = new AuthService();
