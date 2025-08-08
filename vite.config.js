import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // Allows access via IP (e.g., 192.168.x.x)
    port: 5173,       // Optional: specify port
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '4c5d82302f9e.ngrok-free.app',  // <-- your ngrok host
	]
  },
})