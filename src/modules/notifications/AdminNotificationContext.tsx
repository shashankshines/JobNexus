'use client';

import React, { createContext, useContext } from 'react';
import { useAdminNotifications } from '@/app/hooks/useAdminNotifications';
import { AdminNotificationToastContainer } from '@/app/components/admin/AdminNotificationToast';
import { AdminNotificationInboxModal } from '@/app/components/admin/AdminNotificationInboxModal';

type AdminNotificationContextType = ReturnType<typeof useAdminNotifications>;

const AdminNotificationContext = createContext<AdminNotificationContextType | null>(null);

export function AdminNotificationProvider({ children }: { children: React.ReactNode }) {
  const notificationState = useAdminNotifications();

  return (
    <AdminNotificationContext.Provider value={notificationState}>
      {children}
      {/* Viewport-fixed Toasts */}
      <AdminNotificationToastContainer
        toasts={notificationState.activeToasts}
        onDismiss={notificationState.dismissToast}
        onAction={notificationState.executeAction}
        onOpenInbox={() => notificationState.setIsInboxOpen(true)}
      />
      {/* Full Notification Center Modal */}
      <AdminNotificationInboxModal
        isOpen={notificationState.isInboxOpen}
        onClose={() => notificationState.setIsInboxOpen(false)}
        items={notificationState.items}
        unreadCount={notificationState.unreadCount}
        loading={notificationState.loading}
        preferences={notificationState.preferences}
        onUpdatePreferences={notificationState.updatePreferences}
        onMarkAsRead={notificationState.markAsRead}
        onAcknowledge={notificationState.acknowledge}
        onResolve={notificationState.resolve}
        onMarkAllAsRead={notificationState.markAllAsRead}
        onAction={notificationState.executeAction}
        onTestVoice={notificationState.testVoice}
        onTestSound={notificationState.testSound}
        onRefresh={notificationState.refresh}
      />
    </AdminNotificationContext.Provider>
  );
}

export function useAdminNotificationContext(): AdminNotificationContextType {
  const context = useContext(AdminNotificationContext);
  if (!context) {
    throw new Error('useAdminNotificationContext must be used within an AdminNotificationProvider');
  }
  return context;
}
