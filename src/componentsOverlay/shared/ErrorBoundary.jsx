import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="error-panel" role="alert">
          <h1>This part is unavailable</h1>
          <p>The rest of the app is still available. Return to the main menu and try again.</p>
        </section>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
