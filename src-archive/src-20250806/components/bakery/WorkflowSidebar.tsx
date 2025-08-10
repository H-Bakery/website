import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Divider,
  Button,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material'
import {
  PlayArrow,
  Schedule,
  TimerOutlined,
  Add as AddIcon,
} from '@mui/icons-material'
import { Workflow } from '../../types/workflow'
import {
  calculateProgress,
  getTimeRemaining,
  getStatusColor,
} from '../../utils/workflowUtils'

interface WorkflowSidebarProps {
  workflows: Workflow[]
  selectedWorkflow: Workflow | null
  activeTab: number
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void
  onSelectWorkflow: (workflow: Workflow) => void
}

const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  workflows,
  selectedWorkflow,
  activeTab,
  onTabChange,
  onSelectWorkflow,
}) => {
  const theme = useTheme()

  // Calculate production statistics
  const activeCount = workflows.filter(
    (wf) => wf.status === 'in-progress'
  ).length
  const plannedCount = workflows.filter((wf) => wf.status === 'planned').length

  // Group products for today's production
  const productionToday = workflows.reduce((acc, workflow) => {
    const isToday =
      new Date(workflow.startTime).toDateString() === new Date().toDateString()

    if (isToday) {
      if (!acc[workflow.product]) {
        acc[workflow.product] = workflow.batchSize
      } else {
        acc[workflow.product] += workflow.batchSize
      }
    }
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6">Aktive Prozesse</Typography>
          </Box>

          <Tabs
            value={activeTab}
            onChange={onTabChange}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{ mb: 2 }}
          >
            <Tab icon={<PlayArrow />} label="Aktiv" />
            <Tab icon={<Schedule />} label="Geplant" />
          </Tabs>

          {workflows
            .filter((wf) =>
              activeTab === 0
                ? wf.status === 'in-progress' || wf.status === 'paused'
                : wf.status === 'planned'
            )
            .map((workflow) => (
              <Card
                key={workflow.id}
                variant="outlined"
                sx={{
                  mb: 1,
                  cursor: 'pointer',
                  border:
                    selectedWorkflow?.id === workflow.id
                      ? `2px solid ${theme.palette.primary.main}`
                      : undefined,
                }}
                onClick={() => onSelectWorkflow(workflow)}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" noWrap>
                      {workflow.product}
                    </Typography>
                    <Chip
                      label={workflow.status}
                      size="small"
                      color={getStatusColor(workflow.status) as any}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Menge: {workflow.batchSize}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <TimerOutlined
                        sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }}
                      />
                      {getTimeRemaining(workflow)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={calculateProgress(workflow)}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </CardContent>
              </Card>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Produktionsübersicht
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Aktive Prozesse
            </Typography>
            <Typography variant="h5">{activeCount}</Typography>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Geplante Prozesse
            </Typography>
            <Typography variant="h5">{plannedCount}</Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="body2" color="text.secondary">
              Fertigung heute
            </Typography>
            {Object.entries(productionToday).map(([product, count]) => (
              <Box
                key={product}
                sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}
              >
                <Typography>{product}</Typography>
                <Typography>{count} Stk.</Typography>
              </Box>
            ))}

            {Object.keys(productionToday).length === 0 && (
              <Typography
                variant="body2"
                sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}
              >
                Keine Produktion für heute geplant
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Temperaturen
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography>Kühlraum</Typography>
            <Typography>4°C</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography>Backstube</Typography>
            <Typography>22°C</Typography>
          </Box>
        </CardContent>
      </Card>
    </>
  )
}

export default WorkflowSidebar
