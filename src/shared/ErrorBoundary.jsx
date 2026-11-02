import { Component } from 'react'
import TurnPlaceholder from './TurnPlaceholder'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
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
