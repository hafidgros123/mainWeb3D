import { Component, type ReactNode } from 'react'
import TurnPlaceholder from './TurnPlaceholder'

interface ErrorBoundaryProps {
  children?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="error-panel" role="alert">
          <TurnPlaceholder
            title="This part is unavailable"
            message="error while loading this part  , please contact me so i can check it out "
            detail="The rest of the app is still available. Return to the main menu and try again."
          />
        </section>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
