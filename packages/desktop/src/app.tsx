import { useStore } from '@nanostores/solid'
import { Route, Router } from '@solidjs/router'
import { Suspense, createEffect, onMount } from 'solid-js'
import { IPC } from './lib/ipc'
import Dashboard from './routes/dashboard'
import Results from './routes/results'
import Scan from './routes/scan'
import Settings from './routes/settings'
import { setTheme, $theme } from './stores/ui'
import './app.css'

export default function App() {
    const theme = useStore($theme)

    onMount(async () => {
        try {
            const settings = await IPC.getSettings()
            setTheme(settings.appearance.theme)
        } catch (error) {
            console.error('Failed to load app theme:', error)
        }
    })

    createEffect(() => {
        document.documentElement.dataset.theme = theme()
    })

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
