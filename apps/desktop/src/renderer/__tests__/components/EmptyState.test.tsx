import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../helpers/render-helpers'
import EmptyState from '../../components/EmptyState'

describe('EmptyState', () => {
  it('renders icon, title, and description', () => {
    renderWithProviders(
      <EmptyState
        icon="📝"
        title="No Data"
        description="Get started by adding some data"
      />
    )

    expect(screen.getByText('📝')).toBeInTheDocument()
    expect(screen.getByText('No Data')).toBeInTheDocument()
    expect(screen.getByText('Get started by adding some data')).toBeInTheDocument()
  })

  it('renders primary action button when provided', () => {
    const handleAction = jest.fn()

    renderWithProviders(
      <EmptyState
        icon="📊"
        title="No Charts"
        description="Import data to see visualizations"
        action={{ label: 'Import Now', onClick: handleAction }}
      />
    )

    const button = screen.getByText('Import Now')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(handleAction).toHaveBeenCalled()
  })

  it('renders without action button', () => {
    renderWithProviders(
      <EmptyState
        icon="✅"
        title="All Done"
        description="Nothing left to do"
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders secondary action when provided', () => {
    const handleSecondary = jest.fn()

    renderWithProviders(
      <EmptyState
        icon="📁"
        title="Empty"
        description="No files"
        secondaryAction={{ label: 'Learn More', onClick: handleSecondary }}
      />
    )

    const button = screen.getByText('Learn More')
    fireEvent.click(button)

    expect(handleSecondary).toHaveBeenCalled()
  })
})
