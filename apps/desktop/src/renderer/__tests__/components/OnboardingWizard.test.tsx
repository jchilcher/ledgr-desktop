import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers'
import OnboardingWizard from '../../components/OnboardingWizard'

describe('OnboardingWizard', () => {
  let mockApi: ReturnType<typeof setupWindowApi>
  const mockComplete = jest.fn()

  beforeEach(() => {
    mockApi = setupWindowApi()
    mockApi.accounts.create.mockResolvedValue({
      id: '1',
      name: 'Test Account',
      type: 'checking',
      institution: 'Test Bank',
      balance: 100000,
      lastSynced: null,
      createdAt: new Date(),
      ownership: 'mine',
      ownerId: null,
      isEncrypted: false,
    })
  })

  afterEach(() => {
    cleanupWindowApi()
    jest.restoreAllMocks()
  })

  it('renders welcome step initially', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    expect(screen.getByText('Welcome to Ledgr')).toBeInTheDocument()
    expect(screen.getByText(/Your data stays on your computer/)).toBeInTheDocument()
  })

  it('allows skipping setup from welcome', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Skip setup'))
    expect(mockComplete).toHaveBeenCalled()
  })

  it('advances to account creation step', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Get Started'))

    expect(screen.getByText('Add Your First Account')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Main Checking')).toBeInTheDocument()
  })

  it('creates account and advances to next steps', async () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Get Started'))

    const nameInput = screen.getByPlaceholderText('e.g. Main Checking')
    const institutionInput = screen.getByPlaceholderText('e.g. Chase, Bank of America')
    const balanceInput = screen.getByPlaceholderText('0.00')

    fireEvent.change(nameInput, { target: { value: 'My Checking' } })
    fireEvent.change(institutionInput, { target: { value: 'Test Bank' } })
    fireEvent.change(balanceInput, { target: { value: '1000.00' } })

    fireEvent.click(screen.getByText('Create Account'))

    await waitFor(() => {
      expect(mockApi.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Checking',
          institution: 'Test Bank',
          balance: 100000,
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Account Created!')).toBeInTheDocument()
    })
  })

  it('allows skipping account creation', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Get Started'))
    fireEvent.click(screen.getByText('Skip this step'))

    expect(screen.getByText('Next Steps')).toBeInTheDocument()
  })

  it('allows going back to welcome', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Get Started'))
    fireEvent.click(screen.getByText('Back'))

    expect(screen.getByText('Welcome to Ledgr')).toBeInTheDocument()
  })

  it('completes wizard with navigation to import', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Get Started'))
    fireEvent.click(screen.getByText('Skip this step'))
    fireEvent.click(screen.getByText('Continue'))

    expect(screen.getByText("You're All Set!")).toBeInTheDocument()

    fireEvent.click(screen.getByText('Go to Import'))
    expect(mockComplete).toHaveBeenCalledWith({ navigateTo: 'import' })
  })

  it('completes wizard with navigation to dashboard', () => {
    renderWithProviders(<OnboardingWizard onComplete={mockComplete} />)

    fireEvent.click(screen.getByText('Get Started'))
    fireEvent.click(screen.getByText('Skip this step'))
    fireEvent.click(screen.getByText('Continue'))

    fireEvent.click(screen.getByText('Go to Dashboard'))
    expect(mockComplete).toHaveBeenCalledWith({ navigateTo: 'dashboard' })
  })
})
