import { Link } from 'react-router-dom'

export function SiteFooter() {
  return <footer className="footer">
    <Link className="wordmark" to="/discover">common<span>.</span></Link>
    <p>Good finds. Great everyday.</p>
    <span>Made for the way you live.</span>
  </footer>
}
