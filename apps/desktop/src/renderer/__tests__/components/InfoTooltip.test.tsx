import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../helpers/render-helpers'
import InfoTooltip from '../../components/InfoTooltip'

describe('InfoTooltip', () => {
  it('renders question mark trigger', () => {
    renderWithProviders(<InfoTooltip text="Helpful information" />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('shows tooltip on hover', () => {
    renderWithProviders(<InfoTooltip text="This is the tooltip content" />)

    const trigger = screen.getByText('?')
    expect(screen.queryByText('This is the tooltip content')).not.toBeInTheDocument()

    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('This is the tooltip content')).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', () => {
    renderWithProviders(<InfoTooltip text="Tooltip text" />)

    const trigger = screen.getByText('?')

    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Tooltip text')).toBeInTheDocument()

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument()
  })

  it('toggles tooltip on click', () => {
    renderWithProviders(<InfoTooltip text="Click to toggle" />)

    const trigger = screen.getByText('?')

    fireEvent.click(trigger)
    expect(screen.getByText('Click to toggle')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByText('Click to toggle')).not.toBeInTheDocument()
  })
})
