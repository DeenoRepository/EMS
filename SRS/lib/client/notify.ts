"use client";

export type NotifyTone = "success" | "error" | "info";

export type NotifyPayload = {
  title: string;
  description?: string;
  tone?: NotifyTone;
};

export const APP_TOAST_EVENT = "deps:toast";

export function notify(payload: NotifyPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NotifyPayload>(APP_TOAST_EVENT, { detail: payload }));
}

export function notifySuccess(title: string, description?: string) {
  notify({ title, description, tone: "success" });
}

export function notifyError(title: string, description?: string) {
  notify({ title, description, tone: "error" });
}

export function notifyInfo(title: string, description?: string) {
  notify({ title, description, tone: "info" });
}
