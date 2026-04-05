import { Route, Router } from '@solidjs/router'
import { Suspense } from 'solid-js'
import Dashboard from './routes/dashboard'
import Results from './routes/results'
import Scan from './routes/scan'
import Settings from './routes/settings'
import './app.css'

export default function App() {
    return (
        <Router
            preload={false}
            root={(props) => <Suspense>{props.children}</Suspense>}
        >
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/scan" component={Scan} />
            <Route path="/results" component={Results} />
            <Route path="/settings" component={Settings} />
        </Router>
    )
}
