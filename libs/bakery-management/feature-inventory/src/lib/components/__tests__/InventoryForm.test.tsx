import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryForm } from '../InventoryForm';
import { InventoryItem } from '@bakery/shared/data-access';

describe('InventoryForm', () => {
  const mockProducts = [
    { id: 1, name: 'Mehl' },
    { id: 2, name: 'Hefe' },
  ];

  const mockCategories = ['Rohstoffe', 'Verpackung'];
  const mockSuppliers = ['Supplier A', 'Supplier B'];

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    mode: 'create' as const,
    products: mockProducts,
    categories: mockCategories,
    suppliers: mockSuppliers,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('should render create form with all fields', () => {
      render(<InventoryForm {...defaultProps} />);

      expect(screen.getByText('Neuen Lagerbestand anlegen')).toBeInTheDocument();
      expect(screen.getByLabelText(/produkt/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/anfangsbestand/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mindestbestand/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/einheit/i)).toBeInTheDocument();
    });

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      render(<InventoryForm {...defaultProps} />);

      // Select product
      const productSelect = screen.getByLabelText(/produkt/i);
      fireEvent.mouseDown(productSelect);
      const productOption = await screen.findByText('Mehl');
      fireEvent.click(productOption);

      // Fill in required fields
      await user.type(screen.getByLabelText(/anfangsbestand/i), '100');
      await user.type(screen.getByLabelText(/mindestbestand/i), '20');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /speichern/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            productId: 1,
            quantity: 100,
            minimumQuantity: 20,
          })
        );
      });
    });

    it('should show validation errors for required fields', async () => {
      render(<InventoryForm {...defaultProps} />);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /speichern/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/produkt ist erforderlich/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    const mockItem: InventoryItem = {
      id: 1,
      productId: 1,
      quantity: 100,
      minimumQuantity: 20,
      maximumQuantity: 200,
      reorderPoint: 30,
      location: 'A1',
      unit: 'kg',
      category: 'Rohstoffe',
      supplier: 'Supplier A',
      supplierContact: 'contact@supplier.com',
      notes: 'Test notes',
      product: {
        id: 1,
        name: 'Mehl',
        price: 0.50,
      },
    };

    it('should render edit form with existing data', () => {
      render(
        <InventoryForm
          {...defaultProps}
          mode="edit"
          item={mockItem}
        />
      );

      expect(screen.getByText('Lagerbestand bearbeiten')).toBeInTheDocument();
      expect(screen.getByText('Mehl')).toBeInTheDocument(); // Product name
      expect(screen.getByDisplayValue('20')).toBeInTheDocument(); // minimumQuantity
      expect(screen.getByDisplayValue('A1')).toBeInTheDocument(); // location
    });

    it('should not show quantity field in edit mode', () => {
      render(
        <InventoryForm
          {...defaultProps}
          mode="edit"
          item={mockItem}
        />
      );

      expect(screen.queryByLabelText(/anfangsbestand/i)).not.toBeInTheDocument();
    });

    it('should submit updated data', async () => {
      const user = userEvent.setup();
      render(
        <InventoryForm
          {...defaultProps}
          mode="edit"
          item={mockItem}
        />
      );

      // Update a field
      const minQuantityField = screen.getByLabelText(/mindestbestand/i);
      await user.clear(minQuantityField);
      await user.type(minQuantityField, '25');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /speichern/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            minimumQuantity: 25,
          })
        );
      });
    });
  });

  describe('Form Interactions', () => {
    it('should close form on cancel', () => {
      render(<InventoryForm {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /abbrechen/i });
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should display error message when provided', () => {
      const errorMessage = 'Failed to save inventory';
      render(
        <InventoryForm
          {...defaultProps}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should disable submit button when loading', () => {
      render(
        <InventoryForm
          {...defaultProps}
          loading={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /speichern/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Speichern...');
    });

    it('should handle autocomplete fields', async () => {
      const user = userEvent.setup();
      render(<InventoryForm {...defaultProps} />);

      // Type in category autocomplete
      const categoryField = screen.getByLabelText(/kategorie/i);
      await user.type(categoryField, 'Neue Kategorie');

      // The field should accept free text
      expect(categoryField).toHaveValue('Neue Kategorie');
    });
  });

  describe('Field Validation', () => {
    it('should validate minimum quantity', async () => {
      const user = userEvent.setup();
      render(<InventoryForm {...defaultProps} />);

      const minQuantityField = screen.getByLabelText(/mindestbestand/i);
      await user.type(minQuantityField, '-10');

      // Submit to trigger validation
      const submitButton = screen.getByRole('button', { name: /speichern/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/mindestbestand muss mindestens 0 sein/i)).toBeInTheDocument();
      });
    });

    it('should validate reorder point', async () => {
      const user = userEvent.setup();
      render(<InventoryForm {...defaultProps} />);

      const reorderField = screen.getByLabelText(/bestellpunkt/i);
      await user.type(reorderField, '-5');

      // Submit to trigger validation
      const submitButton = screen.getByRole('button', { name: /speichern/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/bestellpunkt muss mindestens 0 sein/i)).toBeInTheDocument();
      });
    });
  });
});