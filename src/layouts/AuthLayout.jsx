import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-layout-root">
      <Outlet />
    </div>
  );
}

export default AuthLayout;
