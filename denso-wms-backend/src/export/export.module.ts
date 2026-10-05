import { Module } from '@nestjs/common';
import { ExcelExporter } from './excel.exporter';

@Module({
  providers: [ExcelExporter],
  exports: [ExcelExporter],
})
export class ExportModule {}
