import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/store/auth'
import { Toaster } from '@/components/Toaster'
import { Layout } from '@/components/Layout'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import type { ReactNode } from 'react'
import { LOGO_URL } from '@/lib/assets'

// Route-level code splitting: each page ships as its own chunk, loaded on demand.
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Products = lazy(() => import('@/pages/Products'))
const POS = lazy(() => import('@/pages/POS'))
const Settings = lazy(() => import('@/pages/Settings'))
const Purchases = lazy(() => import('@/pages/Purchases'))
const Suppliers = lazy(() => import('@/pages/Suppliers'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const Treasury = lazy(() => import('@/pages/Treasury'))
const Reports = lazy(() => import('@/pages/Reports'))
const Customers = lazy(() => import('@/pages/Customers'))
const StockMovements = lazy(() => import('@/pages/StockMovements'))
const Returns = lazy(() => import('@/pages/Returns'))
const Users = lazy(() => import('@/pages/Users'))
const Accounting = lazy(() => import('@/pages/Accounting'))
const Orders = lazy(() => import('@/pages/Orders'))
const Reviews = lazy(() => import('@/pages/Reviews'))
const Store = lazy(() => import('@/pages/Store'))

function Splash() {
  return (
    <div className="min-h-screen grid place-items-center bg-cream">
      <div className="text-center">
        <img src={LOGO_URL} alt="Loly" className="w-20 h-20 rounded-3xl mx-auto shadow-soft mb-4 object-cover" />
        <Spinner className="w-7 h-7 mx-auto" />
      </div>
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { session, initializing } = useAuth()
  if (initializing) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/store" element={<Suspense fallback={<Splash />}><Store /></Suspense>} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/products" element={<Products />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/stock" element={<StockMovements />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/treasury" element={<Treasury />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/users" element={<Users />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
      <Toaster />
    </AuthProvider>
  )
}
