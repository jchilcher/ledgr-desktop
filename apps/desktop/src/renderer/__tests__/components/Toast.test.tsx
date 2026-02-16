import React from 'react'
import { screen, waitFor, act } from '@testing-library/react'
import { renderWithProviders } from '../helpers/render-helpers'
import Toast, { ToastContainer, useToast } from '../../components/Toast'
import userEvent from '@testing-library/user-event'

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('renders toast with message', () => {
    const toast = {
      id: '1',
      type: 'success' as const,
      message: 'Operation successful',
    }

    renderWithProviders(<Toast toast={toast} onClose={jest.fn()} />)

    expect(screen.getByText('Operation successful')).toBeInTheDocument()
  })

  it('renders success toast with correct icon', () => {
    const toast = {
      id: '1',
      type: 'success' as const,
      message: 'Success',
    }

    const { container } = renderWithProviders(<Toast toast={toast} onClose={jest.fn()} />)

    expect(container.querySelector('.toast--success')).toBeInTheDocument()
  })

  it('renders error toast with correct styling', () => {
    const toast = {
      id: '1',
      type: 'error' as const,
      message: 'Error occurred',
    }

    const { container } = renderWithProviders(<Toast toast={toast} onClose={jest.fn()} />)

    expect(container.querySelector('.toast--error')).toBeInTheDocument()
  })

  it('auto-dismisses after timeout', () => {
    const onClose = jest.fn()
    const toast = {
      id: '1',
      type: 'info' as const,
      message: 'Info message',
    }

    renderWithProviders(<Toast toast={toast} onClose={onClose} />)

    act(() => {
      jest.advanceTimersByTime(4000)
    })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(onClose).toHaveBeenCalledWith('1')
  })

  it('closes when close button clicked', async () => {
    jest.useRealTimers()
    const onClose = jest.fn()
    const toast = {
      id: '1',
      type: 'warning' as const,
      message: 'Warning',
    }

    renderWithProviders(<Toast toast={toast} onClose={onClose} />)

    const closeButton = screen.getByLabelText('Close')
    await userEvent.click(closeButton)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('1')
    })
  })
})

describe('ToastContainer', () => {
  it('renders multiple toasts', () => {
    const toasts = [
      { id: '1', type: 'success' as const, message: 'Success 1' },
      { id: '2', type: 'error' as const, message: 'Error 1' },
    ]

    renderWithProviders(<ToastContainer toasts={toasts} onClose={jest.fn()} />)

    expect(screen.getByText('Success 1')).toBeInTheDocument()
    expect(screen.getByText('Error 1')).toBeInTheDocument()
  })

  it('renders nothing when no toasts', () => {
    const { container } = renderWithProviders(<ToastContainer toasts={[]} onClose={jest.fn()} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('useToast', () => {
  beforeEach(() => {
    jest.useRealTimers()
  })

  function TestComponent() {
    const toast = useToast()

    return (
      <div>
        <button onClick={() => toast.success('Success message')}>Success</button>
        <button onClick={() => toast.error('Error message')}>Error</button>
        <button onClick={() => toast.info('Info message')}>Info</button>
        <button onClick={() => toast.warning('Warning message')}>Warning</button>
        <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      </div>
    )
  }

  it('adds success toast', async () => {
    renderWithProviders(<TestComponent />)

    await userEvent.click(screen.getByText('Success'))

    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('adds error toast', async () => {
    renderWithProviders(<TestComponent />)

    await userEvent.click(screen.getByText('Error'))

    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('adds info toast', async () => {
    renderWithProviders(<TestComponent />)

    await userEvent.click(screen.getByText('Info'))

    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('adds warning toast', async () => {
    renderWithProviders(<TestComponent />)

    await userEvent.click(screen.getByText('Warning'))

    expect(screen.getByText('Warning message')).toBeInTheDocument()
  })
})
