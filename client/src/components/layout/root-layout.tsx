import { Outlet } from 'react-router'

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Outlet />
    </div>
  )
}
