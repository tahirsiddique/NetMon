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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Nodes"
          value={stats.total_nodes || 0}
          icon={Server}
          color="blue"
        />
        <StatCard
          title="Nodes Up"
          value={stats.up_count || 0}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Nodes Down"
          value={stats.down_count || 0}
          icon={XCircle}
          color="red"
        />
        <StatCard
          title="Active Alerts"
          value={overview?.active_alerts?.length || 0}
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Critical Infrastructure Status */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Critical Infrastructure Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {overview?.critical_nodes?.slice(0, 12).map((node) => (
            <NodeStatusCard key={node.id} node={node} />
          ))}
        </div>
      </div>

      {/* Internet Links Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
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
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
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
    <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div
        className={`w-12 h-12 rounded-full ${getStatusColor(
          node.status
        )} flex items-center justify-center mb-2 ${
          node.status === 'up' ? 'animate-pulse-slow' : ''
        }`}
      >
        {getIcon(node.type)}
      </div>
      <p className="text-xs font-medium text-center truncate w-full" title={node.name}>
        {node.name}
      </p>
      <span
        className={`text-xs capitalize mt-1 ${
          node.status === 'up'
            ? 'text-green-600'
            : node.status === 'down'
            ? 'text-red-600'
            : 'text-gray-600'
        }`}
      >
        {node.status}
      </span>
    </div>
  )
}

export default Dashboard
