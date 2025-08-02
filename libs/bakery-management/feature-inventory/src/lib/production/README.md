# Bakery Production Feature

This directory contains the code for the bakery's production planning and management system.

## Overview

The production feature enables bakery staff to plan and manage production for special Saturday baking with a focus on:

- Tracking product orders for production days
- Calculating required dough quantities and batches
- Planning filling preparations based on product needs
- Generating production checklists

## Structure

- `/components` - React components for production UI
- `/utils` - Calculation logic and business utilities
- `/data` - Data definitions and recipes

## Key Components

### SaturdayProductionDashboard

Main interface for planning Saturday production:

- Order input for different bakery products
- Visual display of dough batch requirements (40kg per batch)
- Overview of required dough pieces for each product

### FillingPreparation

Specialized interface for filling preparation:

- Calculates ingredients needed for each filling type
- Shows detailed recipes scaled to production volumes
- Displays total filling amounts required for production

### ProductionChecklist

Printable checklist for bakery staff:

- Step-by-step list of production tasks
- Tracks dough preparation, portioning, and product assembly
- Includes filling preparation steps

## Data Sources

The calculations are based on:

- **Teigstückübersicht für Kuchen** - Defines standard dough piece specifications
  - Each product requires multiple dough pieces of specific weights
  - For example, a Kranz is made from 3 pieces of 600g dough
- **Füllungen für Kränze** - Provides filling recipes and specifications
  - Base recipes are scaled based on total amount needed
  - Gefüllte Kränze require 1200g filling per piece
  - Gefüllte Zöpfe require 450g filling per piece

## Usage

The production feature is accessed through the `/admin/bakery/saturday-production` route in the admin interface.
