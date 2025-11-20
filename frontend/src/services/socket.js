import { io } from 'socket.io-client'

class SocketService {
  constructor() {
    this.socket = null
    this.connected = false
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    this.socket.on('connect', () => {
      console.log('✓ WebSocket connected')
      this.connected = true
    })

    this.socket.on('disconnect', () => {
      console.log('✗ WebSocket disconnected')
      this.connected = false
    })

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    this.socket.on('connected', (data) => {
      console.log('Server acknowledgment:', data)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data)
    }
  }

  subscribeToNodes(nodeIds) {
    if (this.socket && Array.isArray(nodeIds)) {
      this.socket.emit('subscribe:nodes', nodeIds)
    }
  }

  unsubscribeFromNodes(nodeIds) {
    if (this.socket && Array.isArray(nodeIds)) {
      this.socket.emit('unsubscribe:nodes', nodeIds)
    }
  }
}

export default new SocketService()
