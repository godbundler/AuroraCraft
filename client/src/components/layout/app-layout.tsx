import { Outlet } from 'react-router'
import { Navbar } from './navbar'

export function AppLayout() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </>
  )
}
