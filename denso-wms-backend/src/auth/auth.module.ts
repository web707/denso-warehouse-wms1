import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
    PassportModule,
    // Registered with the access secret as a module-wide default; every
    // real signAsync/verifyAsync call in AuthService passes its own
    // secret+expiresIn explicitly (access vs refresh), so this default is
    // effectively unused but required by JwtModule's API.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret')!,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, MailService, JwtStrategy],
  exports: [AuthService, PasswordService],
})
export class AuthModule {}
