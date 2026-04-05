import { mount, StartClient } from '@solidjs/start/client'

const startClient = mount(
    () => <StartClient />,
    document.getElementById('app')!
)

export default startClient
