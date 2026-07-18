const base = 'http://localhost:3000';

async function main() {
  // 1) Manager credentials on admin portal must fail
  const loginAdmin = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'quanly',
      password: 'ManagerDemo123!',
      portal: 'admin',
    }),
  });
  const loginAdminBody = await loginAdmin.json();
  console.log('manager→admin login', loginAdmin.status, loginAdminBody);
  // Expect 401 + generic message (no role leak)

  // 2) Manager login on manager portal, then hit /admin
  const loginMgr = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'quanly',
      password: 'ManagerDemo123!',
      portal: 'manager',
    }),
  });
  const setCookie = loginMgr.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  console.log('manager login', loginMgr.status, 'cookie', cookie.slice(0, 40));

  const adminPage = await fetch(`${base}/admin`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  console.log(
    'GET /admin as manager',
    adminPage.status,
    'location',
    adminPage.headers.get('location')
  );

  const approve = await fetch(`${base}/api/v1/admin/change-requests/x/approve`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
  });
  console.log('POST approve as manager', approve.status, await approve.json());

  // 3) Admin credentials on manager portal must fail (1:1 roles)
  const adminOnMgr = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'AdminDemo123!',
      portal: 'manager',
    }),
  });
  console.log('admin→manager login', adminOnMgr.status, await adminOnMgr.json());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
