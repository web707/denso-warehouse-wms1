import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import AppDataSource from '../../config/data-source';
import { seedAdminUser } from './admin-user.seed';
import { seedContainerTypes } from './container-types.seed';
import { seedDivisions } from './divisions.seed';
import { seedPackingRules } from './packing-rules.seed';
import { seedSampleOrder } from './sample-order.seed';
import { seedTransactionHistory } from './transaction-history.seed';

loadEnv();

const RESET_TABLES = [
  'carton_placements',
  'load_plans',
  'parts',
  'orders',
  'containers',
  'history_events',
  'inventory_transactions',
  'refresh_tokens',
  'password_reset_tokens',
];

async function reset(dataSource: import('typeorm').DataSource): Promise<void> {
  // Deliberately does NOT truncate users, divisions, dc_prefixes,
  // container_types, or packing_rules — resetting business data should
  // not log admins out or wipe the reference catalogue.
  await dataSource.query(
    `TRUNCATE ${RESET_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  // eslint-disable-next-line no-console
  console.log(`  reset: truncated ${RESET_TABLES.join(', ')}`);
}

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');
  const withSample =
    args.includes('--with-sample') || process.env.SEED_WITH_SAMPLE_ORDER === 'true';
  const withTransactions =
    args.includes('--with-transactions') ||
    args.includes('--transactions') ||
    process.env.SEED_WITH_TRANSACTIONS === 'true';

  await AppDataSource.initialize();
  // eslint-disable-next-line no-console
  console.log('Connected. Seeding DENSO Warehouse WMS...');

  try {
    if (shouldReset) {
      await reset(AppDataSource);
    }

    await seedDivisions(AppDataSource);
    await seedContainerTypes(AppDataSource);
    await seedPackingRules(AppDataSource);

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    if (adminEmail && adminPassword) {
      await seedAdminUser(AppDataSource, adminEmail, adminPassword, rounds);
    } else {
      // eslint-disable-next-line no-console
      console.log('  SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD not set — skipping admin user');
    }

    if (withSample) {
      await seedSampleOrder(AppDataSource);
    }

    if (withTransactions) {
      await seedTransactionHistory(AppDataSource);
    }

    // eslint-disable-next-line no-console
    console.log('Seed completed.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
