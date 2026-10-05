import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('mail.host');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.port'),
        auth: {
          user: this.config.get<string>('mail.user'),
          pass: this.config.get<string>('mail.password'),
        },
      });
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const from = this.config.get<string>('mail.from');
    const subject = 'Đặt lại mật khẩu - Logibackend';
    const text = `Nhấn vào đường dẫn sau để đặt lại mật khẩu (hết hạn sau 1 giờ): ${resetUrl}`;

    if (!this.transporter) {
      // No SMTP configured (dev default): log instead of sending, so
      // /auth/forgot-password stays fully testable with no mail infrastructure.
      this.logger.log(`[DEV MAIL] To: ${to} | Subject: ${subject} | Reset URL: ${resetUrl}`);
      return;
    }

    await this.transporter.sendMail({ from, to, subject, text });
  }
}
