'use client'
import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  Badge,
  Tooltip,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material'
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  addWeeks,
  subWeeks,
  parseISO,
} from 'date-fns'
import { de } from 'date-fns/locale'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import AddIcon from '@mui/icons-material/Add'
import { Order } from '../../../services/types'
import OrderDetailDialog from './OrderDetailDialog'

interface WeeklyCalendarProps {
  orders: Order[]
  onDateSelect: (date: Date) => void
  onOrderClick: (order: Order) => void
  onAddOrder: (date: Date) => void
  onDeleteOrder?: (orderId: string | number) => void
}

/**
 * Weekly calendar component that displays orders by day
 */
const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  orders,
  onDateSelect,
  onOrderClick,
  onAddOrder,
  onDeleteOrder,
}) => {
  const theme = useTheme()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Calculate the dates for the current week
  const weekDays = useMemo(() => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }) // Start on Monday
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 })
    const days = []
    let day = startDate

    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }

    return days
  }, [currentDate])

  // Navigate to next/previous week
  const handlePreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1))
  }

  const handleNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1))
  }

  // Handle date selection
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    onDateSelect(date)
  }

  // Group orders by date
  const ordersByDate = useMemo(() => {
    const grouped: Record<string, Order[]> = {}

    orders.forEach((order) => {
      if (order.pickupDate) {
        const dateKey = format(new Date(order.pickupDate), 'yyyy-MM-dd')
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(order)
      }
    })

    return grouped
  }, [orders])

  // Check if a date is today
  const isToday = (date: Date) => isSameDay(date, new Date())

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Wochenübersicht: {format(weekDays[0], 'dd.MM.', { locale: de })} -{' '}
            {format(weekDays[6], 'dd.MM.yyyy', { locale: de })}
          </Typography>
          <Box>
            <IconButton onClick={handlePreviousWeek}>
              <NavigateBeforeIcon />
            </IconButton>
            <IconButton onClick={handleNextWeek}>
              <NavigateNextIcon />
            </IconButton>
          </Box>
        </Box>

        <Divider />

        <Grid container spacing={1} sx={{ pt: 1 }}>
          {weekDays.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd')
            const dayOrders = ordersByDate[dateKey] || []
            const isSelected = selectedDate && isSameDay(date, selectedDate)
            const today = isToday(date)
            const dayName = format(date, 'EEEEEE', { locale: de }) // Short day name
            const dayNumber = format(date, 'd') // Day number

            return (
              <Grid item xs={12} sm={6} md={3} lg={12 / 7} key={dateKey}>
                <Paper
                  sx={{
                    p: 1.5,
                    height: '100%',
                    cursor: 'pointer',
                    borderRadius: 2,
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, 0.1)
                      : today
                      ? alpha(theme.palette.primary.main, 0.05)
                      : 'background.paper',
                    border: isSelected
                      ? `1px solid ${theme.palette.primary.main}`
                      : today
                      ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                      : '1px solid transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                    position: 'relative',
                  }}
                  elevation={0}
                  onClick={() => handleDateClick(date)}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="caption"
                        display="block"
                        color="text.secondary"
                        fontWeight={500}
                      >
                        {dayName.toUpperCase()}
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight={today ? 700 : 500}
                        color={today ? 'primary.main' : 'text.primary'}
                      >
                        {dayNumber}
                      </Typography>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddOrder(date)
                      }}
                      sx={{
                        bgcolor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        '&:hover': {
                          bgcolor: theme.palette.primary.dark,
                        },
                        width: 24,
                        height: 24,
                      }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>

                  <Box
                    sx={{
                      maxHeight: 160,
                      overflowY: 'auto',
                      pr: 0.5,
                    }}
                  >
                    {dayOrders.length > 0 ? (
                      dayOrders.map((order) => (
                        <Tooltip
                          key={order.id}
                          title={`${order.customerName}: ${
                            order.items?.length || 0
                          } Artikel`}
                        >
                          <Paper
                            elevation={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedOrder(order)
                              setDialogOpen(true)
                            }}
                            sx={{
                              p: 1,
                              mb: 1,
                              borderRadius: 1,
                              cursor: 'pointer',
                              bgcolor:
                                order.status === 'Completed'
                                  ? alpha(theme.palette.success.main, 0.1)
                                  : order.status === 'Confirmed'
                                  ? alpha(theme.palette.info.main, 0.1)
                                  : order.status === 'Cancelled'
                                  ? alpha(theme.palette.error.main, 0.1)
                                  : alpha(theme.palette.warning.main, 0.1),
                              border: `1px solid ${
                                order.status === 'Completed'
                                  ? alpha(theme.palette.success.main, 0.2)
                                  : order.status === 'Confirmed'
                                  ? alpha(theme.palette.info.main, 0.2)
                                  : order.status === 'Cancelled'
                                  ? alpha(theme.palette.error.main, 0.2)
                                  : alpha(theme.palette.warning.main, 0.2)
                              }`,
                              '&:hover': {
                                bgcolor:
                                  order.status === 'Completed'
                                    ? alpha(theme.palette.success.main, 0.2)
                                    : order.status === 'Confirmed'
                                    ? alpha(theme.palette.info.main, 0.2)
                                    : order.status === 'Cancelled'
                                    ? alpha(theme.palette.error.main, 0.2)
                                    : alpha(theme.palette.warning.main, 0.2),
                              },
                            }}
                          >
                            <Typography variant="body2" noWrap>
                              {order.customerName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              noWrap
                            >
                              {format(
                                parseISO(order.pickupDate.toString()),
                                'HH:mm'
                              )}{' '}
                              - {order.items?.length || 0} Artikel
                            </Typography>
                          </Paper>
                        </Tooltip>
                      ))
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 1 }}
                      >
                        Keine Bestellungen
                      </Typography>
                    )}
                  </Box>

                  {dayOrders.length > 0 && (
                    <Badge
                      badgeContent={dayOrders.length}
                      color="primary"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                      }}
                    />
                  )}
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      </Paper>

      {/* Order detail dialog */}
      <OrderDetailDialog
        order={selectedOrder}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onEdit={onOrderClick}
        onDelete={(orderId) => {
          setDialogOpen(false)
          if (onDeleteOrder && selectedOrder) {
            onDeleteOrder(orderId)
          }
        }}
      />
    </Box>
  )
}

export default WeeklyCalendar
