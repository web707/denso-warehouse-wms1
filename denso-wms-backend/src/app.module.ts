import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { DivisionsModule } from './divisions/divisions.module';
import { ContainerTypesModule } from './container-types/container-types.module';
import { PackingRulesModule } from './packing-rules/packing-rules.module';
import { OrdersModule } from './orders/orders.module';
import { PartsModule } from './parts/parts.module';
import { ContainersModule } from './containers/containers.module';
import { HistoryModule } from './history/history.module';
import { ImportsModule } from './imports/imports.module';
import { LoadingModule } from './packing/loading.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { WarehouseZonesModule } from './warehouse-zones/warehouse-zones.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { InspectionsModule } from './inspections/inspections.module';
import { ShipmentsModule } from './shipments/shipments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthModule,
    DivisionsModule,
    ContainerTypesModule,
    PackingRulesModule,
    OrdersModule,
    PartsModule,
    ContainersModule,
    HistoryModule,
    ImportsModule,
    LoadingModule,
    HealthModule,
    InventoryModule,
    WarehouseZonesModule,
    WorkOrdersModule,
    InspectionsModule,
    ShipmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
