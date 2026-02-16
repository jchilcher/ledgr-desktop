import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers'
import LockScreen from '../../components/LockScreen'

describe('LockScreen', () => {
  let mockApi: ReturnType<typeof setupWindowApi>
  const mockUnlock = jest.fn()
  const mockMemberUnlock = jest.fn()

  beforeEach(() => {
    mockApi = setupWindowApi()
  })

  afterEach(() => {
    cleanupWindowApi()
    jest.restoreAllMocks()
  })

  it('renders lock screen with password input', () => {
    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'Test User',
            color: '#3498db',
            hasPassword: true,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    expect(screen.getByText('Ledgr')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
  })

  it('displays error on incorrect password', async () => {
    mockApi.security.unlockMember.mockResolvedValue(null)

    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'Test User',
            color: '#3498db',
            hasPassword: true,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    const input = screen.getByPlaceholderText('Enter password')
    const unlockButton = screen.getByText('Unlock')

    fireEvent.change(input, { target: { value: 'wrongpassword' } })
    fireEvent.click(unlockButton)

    await waitFor(() => {
      expect(screen.getByText('Incorrect password')).toBeInTheDocument()
    })

    expect(mockUnlock).not.toHaveBeenCalled()
  })

  it('calls unlock handler on correct password', async () => {
    mockApi.security.unlockMember.mockResolvedValue('1')

    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'Test User',
            color: '#3498db',
            hasPassword: true,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    const input = screen.getByPlaceholderText('Enter password')
    const unlockButton = screen.getByText('Unlock')

    fireEvent.change(input, { target: { value: 'correctpassword' } })
    fireEvent.click(unlockButton)

    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalled()
    })

    expect(mockMemberUnlock).toHaveBeenCalledWith('1')
  })

  it('shows member picker with multiple members', () => {
    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'User One',
            color: '#3498db',
            hasPassword: true,
          },
          {
            userId: '2',
            name: 'User Two',
            color: '#e74c3c',
            hasPassword: false,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    expect(screen.getByText('Who is using Ledgr?')).toBeInTheDocument()
    expect(screen.getByText('User One')).toBeInTheDocument()
    expect(screen.getByText('User Two')).toBeInTheDocument()
  })

  it('auto-unlocks member without password', async () => {
    mockApi.security.unlockMember.mockResolvedValue('2')

    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'User One',
            color: '#3498db',
            hasPassword: true,
          },
          {
            userId: '2',
            name: 'User Two',
            color: '#e74c3c',
            hasPassword: false,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    fireEvent.click(screen.getByText('User Two'))

    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalled()
    })

    expect(mockMemberUnlock).toHaveBeenCalledWith('2')
  })

  it('shows passwordless unlock button for member without password', async () => {
    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'Test User',
            color: '#3498db',
            hasPassword: false,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    expect(screen.queryByPlaceholderText('Enter password')).not.toBeInTheDocument()
    expect(screen.getByText('Unlock')).toBeInTheDocument()
  })

  it('handles enter key to submit password', async () => {
    mockApi.security.unlockMember.mockResolvedValue('1')

    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'Test User',
            color: '#3498db',
            hasPassword: true,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    const input = screen.getByPlaceholderText('Enter password')
    fireEvent.change(input, { target: { value: 'password' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalled()
    })
  })

  it('allows going back to member picker', async () => {
    renderWithProviders(
      <LockScreen
        isStartup={false}
        onUnlock={mockUnlock}
        members={[
          {
            userId: '1',
            name: 'User One',
            color: '#3498db',
            hasPassword: true,
          },
          {
            userId: '2',
            name: 'User Two',
            color: '#e74c3c',
            hasPassword: true,
          },
        ]}
        onMemberUnlock={mockMemberUnlock}
      />
    )

    fireEvent.click(screen.getByText('User One'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Back'))

    await waitFor(() => {
      expect(screen.getByText('Who is using Ledgr?')).toBeInTheDocument()
    })
  })
})
