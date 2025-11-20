import React from 'react'
import { AlertTriangle } from 'lucide-react'

function Alerts() {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Alerts Management</h2>
        <p className="text-gray-600">This feature will be implemented in Phase 6</p>
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
          <p className="text-sm text-blue-800">Coming soon: Alert rules configuration and notification management</p>
        </div>
      </div>
    </div>
  )
}

export default Alerts
