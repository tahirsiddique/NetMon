import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { Globe, Download, RefreshCw, Search, TrendingUp, Users, Activity } from 'lucide-react'

function InternetUsage() {
  const [topUsers, setTopUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [protocols, setProtocols] = useState([])
  const [timeRange, setTimeRange] = useState('today')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])

  useEffect(() => {
    fetchUsageData()
  }, [timeRange])

  const fetchUsageData = async () => {
    try {
      setLoading(true)

      const [usersRes, statsRes, protocolsRes] = await Promise.all([
        api.get(`/internet-usage/top-users?range=${timeRange}&limit=20`),
        api.get(`/internet-usage/stats?range=${timeRange}`),
        api.get(`/internet-usage/protocols?range=${timeRange}`)
      ])

      setTopUsers(usersRes.data.data || [])
      setStats(statsRes.data.data || null)
      setProtocols(protocolsRes.data.data || [])

    } catch (error) {
      console.error('Failed to fetch usage data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) return

    try {
      const res = await api.get(`/internet-usage/search?q=${encodeURIComponent(searchTerm)}`)
      setSearchResults(res.data.data || [])
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get(`/internet-usage/export?range=${timeRange}`, {
        responseType: 'blob'
      })

      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `internet_usage_${timeRange}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Internet Usage Tracking</h1>
          <p className="text-gray-600 mt-1">Per-user bandwidth monitoring via NetFlow</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
          </select>

          <button
            onClick={fetchUsageData}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button onClick={handleExport} className="btn btn-primary flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Bandwidth"
            value={formatBytes(Number(stats.total_bytes))}
            icon={Globe}
            color="blue"
          />
          <StatCard
            title="Unique Users"
            value={Number(stats.unique_users) || 0}
            icon={Users}
            color="green"
          />
          <StatCard
            title="Known Users"
            value={Number(stats.known_users) || 0}
            icon={Activity}
            color="purple"
          />
          <StatCard
            title="Total Flows"
            value={Number(stats.total_flows) || 0}
            icon={TrendingUp}
            color="amber"
          />
        </div>
      )}

      {/* Search */}
      <div className="card">
        <div className="flex items-center space-x-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by username or hostname..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button onClick={handleSearch} className="btn btn-primary">
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="font-semibold text-sm text-gray-700">Search Results:</h3>
            {searchResults.map((user, idx) => (
              <div
                key={idx}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{user.username}</span>
                    <span className="text-sm text-gray-600 ml-2">({user.hostname})</span>
                  </div>
                  <span className="text-xs text-gray-500">{user.ip_address}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Users Table */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Top Internet Users</h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hostname
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Download
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Upload
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : topUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <Globe className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>No usage data available</p>
                        <p className="text-sm mt-1">Start the NetFlow collector to begin tracking</p>
                      </td>
                    </tr>
                  ) : (
                    topUsers.map((user, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{idx + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{user.username}</div>
                          <div className="text-xs text-gray-500">{user.ip_address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.hostname || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatBytes(Number(user.bytes_received))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatBytes(Number(user.bytes_sent))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                          {formatBytes(Number(user.total_bytes))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Protocol Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Protocol Distribution</h2>

          {protocols.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No protocol data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {protocols.map((protocol, idx) => {
                const totalBytes = protocols.reduce((sum, p) => sum + Number(p.total_bytes), 0)
                const percentage = totalBytes > 0 ? (Number(protocol.total_bytes) / totalBytes) * 100 : 0

                return (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{protocol.protocol}</span>
                      <span className="text-sm text-gray-600">
                        {formatBytes(Number(protocol.total_bytes))}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {percentage.toFixed(1)}% - {Number(protocol.unique_ips)} unique IPs
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
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

export default InternetUsage
