'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export interface UserNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    reference_id?: string;
}

/**
 * Fetch up to 20 recent notifications for the authenticated user.
 */
export async function getUserNotifications(): Promise<{ success: boolean; data?: UserNotification[]; error?: string }> {
    try {
        const supabase = createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Unauthorized' };
        }

        const adminBase = getServiceRoleClient();
        const { data, error } = await adminBase
            .from('user_notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[NotificationActions] Fetch error:', error);
            return { success: false, error: 'Error fetching notifications' };
        }

        return { success: true, data: data as UserNotification[] };
    } catch (e: any) {
        console.error('[NotificationActions] Exception:', e);
        return { success: false, error: e.message || 'Unknown error' };
    }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Unauthorized' };
        }

        const adminBase = getServiceRoleClient();
        const { error } = await adminBase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', user.id); // Security: Ensure it belongs to the user

        if (error) {
            console.error('[NotificationActions] Mark as read error:', error);
            return { success: false, error: 'Error marking notification as read' };
        }

        return { success: true };
    } catch (e: any) {
        console.error('[NotificationActions] Exception:', e);
        return { success: false, error: e.message || 'Unknown error' };
    }
}

/**
 * Mark all unread notifications for the user as read.
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Unauthorized' };
        }

        const adminBase = getServiceRoleClient();
        const { error } = await adminBase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('[NotificationActions] Mark all as read error:', error);
            return { success: false, error: 'Error marking all notifications as read' };
        }

        return { success: true };
    } catch (e: any) {
        console.error('[NotificationActions] Exception:', e);
        return { success: false, error: e.message || 'Unknown error' };
    }
}
