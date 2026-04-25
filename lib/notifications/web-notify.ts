"use client";

let permissionRequested = false;

type NotificationPayload = {
  body?: string;
  data?: Record<string, unknown>;
  tag?: string;
  title: string;
};

function supportsWebNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermissionOnce(): Promise<NotificationPermission> {
  if (!supportsWebNotifications()) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    permissionRequested = true;
    return "granted";
  }

  if (Notification.permission === "denied") {
    permissionRequested = true;
    return "denied";
  }

  if (permissionRequested) {
    return Notification.permission;
  }

  permissionRequested = true;
  return Notification.requestPermission();
}

export async function fireWebNotification(
  payload: NotificationPayload,
): Promise<Notification | null> {
  const permission = await requestNotificationPermissionOnce();
  if (permission !== "granted" || !supportsWebNotifications()) {
    return null;
  }

  return new Notification(payload.title, {
    body: payload.body,
    data: payload.data,
    tag: payload.tag,
  });
}
