import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../auth/entities/user.entity';

export async function seedAdminUser(
  dataSource: DataSource,
  email: string,
  password: string,
  rounds: number,
): Promise<void> {
  const repo = dataSource.getRepository(User);
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await repo.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    // Never reset a live password from a seed run.
    // eslint-disable-next-line no-console
    console.log(`  admin user ${normalizedEmail} already exists — skipping`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, rounds);
  await repo.save(
    repo.create({
      email: normalizedEmail,
      passwordHash,
      fullName: 'Administrator',
      role: UserRole.ADMIN,
      isActive: true,
    }),
  );
  // eslint-disable-next-line no-console
  console.log(`  admin user created: ${normalizedEmail}`);
}
