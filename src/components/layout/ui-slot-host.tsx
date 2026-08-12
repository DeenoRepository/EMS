"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { getSlotComponents, RegisteredSlotComponent } from "@/lib/plugins/ui-slots";
import { useShell } from "@/components/layout/shell-context";
import { AlertCircle, RefreshCw } from "lucide-react";

interface SlotErrorBoundaryProps {
  slotTitle: string;
  children: ReactNode;
}

interface SlotErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SlotErrorBoundary extends Component<SlotErrorBoundaryProps, SlotErrorBoundaryState> {
  constructor(props: SlotErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SlotErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[UiSlotHost Error] Slot "${this.props.slotTitle}" failed:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>Сбой виджета {this.props.slotTitle}</span>
          </div>
          <button
            onClick={this.handleRetry}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
            title="Повторить загрузку"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface UiSlotHostProps {
  slotId: string;
  className?: string;
}

export function UiSlotHost({ slotId, className = "" }: UiSlotHostProps) {
  const { currentUser } = useShell();
  const slots: RegisteredSlotComponent[] = getSlotComponents(slotId, currentUser);

  if (!slots || slots.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {slots.map((slot) => (
        <SlotErrorBoundary key={slot.id} slotTitle={slot.title}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {slot.title}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {/* Рендеринг активного слота */}
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Модуль: {slot.moduleId.toUpperCase()}
              </span>
            </div>
          </div>
        </SlotErrorBoundary>
      ))}
    </div>
  );
}
