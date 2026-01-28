import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'antd-style'

export const Route = createRootRoute({
    component: () => (
        <ThemeProvider themeMode="auto">
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
                <Outlet />
            </div>
            <TanStackRouterDevtools />
            <ReactQueryDevtools />
        </ThemeProvider>
    ),
})
