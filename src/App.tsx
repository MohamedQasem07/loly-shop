import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/store/auth'
import { Toaster } from '@/components/Toaster'
import { Layout } from '@/components/Layout'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products'
import POS from '@/pages/POS'
import Settings from '@/pages/Settings'
import Purchases from '@/pages/Purchases'
import Suppliers from '@/pages/Suppliers'
import Expenses from '@/pages/Expenses'
import Treasury from '@/pages/Treasury'
import Reports from '@/pages/Reports'
import Customers from '@/pages/Customers'
import StockMovements from '@/pages/StockMovements'
import Returns from '@/pages/Returns'
import Users from '@/pages/Users'
import Accounting from '@/pages/Accounting'
import Orders from '@/pages/Orders'
import Store from '@/pages/Store'
import type { ReactNode } from 'react'
import { LOGO_URL } from '@/lib/assets'

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
      <Route path="/store" element={<Store />} />
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
