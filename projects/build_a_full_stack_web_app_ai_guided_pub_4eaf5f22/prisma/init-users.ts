import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu khởi tạo dữ liệu tài khoản (chỉ Users)...');

  // Danh sách các tài khoản cơ bản cần thiết để đăng nhập và test
  const accounts = [
    {
      username: 'congdan',
      email: 'congdan@demo.vn',
      displayName: 'Nguyễn Văn A',
      role: 'user',
      password: 'UserDemo123!',
    },
    {
      username: 'quanly',
      email: 'quanly@demo.vn',
      displayName: 'Phạm Quản Lý',
      role: 'manager',
      password: 'ManagerDemo123!',
    },
    {
      username: 'admin',
      email: 'admin@demo.vn',
      displayName: 'Admin Hệ Thống',
      role: 'admin',
      password: 'AdminDemo123!',
    },
  ] as const;

  for (const a of accounts) {
    const passwordHash = await hashPassword(a.password);
    await prisma.user.upsert({
      where: { username: a.username },
      update: {
        email: a.email,
        displayName: a.displayName,
        role: a.role,
        passwordHash,
      },
      create: {
        username: a.username,
        email: a.email,
        displayName: a.displayName,
        role: a.role,
        passwordHash,
      },
    });
    console.log(`✅ Đã tạo/cập nhật tài khoản [${a.role.toUpperCase()}]: Tên đăng nhập: ${a.username} | Mật khẩu: ${a.password}`);
  }

  console.log('🎉 Hoàn tất khởi tạo dữ liệu Users!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi khởi tạo Users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
