import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers'
import Sidebar from '../../components/Sidebar'

describe('Sidebar', () => {
  let mockApi: ReturnType<typeof setupWindowApi>
  const mockNavigate = jest.fn()
  const mockOpenNewWindow = jest.fn()
  const mockLock = jest.fn()

  beforeEach(() => {
    mockApi = setupWindowApi()
    mockApi.users.getAll.mockResolvedValue([
      {
        id: '1',
        name: 'Default User',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date('2025-01-01'),
      },
    ])
    localStorage.clear()
  })

  afterEach(() => {
    cleanupWindowApi()
    jest.restoreAllMocks()
  })

  it('renders navigation items', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Recurring')).toBeInTheDocument()
    expect(screen.getByText('Budgets')).toBeInTheDocument()
    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
    expect(screen.getByText('Investments')).toBeInTheDocument()
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0)
  })

  it('highlights active view', () => {
    renderWithProviders(
      <Sidebar
        activeView="transactions"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    const transactionsButton = screen.getByText('Transactions').closest('button')
    expect(transactionsButton).toHaveClass('sidebar-item--active')
  })

  it('navigates on item click', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    fireEvent.click(screen.getByText('Transactions'))
    expect(mockNavigate).toHaveBeenCalledWith('transactions')
  })

  it('opens new window on shift+click', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    const transactionsButton = screen.getByText('Transactions').closest('button')
    fireEvent.click(transactionsButton!, { shiftKey: true })
    expect(mockOpenNewWindow).toHaveBeenCalledWith('transactions')
  })

  it('calls lock handler when lock button clicked', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    fireEvent.click(screen.getByText('Lock'))
    expect(mockLock).toHaveBeenCalled()
  })

  it('toggles sidebar collapse state', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    const sidebar = document.querySelector('.sidebar')
    expect(sidebar).not.toHaveClass('sidebar-collapsed')

    const collapseButton = screen.getByTitle('Collapse sidebar')
    fireEvent.click(collapseButton)

    expect(document.querySelector('.sidebar')).toHaveClass('sidebar-collapsed')
  })

  it('persists collapse state to localStorage', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    const collapseButton = screen.getByTitle('Collapse sidebar')
    fireEvent.click(collapseButton)

    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
  })

  it('renders logo text when expanded', () => {
    renderWithProviders(
      <Sidebar
        activeView="dashboard"
        onNavigate={mockNavigate}
        onOpenNewWindow={mockOpenNewWindow}
        onLock={mockLock}
      />
    )

    expect(screen.getByText('Ledgr')).toBeInTheDocument()
  })
})
