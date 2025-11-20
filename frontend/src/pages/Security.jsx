import React, { useState, useEffect } from 'react'
import { Shield, Activity, Users, AlertTriangle, Eye, Calendar, Download, LogOut } from 'lucide-react'
import api from '../services/api'

function Security() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [sessions, setSessions] = useState([])
  const [myActivity, setMyActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    eventType: 'all',
    severity: 'all',
    timeRange: '24h'
  })

  useEffect(() => {
    fetchData()
  }, [activeTab, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'dashboard') {
        const response = await api.get('/security/dashboard')
        setDashboard(response.data.data)
      } else if (activeTab === 'audit-logs') {
        const params = new URLSearchParams()
        if (filters.eventType !== 'all') params.append('eventType', filters.eventType)
        if (filters.severity !== 'all') params.append('severity', filters.severity)
        if (filters.timeRange !== 'all') params.append('timeRange', filters.timeRange)

        const response = await api.get(`/security/audit-logs?${params.toString()}`)
        setAuditLogs(response.data.data)
      } else if (activeTab === 'sessions') {
        const response = await api.get('/security/my/sessions')
        setSessions(response.data.data)
      } else if (activeTab === 'activity') {
        const response = await api.get('/security/my/activity')
        setMyActivity(response.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    } finally {
      setLoading(false)
    }
  }

  const revokeSession = async (sessionId) => {
    try {
      await api.post(`/security/sessions/${sessionId}/revoke`)
      fetchData()
    } catch (error) {
      console.error('Failed to revoke session:', error)
    }
  }

  const exportAuditLogs = async (format) => {
    try {
      const params = new URLSearchParams()
      params.append('format', format)
      if (filters.eventType !== 'all') params.append('eventType', filters.eventType)
      if (filters.severity !== 'all') params.append('severity', filters.severity)
      if (filters.timeRange !== 'all') params.append('timeRange', filters.timeRange)

      const response = await api.get(`/security/audit-logs/export?${params.toString()}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      })

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `audit-logs-${new Date().toISOString()}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      } else {
        const dataStr = JSON.stringify(response.data, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = window.URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `audit-logs-${new Date().toISOString()}.json`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error)
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'error': return 'text-orange-600 bg-orange-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'info': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getEventTypeIcon = (eventType) => {
    if (eventType.startsWith('AUTH_')) return '🔐'
    if (eventType.startsWith('USER_')) return '👤'
    if (eventType.startsWith('ALERT_')) return '🚨'
    if (eventType.startsWith('NODE_')) return '🖥️'
    if (eventType.startsWith('SECURITY_')) return '🛡️'
    if (eventType.startsWith('SYSTEM_')) return '⚙️'
    return '📋'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Security & Audit
          </h1>
          <p className="text-gray-600 mt-1">Monitor security events and audit logs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('audit-logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'audit-logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sessions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            My Sessions
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-2" />
            My Activity
          </button>
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Events (24h)</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {dashboard.totalEvents}
                  </p>
                </div>
                <Activity className="w-12 h-12 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Security Events</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {dashboard.securityEvents}
                  </p>
                </div>
                <AlertTriangle className="w-12 h-12 text-red-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Logins</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {dashboard.failedLogins}
                  </p>
                </div>
                <Shield className="w-12 h-12 text-orange-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {dashboard.activeSessions}
                  </p>
                </div>
                <Users className="w-12 h-12 text-green-600 opacity-20" />
              </div>
            </div>
          </div>

          {/* Recent Security Events */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Security Events</h3>
            </div>
            <div className="p-6">
              {dashboard.recentSecurityEvents && dashboard.recentSecurityEvents.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.recentSecurityEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <span className="text-2xl">{getEventTypeIcon(event.event_type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{event.event_type}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(event.severity)}`}>
                            {event.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{event.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>User: {event.username || 'System'}</span>
                          <span>IP: {event.ip_address || 'N/A'}</span>
                          <span>{new Date(event.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No recent security events</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit-logs' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                <select
                  value={filters.eventType}
                  onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Events</option>
                  <option value="AUTH_">Authentication</option>
                  <option value="USER_">User Management</option>
                  <option value="ALERT_">Alerts</option>
                  <option value="NODE_">Nodes</option>
                  <option value="SECURITY_">Security</option>
                  <option value="SYSTEM_">System</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                <select
                  value={filters.timeRange}
                  onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportAuditLogs('csv')}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => exportAuditLogs('json')}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    JSON
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Logs List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Audit Logs ({auditLogs.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent"></div>
                  <p className="text-gray-600 mt-4">Loading audit logs...</p>
                </div>
              ) : auditLogs.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="inline-flex items-center gap-2">
                            <span>{getEventTypeIcon(log.event_type)}</span>
                            {log.event_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.username || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.ip_address || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                          {log.details || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                            {log.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No audit logs found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Active Sessions</h3>
            <p className="text-sm text-gray-600 mt-1">Manage your active login sessions</p>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent"></div>
                <p className="text-gray-600 mt-4">Loading sessions...</p>
              </div>
            ) : sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">
                          {session.is_current ? 'Current Session' : 'Session'}
                        </span>
                        {session.is_current && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p><strong>IP Address:</strong> {session.ip_address}</p>
                        <p><strong>User Agent:</strong> {session.user_agent}</p>
                        <p><strong>Created:</strong> {new Date(session.created_at).toLocaleString()}</p>
                        <p><strong>Last Activity:</strong> {new Date(session.last_activity).toLocaleString()}</p>
                        <p><strong>Expires:</strong> {new Date(session.expires_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {!session.is_current && (
                      <button
                        onClick={() => revokeSession(session.id)}
                        className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No active sessions found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && myActivity && (
        <div className="space-y-6">
          {/* Activity Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Actions</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {myActivity.totalActions}
                  </p>
                </div>
                <Activity className="w-12 h-12 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Last Login</p>
                  <p className="text-sm font-semibold text-gray-900 mt-2">
                    {new Date(myActivity.lastLogin).toLocaleString()}
                  </p>
                </div>
                <Calendar className="w-12 h-12 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Logins</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">
                    {myActivity.failedLogins}
                  </p>
                </div>
                <AlertTriangle className="w-12 h-12 text-red-600 opacity-20" />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              {myActivity.recentActivity && myActivity.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {myActivity.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <span className="text-2xl">{getEventTypeIcon(activity.event_type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{activity.event_type}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(activity.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{activity.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>IP: {activity.ip_address || 'N/A'}</span>
                          <span className={`px-2 py-1 rounded-full ${getSeverityColor(activity.severity)}`}>
                            {activity.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Security
