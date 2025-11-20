import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { AlertTriangle, CheckCircle, Clock, Bell, Shield, Plus, RefreshCw, Filter } from 'lucide-react'

function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active') // active, resolved, all
  const [severityFilter, setSeverityFilter] = useState('all')

  useEffect(() => {
    fetchAlerts()
    fetchStatistics()
  }, [filter, severityFilter])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter !== 'all') params.append('status', filter)
      if (severityFilter !== 'all') params.append('severity', severityFilter)

      const res = await api.get(`/alerts?${params.toString()}`)
      setAlerts(res.data.data || [])
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      const res = await api.get('/alerts/statistics?timeRange=24h')
      setStatistics(res.data.data)
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    }
  }

  const handleAcknowledge = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/acknowledge`, {
        comment: 'Acknowledged via dashboard'
      })
      fetchAlerts()
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
      alert('Failed to acknowledge alert')
    }
  }

  const handleResolve = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/resolve`, {
        comment: 'Resolved via dashboard'
      })
      fetchAlerts()
      fetchStatistics()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
      alert('Failed to resolve alert')
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'warning':
        return <Shield className="w-5 h-5 text-amber-600" />
      case 'info':
        return <Bell className="w-5 h-5 text-blue-600" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-gray-600 mt-1">Monitor and manage system alerts</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAlerts}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Alerts (24h)"
            value={Number(statistics.total_alerts) || 0}
            icon={Bell}
            color="blue"
          />
          <StatCard
            title="Active Alerts"
            value={Number(statistics.active_count) || 0}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Critical"
            value={Number(statistics.critical_count) || 0}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Acknowledged"
            value={Number(statistics.acknowledged_count) || 0}
            icon={CheckCircle}
            color="green"
          />
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Alerts List</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No alerts found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-0.5">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold">{alert.node_name || 'System'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white">
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.acknowledged && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <p className="text-sm mb-2">{alert.message}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(alert.triggered_at).toLocaleString()}
                        </span>
                        {alert.metric_type && (
                          <span>Metric: {alert.metric_type}</span>
                        )}
                        {alert.current_value && (
                          <span>Current: {alert.current_value}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!alert.resolved_at && (
                    <div className="flex items-center space-x-2 ml-4">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                      >
                        Resolve
                      </button>
                    </div>
                  )}

                  {alert.resolved_at && (
                    <div className="ml-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Resolved {new Date(alert.resolved_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start">
          <Bell className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Alert Management
            </h3>
            <p className="text-sm text-blue-800 mb-2">
              Alerts are automatically triggered based on configured rules. Acknowledged alerts will still be tracked but won't generate additional notifications.
            </p>
            <p className="text-sm text-blue-800">
              Configure alert rules, thresholds, and notification preferences to customize your monitoring experience.
            </p>
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
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

export default Alerts
