import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export const Route = createRootRoute({
    component: () => (
        <div className="min-h-screen bg-background text-foreground font-sans antialiased">
            <Outlet />
            <TanStackRouterDevtools />
            <ReactQueryDevtools />
        </div>
    ),
})
