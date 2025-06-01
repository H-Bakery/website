# Bakery Production Feature

This folder contains all code related to the bakery production planning and management features.

## Overview

The production feature enables bakery staff to plan and manage production for special Saturday baking. It includes:

- Production planning dashboard
- Filling preparation calculations
- Ingredient checklists
- Recipe management

## Folder Structure

- `/components` - UI components specific to production features
- `/utils` - Utility functions for calculations and data processing
- `/data` - Static data files for recipes and production specifications

## Key Components

1. **SaturdayProductionDashboard** - Main component for production planning (40kg dough batches)
2. **FillingPreparation** - Component for preparing different types of fillings (15kg per batch)
3. **ProductionChecklist** - Checklist for production tasks

## Data Sources

The production calculations are based on:
- Teigstückübersicht für Kuchen - Defines the dough pieces specs (e.g., a Kranz is made from 3 pieces of 600g dough)
- Füllungen für Kränze - Provides recipes for different fillings

## Special Saturday Production

The Saturday production focuses on:
- Hefezopf and Hefekranz products
- Gefüllte Kränze (with 1200g filling per piece, made from 3 pieces of 600g dough)
- Gefüllte Zöpfe (with 450g filling per piece)
- Kleine Zöpfe (made from 2 pieces of 300g dough)
- Große Zöpfe (made from 3 pieces of 300g dough)
- No Hefeschnecken on Saturdays

## Calculation Logic

The production calculator uses the following approach:
1. Calculate total dough required based on orders
2. Determine number of batches needed (40kg per batch)
3. Calculate filling requirements based on product specifications (15kg per filling batch)
4. Count the individual dough pieces needed (based on the "Teigstückübersicht")
5. Generate a comprehensive production plan

## How to Add New Products

To add a new product to the production system:
1. Add the product recipe to `productionCalculator.ts`
2. Reference the appropriate dough piece from the "Teigstückübersicht" 
   (which defines how many pieces of what weight are needed per product)
3. Define any filling specifications if applicable
4. Update the UI components to display the new product