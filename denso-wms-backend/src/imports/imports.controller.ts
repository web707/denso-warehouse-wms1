import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportResult } from './dto/import-preview.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get('template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="import-template.xlsx"')
  async template(@Res() res: Response): Promise<void> {
    const buffer = await this.service.buildTemplate();
    res.send(buffer);
  }

  @Post('xlsx')
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  @ApiQuery({
    name: 'targetOrderId',
    required: false,
    type: String,
    description:
      'When set, every parsed PART row is attached to this exact order, ignoring whatever ' +
      "order number the file's own contents declare — used when importing into an order " +
      'the user already has open, so a file that happens to share its order number with a ' +
      'different existing order never gets merged into that other order by mistake.',
  })
  @ApiQuery({
    name: 'targetRackId',
    required: false,
    type: String,
    description:
      'When set, imported PARTs are attached directly to this rack. The rack order is used as the target order automatically.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async importXlsx(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
    @Query('targetOrderId') targetOrderId?: string,
    @Query('targetRackId') targetRackId?: string,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Thiếu file .xlsx' });
    }
    const isDryRun = dryRun !== 'false';
    return this.service.parseAndMaybeCommit(
      file.buffer,
      isDryRun,
      file.originalname,
      targetOrderId,
      targetRackId,
    );
  }
}
