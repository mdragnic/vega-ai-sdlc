import { Component, type ReactNode } from 'react';

type WidgetErrorBoundaryProps = {
  /** The widget's data: new data renders the content again. */
  resetKey: unknown;
  /** The widget's error state. */
  fallback: ReactNode;
  children: ReactNode;
};

type WidgetErrorBoundaryState = { failed: boolean; resetKey: unknown };

/**
 * Catches an error while one widget renders its data, such as a formatter throwing on malformed money, so
 * only that widget shows its error state and the rest of the page keeps working (#6). React logs the error.
 */
export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  override state: WidgetErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<WidgetErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: WidgetErrorBoundaryProps,
    state: WidgetErrorBoundaryState,
  ): WidgetErrorBoundaryState | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
