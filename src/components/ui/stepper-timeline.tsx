"use client";

import * as React from "react";
import { CheckCircle2, Clock, AlertCircle, XCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "completed" | "in-progress" | "pending" | "failed";

export interface TimelineStepItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
  actor?: string;
  status: StepStatus;
  details?: string;
  metadata?: Record<string, string>;
}

export interface StepperTimelineProps {
  steps: TimelineStepItem[];
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export function StepperTimeline({
  steps,
  orientation = "vertical",
  className,
}: StepperTimelineProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
      case "in-progress":
        return <Clock size={16} className="text-[#3473d4] animate-spin shrink-0" />;
      case "failed":
        return <XCircle size={16} className="text-rose-500 shrink-0" />;
      case "pending":
      default:
        return <AlertCircle size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />;
    }
  };

  const getStatusBadge = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
      case "in-progress":
        return "bg-blue-50 text-[#3473d4] border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 font-bold";
      case "failed":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
      case "pending":
      default:
        return "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
    }
  };

  return (
    <div
      className={cn(
        orientation === "horizontal"
          ? "flex items-start gap-4 overflow-x-auto pb-4"
          : "relative space-y-4 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800",
        className
      )}
    >
      {steps.map((step) => {
        const isExpanded = expandedId === step.id;

        return (
          <div
            key={step.id}
            className={cn(
              orientation === "horizontal"
                ? "flex-1 min-w-[200px] border-t-2 pt-3"
                : "relative flex gap-3.5 items-start"
            )}
            style={
              orientation === "horizontal"
                ? {
                    borderColor:
                      step.status === "completed"
                        ? "#10b981"
                        : step.status === "in-progress"
                        ? "#3473d4"
                        : "#e2e8f0",
                  }
                : undefined
            }
          >
            {/* Circle Marker */}
            {orientation === "vertical" && (
              <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-900 shadow-xs shrink-0">
                {getStatusIcon(step.status)}
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-[0_2px_8px_rgba(15,23,42,.025)] transition hover:shadow-md">
              <div
                className="flex items-center justify-between gap-2 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : step.id)}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-[#17243a] dark:text-slate-100">
                      {step.title}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[9px] font-semibold border uppercase tracking-wider",
                        getStatusBadge(step.status)
                      )}
                    >
                      {step.status}
                    </span>
                  </div>
                  {step.subtitle && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {step.subtitle}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {step.timestamp && (
                    <span className="text-[10px] font-mono text-slate-400">{step.timestamp}</span>
                  )}
                  {step.details && (
                    <ChevronDown
                      size={14}
                      className={cn(
                        "text-slate-400 transition-transform duration-200",
                        isExpanded && "transform rotate-180"
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Expandable Details Drawer */}
              {isExpanded && (step.details || step.metadata) && (
                <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-2 animate-in fade-in duration-150">
                  {step.details && <p className="leading-relaxed">{step.details}</p>}

                  {step.actor && (
                    <div className="text-[10px] font-mono text-slate-400">
                      Ответственный: <span className="font-semibold text-[#17243a] dark:text-slate-200">{step.actor}</span>
                    </div>
                  )}

                  {step.metadata && (
                    <div className="grid grid-cols-2 gap-2 bg-[#f8fafc] dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 text-[10px] font-mono">
                      {Object.entries(step.metadata).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-slate-400">{k}:</span>{" "}
                          <span className="font-semibold text-[#17243a] dark:text-slate-200">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
