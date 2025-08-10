import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryFilters } from '../InventoryFilters';

describe('InventoryFilters', () => {
  const mockCategories = ['Rohstoffe', 'Verpackung', 'Hilfsstoffe'];
  const mockSuppliers = ['Supplier A', 'Supplier B', 'Supplier C'];

  const defaultProps = {
    categories: mockCategories,
    suppliers: mockSuppliers,
    onFilterChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all filter fields', () => {
    render(<InventoryFilters {...defaultProps} />);

    expect(screen.getByLabelText(/suchen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/kategorie/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lieferant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lagerort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/niedrige bestände anzeigen/i)).toBeInTheDocument();
  });

  describe('Search Filter', () => {
    it('should debounce search input', async () => {
      const user = userEvent.setup();
      render(<InventoryFilters {...defaultProps} />);

      const searchField = screen.getByLabelText(/suchen/i);
      await user.type(searchField, 'Mehl');

      // Should not call immediately
      expect(defaultProps.onFilterChange).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
          search: 'Mehl',
        });
      }, { timeout: 600 });
    });

    it('should handle empty search', async () => {
      const user = userEvent.setup();
      render(<InventoryFilters {...defaultProps} />);

      const searchField = screen.getByLabelText(/suchen/i);
      await user.type(searchField, 'test');
      
      // Wait for first debounce
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
          search: 'test',
        });
      });

      // Clear the field
      await user.clear(searchField);

      // Wait for second debounce
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenLastCalledWith({
          search: '',
        });
      });
    });
  });

  describe('Category Filter', () => {
    it('should filter by category', async () => {
      render(<InventoryFilters {...defaultProps} />);

      const categorySelect = screen.getByLabelText(/kategorie/i);
      fireEvent.mouseDown(categorySelect);
      
      const rohstoffeOption = await screen.findByText('Rohstoffe');
      fireEvent.click(rohstoffeOption);

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
        category: 'Rohstoffe',
      });
    });

    it('should clear category filter', async () => {
      render(<InventoryFilters {...defaultProps} />);

      // First select a category
      const categorySelect = screen.getByLabelText(/kategorie/i);
      fireEvent.mouseDown(categorySelect);
      const rohstoffeOption = await screen.findByText('Rohstoffe');
      fireEvent.click(rohstoffeOption);

      // Then select "Alle"
      fireEvent.mouseDown(categorySelect);
      const alleOption = await screen.findByText('Alle');
      fireEvent.click(alleOption);

      expect(defaultProps.onFilterChange).toHaveBeenLastCalledWith({
        category: '',
      });
    });
  });

  describe('Supplier Filter', () => {
    it('should filter by supplier', async () => {
      render(<InventoryFilters {...defaultProps} />);

      const supplierSelect = screen.getByLabelText(/lieferant/i);
      fireEvent.mouseDown(supplierSelect);
      
      const supplierOption = await screen.findByText('Supplier A');
      fireEvent.click(supplierOption);

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
        supplier: 'Supplier A',
      });
    });
  });

  describe('Location Filter', () => {
    it('should filter by location', async () => {
      const user = userEvent.setup();
      render(<InventoryFilters {...defaultProps} />);

      const locationField = screen.getByLabelText(/lagerort/i);
      await user.type(locationField, 'A1');

      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
          location: 'A1',
        });
      });
    });
  });

  describe('Low Stock Filter', () => {
    it('should toggle low stock filter', () => {
      render(<InventoryFilters {...defaultProps} />);

      const lowStockCheckbox = screen.getByLabelText(/niedrige bestände anzeigen/i);
      fireEvent.click(lowStockCheckbox);

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
        lowStock: true,
      });
    });

    it('should untoggle low stock filter', () => {
      render(<InventoryFilters {...defaultProps} />);

      const lowStockCheckbox = screen.getByLabelText(/niedrige bestände anzeigen/i);
      
      // Toggle on
      fireEvent.click(lowStockCheckbox);
      
      // Toggle off
      fireEvent.click(lowStockCheckbox);

      expect(defaultProps.onFilterChange).toHaveBeenLastCalledWith({
        lowStock: false,
      });
    });
  });

  describe('Multiple Filters', () => {
    it('should handle multiple filter changes', async () => {
      const user = userEvent.setup();
      render(<InventoryFilters {...defaultProps} />);

      // Set category
      const categorySelect = screen.getByLabelText(/kategorie/i);
      fireEvent.mouseDown(categorySelect);
      const categoryOption = await screen.findByText('Rohstoffe');
      fireEvent.click(categoryOption);

      // Set supplier
      const supplierSelect = screen.getByLabelText(/lieferant/i);
      fireEvent.mouseDown(supplierSelect);
      const supplierOption = await screen.findByText('Supplier A');
      fireEvent.click(supplierOption);

      // Toggle low stock
      const lowStockCheckbox = screen.getByLabelText(/niedrige bestände anzeigen/i);
      fireEvent.click(lowStockCheckbox);

      // Verify all filters were applied
      expect(defaultProps.onFilterChange).toHaveBeenCalledTimes(3);
      expect(defaultProps.onFilterChange).toHaveBeenNthCalledWith(1, { category: 'Rohstoffe' });
      expect(defaultProps.onFilterChange).toHaveBeenNthCalledWith(2, { supplier: 'Supplier A' });
      expect(defaultProps.onFilterChange).toHaveBeenNthCalledWith(3, { lowStock: true });
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all inputs', () => {
      render(<InventoryFilters {...defaultProps} />);

      expect(screen.getByLabelText(/suchen/i)).toHaveAttribute('type', 'text');
      expect(screen.getByRole('combobox', { name: /kategorie/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /lieferant/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /lagerort/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /niedrige bestände anzeigen/i })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable inputs when loading', () => {
      render(<InventoryFilters {...defaultProps} loading={true} />);

      expect(screen.getByLabelText(/suchen/i)).toBeDisabled();
      expect(screen.getByLabelText(/kategorie/i)).toBeDisabled();
      expect(screen.getByLabelText(/lieferant/i)).toBeDisabled();
      expect(screen.getByLabelText(/lagerort/i)).toBeDisabled();
      expect(screen.getByLabelText(/niedrige bestände anzeigen/i)).toBeDisabled();
    });
  });
});