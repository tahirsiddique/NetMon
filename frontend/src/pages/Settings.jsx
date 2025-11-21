import React from 'react'
import { Settings as SettingsIcon } from 'lucide-react'

function Settings() {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <SettingsIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h2>
        <p className="text-gray-600">System configuration and preferences</p>
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
          <p className="text-sm text-blue-800">Coming soon: Alert configuration, user management, and system settings</p>
        </div>
      </div>
    </div>
  )
}

export default Settings
