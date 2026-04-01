'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { 
    getUserNotifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    UserNotification
} from '@/app/actions/notificationActions';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const unreadCount = notifications.filter(n => !n.is_read).length;

    useEffect(() => {
        const fetchNotifications = async () => {
            setIsLoading(true);
            const { success, data } = await getUserNotifications();
            if (success && data) {
                setNotifications(data);
            }
            setIsLoading(false);
        };
        fetchNotifications();
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleMarkAsRead = async (id: string, isRead: boolean) => {
        if (!isRead) {
            // Optimistic update
            setNotifications(prev => 
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
            await markNotificationAsRead(id);
        }
    };

    const handleNotificationClick = (notification: UserNotification) => {
        handleMarkAsRead(notification.id, notification.is_read);
        setIsOpen(false);
        if (notification.reference_id) {
            router.push(`/mis-inmuebles/${notification.reference_id}`);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;

        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        await markAllNotificationsAsRead();
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins} min`;
        if (diffHours < 24) return `${diffHours} hs`;
        return `${diffDays} d`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:ring-offset-2 rounded-full"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-800">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button 
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-[#1A56DB] hover:text-blue-800 font-medium flex items-center transition-colors"
                            >
                                <Check className="w-3 h-3 mr-1" /> Marcar todas
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                        {isLoading ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                Cargando...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">
                                No tienes notificaciones.
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {notifications.map(notification => (
                                    <li 
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 cursor-pointer transition-colors ${!notification.is_read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex gap-3">
                                            {!notification.is_read && (
                                                <div className="mt-1.5 w-2 h-2 rounded-full bg-[#1A56DB] flex-shrink-0"></div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className={`text-xs mt-0.5 line-clamp-2 ${!notification.is_read ? 'text-gray-700' : 'text-gray-500'}`}>
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400 font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTimeAgo(notification.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    <div className="px-4 py-3 border-t border-gray-50 bg-gray-50 rounded-b-xl text-center">
                        <p className="text-xs text-gray-500">Mostrando las últimas 20 notificaciones</p>
                    </div>
                </div>
            )}
        </div>
    );
}
