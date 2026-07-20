import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // AUTH_DISABLED=true → เปิดใช้งานได้โดยไม่ต้อง login (ตั้งใน Render env)
    if (process.env.AUTH_DISABLED === 'true') return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload; tokenExp?: number }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload & { exp: number }>(token);
      if (await this.auth.isDenied(payload.jti)) throw new UnauthorizedException('Token revoked');
      req.user = payload;
      req.tokenExp = payload.exp;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
