import { Component, JSX } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
    'inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    {
        variants: {
            variant: {
                primary:
                    'text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
                secondary:
                    'text-gray-700 bg-white hover:bg-gray-50 focus:ring-primary-500 border-gray-300',
                danger: 'text-white bg-danger-600 hover:bg-danger-700 focus:ring-danger-500',
                outline:
                    'text-primary-600 bg-transparent hover:bg-primary-50 focus:ring-primary-500 border-primary-300',
            },
            size: {
                sm: 'px-3 py-1.5 text-xs',
                md: 'px-4 py-2 text-sm',
                lg: 'px-6 py-3 text-base',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
)

export interface ButtonProps
    extends
        JSX.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean
    children: JSX.Element
}

export const Button: Component<ButtonProps> = (props) => {
    const {
        variant,
        size,
        loading,
        children,
        class: className,
        ...rest
    } = props

    return (
        <button
            class={buttonVariants({ variant, size, className })}
            disabled={loading || rest.disabled}
            {...rest}
        >
            {loading && (
                <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    />
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </button>
    )
}
