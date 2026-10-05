import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User, UserRole } from './entities/user.entity';
import { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function msFromDuration(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 15 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unitMs = DURATION_UNIT_MS[match[2]] ?? 60_000;
  return value * unitMs;
}

// jsonwebtoken's `expiresIn` type only accepts a number (seconds) or a
// branded `ms`-style string literal type it can't verify from a runtime
// config value — converting to seconds sidesteps that without an `any` cast.
function expiresInSeconds(duration: string): number {
  return Math.round(msFromDuration(duration) / 1000);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly mailService: MailService,
  ) {}

  // env.validation.ts guarantees these keys are present strings at boot;
  // ConfigService's generic signature just can't express that.
  private requireConfig(key: string): string {
    return this.config.get<string>(key)!;
  }

  async register(email: string, password: string, fullName?: string): Promise<AuthResponseDto> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email đã được sử dụng' });
    }
    const passwordHash = await this.passwordService.hash(password);
    const user = await this.users.save(
      this.users.create({
        email: normalizedEmail,
        passwordHash,
        fullName: fullName ?? null,
        role: UserRole.USER,
      }),
    );
    return this.issueTokenPair(user);
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.users.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Sai email hoặc mật khẩu',
      });
    }
    const valid = await this.passwordService.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Sai email hoặc mật khẩu',
      });
    }
    return this.issueTokenPair(user);
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.requireConfig('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token không hợp lệ',
      });
    }

    const tokenHash = sha256(refreshToken);
    const stored = await this.refreshTokens.findOne({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'REFRESH_UNKNOWN',
        message: 'Refresh token không tồn tại',
      });
    }
    if (stored.revokedAt) {
      // Reuse of an already-rotated/revoked token: treat as a stolen-token
      // signal and revoke every active session for this user.
      await this.refreshTokens.update(
        { userId: stored.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException({
        code: 'REFRESH_REUSED',
        message: 'Refresh token đã bị thu hồi',
      });
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_EXPIRED',
        message: 'Refresh token đã hết hạn',
      });
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Người dùng không tồn tại',
      });
    }

    const result = await this.issueTokenPair(user);
    const newHash = sha256(result.refreshToken);
    await this.refreshTokens.update(stored.id, {
      revokedAt: new Date(),
      replacedByTokenHash: newHash,
    });

    return result;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { email: email.trim().toLowerCase() } });
    // Always behave the same regardless of whether the account exists
    // (anti user-enumeration) — the controller always returns 202.
    if (!user) return;

    const rawToken = randomUUID() + randomUUID();
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.resetTokens.save(
      this.resetTokens.create({ userId: user.id, tokenHash, expiresAt, usedAt: null }),
    );

    const resetUrl = `${this.requireConfig('appPublicUrl')}/reset-password?token=${rawToken}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256(token);
    const stored = await this.resetTokens.findOne({ where: { tokenHash } });
    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      });
    }
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.users.update(stored.userId, { passwordHash });
    await this.resetTokens.update(stored.id, { usedAt: new Date() });
    // Revoke all existing sessions so a leaked-password scenario can't
    // persist through an old refresh token after the password changes.
    await this.refreshTokens.update(
      { userId: stored.userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokenPair(user: User): Promise<AuthResponseDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.requireConfig('jwt.accessSecret'),
        expiresIn: expiresInSeconds(this.requireConfig('jwt.accessExpiresIn')),
      },
    );
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti },
      {
        secret: this.requireConfig('jwt.refreshSecret'),
        expiresIn: expiresInSeconds(refreshExpiresIn),
      },
    );

    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + msFromDuration(refreshExpiresIn)),
        revokedAt: null,
        replacedByTokenHash: null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }
}
