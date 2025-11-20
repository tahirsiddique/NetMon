import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Server, RefreshCw } from 'lucide-react'

function Nodes() {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchNodes()
  }, [])

  const fetchNodes = async () => {
    try {
      setLoading(true)
      const response = await api.get('/nodes')
      setNodes(response.data.data)
    } catch (error) {
      console.error('Failed to fetch nodes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      up: 'badge-success',
      down: 'badge-danger',
      warning: 'badge-warning',
      unknown: 'badge-info',
    }
    return badges[status] || 'badge-info'
  }

  const filteredNodes = filter === 'all' ? nodes : nodes.filter((n) => n.type === filter)

  const nodeTypes = [...new Set(nodes.map((n) => n.type))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Infrastructure Nodes</h1>
          <p className="text-gray-600 mt-1">Manage and monitor all infrastructure devices</p>
        </div>
        <button onClick={fetchNodes} className="btn btn-primary flex items-center" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All ({nodes.length})
        </button>
        {nodeTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors capitalize ${
              filter === type
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {type.replace('_', ' ')} ({nodes.filter((n) => n.type === type).length})
          </button>
        ))}
      </div>

      {/* Nodes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
              ) : filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No nodes found
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => (
                  <tr key={node.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Server className="w-5 h-5 text-gray-400 mr-3" />
                        <div className="font-medium text-gray-900">{node.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 capitalize">
                        {node.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">{node.ip_address}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${getStatusBadge(node.status)}`}>
                        {node.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {node.last_seen
                        ? new Date(node.last_seen).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Nodes
