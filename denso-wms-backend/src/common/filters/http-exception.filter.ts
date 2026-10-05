import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) || exception.message;
        details = r.details ?? (Array.isArray(r.message) ? r.message : undefined);
        code = (r.code as string) || HttpStatus[statusCode] || 'ERROR';
      }
      code = code === 'ERROR' ? this.codeFromStatus(statusCode) : code;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    const envelope: ErrorEnvelope = {
      statusCode,
      code,
      message,
      details,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(envelope);
  }

  private codeFromStatus(status: number): string {
    return HttpStatus[status] || 'ERROR';
  }
}
