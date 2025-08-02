import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Circle as CircleIcon,
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../../context/NotificationContext';
import { Notification } from '../../../types/notification';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

const NotificationBell: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead,
    isWebSocketConnected 
  } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const router = useRouter();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <InfoIcon color="info" />;
      case 'success':
        return <SuccessIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
    }
  };

  const getCategoryLabel = (category: Notification['category']) => {
    switch (category) {
      case 'staff':
        return 'Personal';
      case 'order':
        return 'Bestellung';
      case 'system':
        return 'System';
      case 'inventory':
        return 'Lager';
      case 'general':
        return 'Allgemein';
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  // Show only recent notifications in the popover
  const recentNotifications = notifications.slice(0, 10);

  return (
    <>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <IconButton
          aria-label="Benachrichtigungen"
          aria-describedby={id}
          onClick={handleClick}
          color="inherit"
        >
          <Badge 
            badgeContent={unreadCount > 99 ? '99+' : unreadCount} 
            color="error"
            overlap="rectangular"
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
        
        {/* WebSocket connection indicator */}
        <Tooltip 
          title={isWebSocketConnected ? 'Live-Updates aktiv' : 'Live-Updates nicht verfügbar'}
          placement="bottom"
        >
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: isWebSocketConnected ? 'success.main' : 'error.main',
              border: '2px solid',
              borderColor: 'background.paper',
            }}
          />
        </Tooltip>
      </Box>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 400, maxHeight: 600 }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">Benachrichtigungen</Typography>
              {isWebSocketConnected ? (
                <Tooltip title="Live-Updates aktiv">
                  <WifiIcon sx={{ fontSize: 16, color: 'success.main' }} />
                </Tooltip>
              ) : (
                <Tooltip title="Live-Updates nicht verfügbar">
                  <WifiOffIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </Tooltip>
              )}
            </Stack>
            {unreadCount > 0 && (
              <Button 
                size="small" 
                onClick={markAllAsRead}
                disabled={loading}
              >
                Alle als gelesen markieren
              </Button>
            )}
          </Stack>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : recentNotifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Keine Benachrichtigungen
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {recentNotifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>
                    <Stack alignItems="center" spacing={0.5}>
                      {getIcon(notification.type)}
                      {!notification.read && (
                        <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                      )}
                    </Stack>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" component="span">
                          {notification.title}
                        </Typography>
                        <Chip
                          label={getCategoryLabel(notification.category)}
                          size="small"
                          variant="outlined"
                        />
                        {notification.priority !== 'low' && (
                          <Chip
                            label={notification.priority}
                            size="small"
                            color={getPriorityColor(notification.priority)}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                          sx={{ display: 'block' }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                {index < recentNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
          <Button 
            fullWidth 
            onClick={() => {
              handleClose();
              router.push('/admin/notifications');
            }}
          >
            Alle Benachrichtigungen anzeigen
          </Button>
        </Box>
      </Popover>
    </>
  );
}

export default NotificationBell;