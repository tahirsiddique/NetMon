import React, { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Globe,
  Wifi,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navigation = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Infrastructure Nodes', path: '/nodes', icon: Server },
    { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { name: 'Internet Usage', path: '/internet-usage', icon: Globe },
    { name: 'Internet Links', path: '/internet-links', icon: Wifi },
    { name: 'Security', path: '/security', icon: Shield },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full relative">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 pointer-events-none"></div>

          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-white/10 relative z-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg animate-pulse-slow">
                <Server className="w-6 h-6 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Digiskills Monitor</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto relative z-10">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 group ${
                    active
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105 hover:shadow-md'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                    active
                      ? 'bg-white/20'
                      : 'bg-white/5 group-hover:bg-white/10'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Section */}
          <div className="border-t border-white/10 p-4 relative z-10">
            <div className="flex items-center space-x-3 mb-3 p-3 bg-white/5 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                <p className="text-xs text-gray-300 capitalize px-2 py-0.5 bg-white/10 rounded-full inline-block">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-pink-600 rounded-xl hover:from-red-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`lg:pl-64 transition-all duration-300`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200 h-16 shadow-sm">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 flex items-center justify-between">
              <h1 className="text-xl font-bold gradient-text ml-4 lg:ml-0">
                {navigation.find((item) => isActive(item.path))?.name || 'Dashboard'}
              </h1>

              <div className="flex items-center space-x-4">
                <div className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                  {new Date().toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default Layout
