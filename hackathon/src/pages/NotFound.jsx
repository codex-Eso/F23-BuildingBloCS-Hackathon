import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div style={{ maxWidth: 720, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link to="/app" style={{ color: '#06f' }}>
        Go to app
      </Link>
    </div>
  )
}


