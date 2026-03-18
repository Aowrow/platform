import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.roles.upsert({
    where: { code: 'admin' },
    update: { name: 'Administrator', description: 'Platform administrator' },
    create: {
      code: 'admin',
      name: 'Administrator',
      description: 'Platform administrator'
    }
  });

  const userRole = await prisma.roles.upsert({
    where: { code: 'user' },
    update: { name: 'User', description: 'Normal user' },
    create: {
      code: 'user',
      name: 'User',
      description: 'Normal user'
    }
  });

  const adminUser = await prisma.users.upsert({
    where: { username: 'admin' },
    update: {
      nickname: '系统管理员',
      status: 1
    },
    create: {
      username: 'admin',
      passwordHash: 'TEMP_HASH_REPLACE_ME',
      nickname: '系统管理员',
      status: 1,
      email: 'admin@example.com'
    }
  });

  await prisma.user_roles.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id
    }
  });

  await prisma.user_roles.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: userRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: userRole.id
    }
  });

  await prisma.system_configs.upsert({
    where: { configKey: 'comfyui.base_url' },
    update: { configValue: 'http://127.0.0.1:8188' },
    create: {
      configKey: 'comfyui.base_url',
      configValue: 'http://127.0.0.1:8188',
      valueType: 'string',
      description: 'ComfyUI base URL'
    }
  });

  await prisma.system_configs.upsert({
    where: { configKey: 'comfyui.poll_interval_ms' },
    update: { configValue: '3000' },
    create: {
      configKey: 'comfyui.poll_interval_ms',
      configValue: '3000',
      valueType: 'number',
      description: 'Polling interval in milliseconds'
    }
  });

  await prisma.system_configs.upsert({
    where: { configKey: 'storage.default_bucket' },
    update: { configValue: 'aigc-assets' },
    create: {
      configKey: 'storage.default_bucket',
      configValue: 'aigc-assets',
      valueType: 'string',
      description: 'Default object storage bucket'
    }
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
