import { Outlet } from 'react-router'
import { Navbar } from './navbar'
import { Footer } from './footer'

export function PublicLayout() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
