import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../helpers/render-helpers'
import ThemeToggle from '../../components/ThemeToggle'
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext'

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

describe('ThemeToggle', () => {
  it('renders toggle button', () => {
    renderWithProviders(
      <TestWrapper>
        <ThemeToggle />
      </TestWrapper>
    )

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows correct title based on current theme', () => {
    renderWithProviders(
      <TestWrapper>
        <ThemeToggle />
      </TestWrapper>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', expect.stringMatching(/Switch to (light|dark) mode/))
  })

  it('toggles theme on click', () => {
    function TestComponent() {
      const { resolvedTheme } = useTheme()
      return (
        <div>
          <ThemeToggle />
          <div data-testid="current-theme">{resolvedTheme}</div>
        </div>
      )
    }

    renderWithProviders(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    )

    const button = screen.getByRole('button')
    const themeDisplay = screen.getByTestId('current-theme')
    const initialTheme = themeDisplay.textContent

    fireEvent.click(button)

    expect(themeDisplay.textContent).not.toBe(initialTheme)
  })
})
