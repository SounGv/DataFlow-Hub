import { Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const jti = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const token = await this.jwt.signAsync({
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      jti,
    } satisfies JwtPayload);
    await this.prisma.auditLog.create({
      data: { actor: user.email, action: 'login' },
    });
    return {
      accessToken: token,
      user: { id: user.id.toString(), email: user.email, displayName: user.displayName, role: user.role },
    };
  }

  /** Logout = denylist the token id until it would have expired */
  async logout(payload: JwtPayload, exp?: number) {
    const ttl = exp ? Math.max(exp - Math.floor(Date.now() / 1000), 1) : 8 * 3600;
    await this.redis.set(`denylist:${payload.jti}`, '1', 'EX', ttl);
    await this.prisma.auditLog.create({ data: { actor: payload.email, action: 'logout' } });
    return { ok: true };
  }

  async isDenied(jti: string): Promise<boolean> {
    return (await this.redis.exists(`denylist:${jti}`)) === 1;
  }
}
