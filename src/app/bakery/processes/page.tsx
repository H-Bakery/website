'use client'
import React, { useState, useEffect } from 'react'
import { Box, Container, Typography, Grid, Button, Fab } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { getWorkflows } from '../../../services/workflowService'
import WorkflowSidebar from '../../../components/bakery/WorkflowSidebar'
import WorkflowDetail from '../../../components/bakery/WorkflowDetail'
import WorkflowCreationForm from '../../../components/bakery/WorkflowCreationForm'
import { Workflow } from '../../../types/workflow'
import BakeryLayout from '../../../layouts/BakeryLayout'

export default function BakeryProcessesPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null
  )
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')
  const [activeTab, setActiveTab] = useState(0)
  const [creationDialogOpen, setCreationDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch workflow data
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true)
        const result = await getWorkflows()
        setWorkflows(result)
        if (result.length > 0) {
          setSelectedWorkflow(result[0])
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkflows()
  }, [])

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const handleWorkflowSelect = (workflow: Workflow) => {
    setSelectedWorkflow(workflow)
  }

  const handleViewModeChange = (mode: 'table' | 'timeline') => {
    setViewMode(mode)
  }

  const handleCreateWorkflow = (workflowData: any) => {
    // In a real app, you would send this to your API
    // For this demo, we'll add it directly to state
    const newWorkflow = {
      ...workflowData,
      id: `wf-${Date.now()}`, // generate a unique ID
    }

    setWorkflows([...workflows, newWorkflow])
    setSelectedWorkflow(newWorkflow)
    setActiveTab(newWorkflow.status === 'planned' ? 1 : 0)
    setCreationDialogOpen(false)
  }

  return (
    <BakeryLayout>
      <Container maxWidth="xl" sx={{ py: 4, pt: 2 }}>
        <Box
          sx={{
            mb: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Bäckerei-Prozessmanagement
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Verfolgen und verwalten Sie Ihre Produktionsprozesse in Echtzeit
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreationDialogOpen(true)}
          >
            Neuer Prozess
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Sidebar with workflow list */}
          <Grid item xs={12} md={4} lg={3}>
            <WorkflowSidebar
              workflows={workflows}
              selectedWorkflow={selectedWorkflow}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onSelectWorkflow={handleWorkflowSelect}
            />
          </Grid>

          {/* Main content area */}
          <Grid item xs={12} md={8} lg={9}>
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography>Lade Prozesse...</Typography>
              </Box>
            ) : selectedWorkflow ? (
              <WorkflowDetail
                workflow={selectedWorkflow}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onUpdateWorkflow={(updatedWorkflow) => {
                  setWorkflows(
                    workflows.map((wf) =>
                      wf.id === updatedWorkflow.id ? updatedWorkflow : wf
                    )
                  )
                  setSelectedWorkflow(updatedWorkflow)
                }}
              />
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Typography variant="h6">Keine Prozesse ausgewählt</Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setCreationDialogOpen(true)}
                >
                  Neuen Prozess erstellen
                </Button>
              </Box>
            )}
          </Grid>
        </Grid>

        {/* Workflow Creation Dialog */}
        <WorkflowCreationForm
          open={creationDialogOpen}
          onClose={() => setCreationDialogOpen(false)}
          onSubmit={handleCreateWorkflow}
        />

        {/* Fixed action button for mobile */}
        <Box sx={{ display: { sm: 'none' } }}>
          <Fab
            color="primary"
            aria-label="add"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={() => setCreationDialogOpen(true)}
          >
            <AddIcon />
          </Fab>
        </Box>
      </Container>
    </BakeryLayout>
  )
}
