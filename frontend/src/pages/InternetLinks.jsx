import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Activity, TrendingUp, Settings } from 'lucide-react'

function InternetLinks() {
  const [links, setLinks] = useState([])
  const [stats, setStats] = useState(null)
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchLinksData()
  }, [filterStatus, filterType])

  const fetchLinksData = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.append('status', filterStatus)
      if (filterType !== 'all') params.append('type', filterType)

      const [linksRes, statsRes, problemsRes] = await Promise.all([
        api.get(`/zabbix/links?${params.toString()}`),
        api.get('/zabbix/links/stats'),
        api.get('/zabbix/problems').catch(() => ({ data: { data: [] } }))
      ])

      setLinks(linksRes.data.data || [])
      setStats(statsRes.data.data || null)
      setProblems(problemsRes.data.data || [])

    } catch (error) {
      console.error('Failed to fetch links data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await api.post('/zabbix/sync')

      if (res.data.success) {
        console.log('Sync completed:', res.data.message)
        // Refresh data after sync
        await fetchLinksData()
      }
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed. Make sure Zabbix is configured correctly.')
    } finally {
      setSyncing(false)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 bps'
    const k = 1024
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'up': return 'text-green-600 bg-green-50'
      case 'down': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status) => {
    return status === 'up' ? (
      <Wifi className="w-5 h-5 text-green-600" />
    ) : status === 'down' ? (
      <WifiOff className="w-5 h-5 text-red-600" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-gray-600" />
    )
  }

  const getLinkTypeIcon = (type) => {
    const icons = {
      fiber: '🚀',
      dsl: '📡',
      wireless: '📶',
      satellite: '🛰️',
      backup: '🔄',
      unknown: '❓'
    }
    return icons[type] || icons.unknown
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Internet Links Monitoring</h1>
          <p className="text-gray-600 mt-1">Zabbix integration for WAN link status</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLinksData}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary flex items-center"
          >
            <Activity className={`w-4 h-4 mr-2 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Zabbix'}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Links"
            value={Number(stats.total_links) || 0}
            icon={Activity}
            color="blue"
          />
          <StatCard
            title="Links Up"
            value={Number(stats.links_up) || 0}
            icon={Wifi}
            color="green"
          />
          <StatCard
            title="Links Down"
            value={Number(stats.links_down) || 0}
            icon={WifiOff}
            color="red"
          />
          <StatCard
            title="Total Bandwidth"
            value={formatBytes(Number(stats.total_bandwidth_in) + Number(stats.total_bandwidth_out))}
            icon={TrendingUp}
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="fiber">Fiber</option>
              <option value="dsl">DSL</option>
              <option value="wireless">Wireless</option>
              <option value="satellite">Satellite</option>
              <option value="backup">Backup</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Problems */}
      {problems.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-900">Active Problems ({problems.length})</h3>
          </div>
          <div className="space-y-2">
            {problems.slice(0, 5).map((problem, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg border border-red-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-red-900">{problem.description}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Host: {problem.host} • Severity: {problem.severity}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatLastSeen(problem.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internet Links Table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Internet Links</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Link Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  IP Address
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Bandwidth In
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Bandwidth Out
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <Wifi className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No internet links found</p>
                    <p className="text-sm mt-1">Click "Sync from Zabbix" to load link data</p>
                  </td>
                </tr>
              ) : (
                links.map((link, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(link.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{link.link_name}</div>
                      {link.description && (
                        <div className="text-sm text-gray-500">{link.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getLinkTypeIcon(link.link_type)} {link.link_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {link.ip_address || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {link.bandwidth_in ? formatBytes(Number(link.bandwidth_in)) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {link.bandwidth_out ? formatBytes(Number(link.bandwidth_out)) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {formatLastSeen(link.last_seen)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Hint */}
      {links.length === 0 && !loading && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start">
            <Settings className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Zabbix Integration Setup
              </h3>
              <p className="text-sm text-blue-800">
                Configure Zabbix API credentials in your .env file:
              </p>
              <pre className="mt-2 text-xs bg-white p-2 rounded border border-blue-200 overflow-x-auto">
{`ZABBIX_URL=http://your-zabbix-server/api_jsonrpc.php
ZABBIX_USER=api_user
ZABBIX_PASSWORD=your_password`}
              </pre>
              <p className="text-sm text-blue-800 mt-2">
                Create a host group named "Internet Links" in Zabbix and add your WAN links to it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
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

export default InternetLinks
