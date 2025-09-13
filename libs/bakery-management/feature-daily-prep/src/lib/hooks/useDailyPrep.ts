'use client'
import { useState, useEffect } from 'react'
import { PrepTaskLoader } from '../services'
import { PrepSection, BakingItem, AdditionalProductionItem } from '../types'

interface UseDailyPrepReturn {
  // State
  selectedDate: Date
  tabValue: number
  saveDialogOpen: boolean
  isGenerating: boolean
  isLoading: boolean
  isFromSpecificFile: boolean
  editMode: boolean
  expandedSections: Record<number, boolean>
  prepSections: PrepSection[]
  bakingSchedule: { cakes: BakingItem[]; bread: BakingItem[] }
  additionalProduction: AdditionalProductionItem[]

  // Actions
  setSelectedDate: (date: Date) => void
  setTabValue: (value: number) => void
  setSaveDialogOpen: (open: boolean) => void
  setEditMode: (mode: boolean) => void
  toggleSectionExpanded: (sectionIndex: number) => void

  // Complex actions
  loadPrepTasks: () => Promise<void>
  generatePrepList: () => Promise<void>
  toggleItemCompletion: (sectionIndex: number, itemIndex: number) => void
  toggleSectionCompletion: (sectionIndex: number) => void
  updateItemQuantity: (
    sectionIndex: number,
    itemIndex: number,
    newQuantity: number
  ) => void
  updateBakingQuantity: (
    type: 'cakes' | 'bread',
    itemIndex: number,
    newQuantity: number
  ) => void
  handleAddToProduction: (itemName: string, reason: string) => void

  // Computed values
  calculateProgress: () => number
}

export const useDailyPrep = (): UseDailyPrepReturn => {
  // Basic state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date('2025-06-10'))
  const [tabValue, setTabValue] = useState(0)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isFromSpecificFile, setIsFromSpecificFile] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [expandedSections, setExpandedSections] = useState<
    Record<number, boolean>
  >({})

  // Data state
  const [prepSections, setPrepSections] = useState<PrepSection[]>([])
  const [bakingSchedule, setBakingSchedule] = useState<{
    cakes: BakingItem[]
    bread: BakingItem[]
  }>({ cakes: [], bread: [] })
  const [additionalProduction, setAdditionalProduction] = useState<
    AdditionalProductionItem[]
  >([])

  // Load preparation tasks when date changes
  const loadPrepTasks = async () => {
    setIsLoading(true)
    try {
      // Try to load specific file first, fall back to generated content
      const specificTasks = await PrepTaskLoader.loadSpecificDate(
        selectedDate.toISOString().split('T')[0]
      )

      if (specificTasks) {
        setPrepSections(specificTasks)
        setIsFromSpecificFile(true)
      } else {
        // Generate from config
        const generatedTasks = await PrepTaskLoader.generatePrepTasksForDate(
          selectedDate
        )
        setPrepSections(generatedTasks)
        setIsFromSpecificFile(false)
      }

      // Load baking schedule
      const schedule = await PrepTaskLoader.getBakingScheduleForDate(
        selectedDate
      )
      setBakingSchedule(schedule)
    } catch (error) {
      console.error('Error loading prep tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPrepTasks()
  }, [selectedDate])

  // Helper functions
  const calculateProgress = (): number => {
    if (prepSections.length === 0) return 0
    const completedSections = prepSections.filter(
      (section) => section.completed
    ).length
    return (completedSections / prepSections.length) * 100
  }

  const toggleItemCompletion = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...prepSections]
    if (newSections[sectionIndex].items) {
      newSections[sectionIndex].items![itemIndex].completed =
        !newSections[sectionIndex].items![itemIndex].completed
    }

    // Check if all items in section are completed
    if (newSections[sectionIndex].items) {
      const allCompleted = newSections[sectionIndex].items!.every(
        (item) => item.completed
      )
      newSections[sectionIndex].completed = allCompleted
    }

    setPrepSections(newSections)
  }

  const toggleSectionCompletion = (sectionIndex: number) => {
    const newSections = [...prepSections]
    const newCompleted = !newSections[sectionIndex].completed
    newSections[sectionIndex].completed = newCompleted

    if (newCompleted) {
      newSections[sectionIndex].time_completed = new Date().toLocaleTimeString(
        'de-DE'
      )
    }

    // Mark all items as completed/uncompleted
    if (newSections[sectionIndex].items) {
      newSections[sectionIndex].items!.forEach((item) => {
        item.completed = newCompleted
      })
    }

    setPrepSections(newSections)
  }

  const updateItemQuantity = (
    sectionIndex: number,
    itemIndex: number,
    newQuantity: number
  ) => {
    const newSections = [...prepSections]
    if (newSections[sectionIndex].items) {
      newSections[sectionIndex].items![itemIndex].quantity = newQuantity
    }
    setPrepSections(newSections)
  }

  const updateBakingQuantity = (
    type: 'cakes' | 'bread',
    itemIndex: number,
    newQuantity: number
  ) => {
    const newSchedule = { ...bakingSchedule }
    newSchedule[type][itemIndex].quantity = newQuantity
    setBakingSchedule(newSchedule)
  }

  const toggleSectionExpanded = (sectionIndex: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionIndex]: !prev[sectionIndex],
    }))
  }

  const handleAddToProduction = (itemName: string, reason: string) => {
    const newItem: AdditionalProductionItem = {
      name: itemName,
      quantity: 0, // No specific quantity needed
      reason: reason as any,
      urgency: reason === 'empty_stock' ? 'high' : 'medium',
      category: 'pastry',
      notes: `Hinzugefügt aufgrund von ${
        reason === 'empty_stock' ? 'leerem Bestand' : 'geringem Bestand'
      }`,
      requested_by: 'Vorbereitungsschicht',
      requested_at: new Date().toLocaleTimeString('de-DE'),
    }

    setAdditionalProduction([...additionalProduction, newItem])
  }

  const generatePrepList = async () => {
    setIsGenerating(true)
    try {
      const generatedTasks = await PrepTaskLoader.generatePrepTasksForDate(
        selectedDate
      )
      setPrepSections(generatedTasks)

      const schedule = await PrepTaskLoader.getBakingScheduleForDate(
        selectedDate
      )
      setBakingSchedule(schedule)
    } catch (error) {
      console.error('Error regenerating prep tasks:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    // State
    selectedDate,
    tabValue,
    saveDialogOpen,
    isGenerating,
    isLoading,
    isFromSpecificFile,
    editMode,
    expandedSections,
    prepSections,
    bakingSchedule,
    additionalProduction,

    // Actions
    setSelectedDate,
    setTabValue,
    setSaveDialogOpen,
    setEditMode,
    toggleSectionExpanded,

    // Complex actions
    loadPrepTasks,
    generatePrepList,
    toggleItemCompletion,
    toggleSectionCompletion,
    updateItemQuantity,
    updateBakingQuantity,
    handleAddToProduction,

    // Computed values
    calculateProgress,
  }
}
