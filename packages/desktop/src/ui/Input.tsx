import { Component, JSX } from 'solid-js'
import { TextField } from '@kobalte/core/text-field'
import { clsx } from 'clsx'

interface InputProps {
    label?: string
    placeholder?: string
    value?: string
    onChange?: (value: string) => void
    error?: string
    class?: string
    type?: 'text' | 'password' | 'email' | 'number'
}

export const Input: Component<InputProps> = (props) => {
    const {
        label,
        placeholder,
        value,
        onChange,
        error,
        class: className,
        type = 'text',
    } = props

    return (
        <TextField class="space-y-1" value={value} onChange={onChange}>
            {label && (
                <TextField.Label class="block text-sm font-medium text-gray-700">
                    {label}
                </TextField.Label>
            )}
            <TextField.Input
                type={type}
                placeholder={placeholder}
                class={clsx(
                    'block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm',
                    error ? 'border-danger-300' : 'border-gray-300',
                    className
                )}
            />
            {error && (
                <TextField.ErrorMessage class="text-sm text-danger-600">
                    {error}
                </TextField.ErrorMessage>
            )}
        </TextField>
    )
}
