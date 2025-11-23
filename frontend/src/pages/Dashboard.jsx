import React, { useEffect, useState } from 'react'
import api from '../services/api'
import socketService from '../services/socket'
import { useAuthStore } from '../store/authStore'
import {
  Activity,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const { token } = useAuthStore()

  useEffect(() => {
    fetchOverview()

    // Connect to WebSocket
    if (token) {
      const socket = socketService.connect(token)

      socket.on('metric:update', (data) => {
        console.log('Metric update:', data)
        // Update UI with new metric data
      })

      socket.on('alert:new', (alert) => {
        console.log('New alert:', alert)
        // Show notification or update alerts list
        fetchOverview() // Refresh overview
      })

      socket.on('status:change', (data) => {
        console.log('Status change:', data)
        fetchOverview() // Refresh overview
      })
    }

    // Refresh data every 30 seconds
    const interval = setInterval(fetchOverview, 30000)

    return () => {
      clearInterval(interval)
      socketService.disconnect()
    }
  }, [token])

  const fetchOverview = async () => {
    try {
      const response = await api.get('/dashboard/overview')
      setOverview(response.data.data)
    } catch (error) {
      console.error('Failed to fetch overview:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const stats = overview?.node_stats || {}

  return (
    <div className="space-y-6">
      {/* Stats Cards with staggered animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slideInUp">
          <StatCard
            title="Total Nodes"
            value={stats.total_nodes || 0}
            icon={Server}
            color="blue"
          />
        </div>
        <div className="animate-slideInUp animation-delay-100">
          <StatCard
            title="Nodes Up"
            value={stats.up_count || 0}
            icon={CheckCircle}
            color="green"
          />
        </div>
        <div className="animate-slideInUp animation-delay-200">
          <StatCard
            title="Nodes Down"
            value={stats.down_count || 0}
            icon={XCircle}
            color="red"
          />
        </div>
        <div className="animate-slideInUp animation-delay-300">
          <StatCard
            title="Active Alerts"
            value={overview?.active_alerts?.length || 0}
            icon={AlertTriangle}
            color="amber"
          />
        </div>
      </div>

      {/* Visualization Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node Status Distribution */}
        <div className="card animate-slideInLeft">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-3"></div>
            Node Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Up', value: stats.up_count || 0, color: '#10B981' },
                  { name: 'Down', value: stats.down_count || 0, color: '#EF4444' },
                  { name: 'Warning', value: stats.warning_count || 0, color: '#F59E0B' }
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {[
                  { name: 'Up', value: stats.up_count || 0, color: '#10B981' },
                  { name: 'Down', value: stats.down_count || 0, color: '#EF4444' },
                  { name: 'Warning', value: stats.warning_count || 0, color: '#F59E0B' }
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Node Types */}
        <div className="card animate-slideInRight">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full mr-3"></div>
            Infrastructure by Type
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={overview?.nodes_by_type || []}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="type" tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.5rem'
                }}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical Infrastructure Status */}
      <div className="card animate-fadeIn">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full mr-3"></div>
          Critical Infrastructure Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {overview?.critical_nodes?.slice(0, 12).map((node) => (
            <NodeStatusCard key={node.id} node={node} />
          ))}
        </div>
      </div>

      {/* Internet Links Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card animate-slideInLeft">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mr-3">
              <Activity className="w-5 h-5 text-white" />
            </div>
            Internet Links (Zabbix)
          </h2>
          <div className="space-y-3">
            {overview?.internet_links?.map((link, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      link.status === 'up' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <span className="font-medium">{link.link_name}</span>
                </div>
                <span
                  className={`badge ${
                    link.status === 'up' ? 'badge-success' : 'badge-danger'
                  }`}
                >
                  {link.status?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card animate-slideInRight">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mr-3 animate-pulse-slow">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            Recent Alerts
          </h2>
          <div className="space-y-3">
            {overview?.active_alerts?.length > 0 ? (
              overview.active_alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border-red-200'
                      : alert.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.node_name}</p>
                      <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                    </div>
                    <span
                      className={`badge ${
                        alert.severity === 'critical'
                          ? 'badge-danger'
                          : alert.severity === 'warning'
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(alert.triggered_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No active alerts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: 'stat-card-blue',
    green: 'stat-card-green',
    red: 'stat-card-red',
    amber: 'stat-card-amber',
    purple: 'stat-card-purple',
    cyan: 'stat-card-cyan',
  }

  return (
    <div className={`${colorClasses[color]} relative overflow-hidden`}>
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-sm text-white/80 mb-2 font-medium">{title}</p>
          <p className="text-4xl font-bold animate-scaleIn">{value}</p>
        </div>
        <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm animate-bounce">
          <Icon className="w-8 h-8" />
        </div>
      </div>
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
    </div>
  )
}

function NodeStatusCard({ node }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'up':
        return 'bg-green-500'
      case 'down':
        return 'bg-red-500'
      case 'warning':
        return 'bg-amber-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getIcon = (type) => {
    return <Server className="w-5 h-5 text-white" />
  }

  return (
    <div className="flex flex-col items-center p-4 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-300 hover:border-blue-300 animate-scaleIn">
      <div
        className={`w-14 h-14 rounded-full ${getStatusColor(
          node.status
        )} flex items-center justify-center mb-3 shadow-lg ${
          node.status === 'up' ? 'neon-green animate-pulse-slow' : node.status === 'down' ? 'neon-red' : ''
        }`}
      >
        {getIcon(node.type)}
      </div>
      <p className="text-xs font-semibold text-center truncate w-full text-gray-800" title={node.name}>
        {node.name}
      </p>
      <span
        className={`text-xs capitalize mt-2 px-3 py-1 rounded-full font-bold ${
          node.status === 'up'
            ? 'bg-green-100 text-green-700'
            : node.status === 'down'
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-700'
        }`}
      >
        {node.status}
      </span>
    </div>
  )
}

export default Dashboard
