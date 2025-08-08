import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockAdjustmentDialog } from '../StockAdjustmentDialog';
import { InventoryItem } from '@bakery/shared/data-access';

describe('StockAdjustmentDialog', () => {
  const mockItem: InventoryItem = {
    id: 1,
    productId: 1,
    quantity: 100,
    minimumQuantity: 20,
    product: {
      id: 1,
      name: 'Mehl',
      price: 0.50,
    },
  };

  const defaultProps = {
    open: true,
    item: mockItem,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dialog with product information', () => {
    render(<StockAdjustmentDialog {...defaultProps} />);

    expect(screen.getByText('Bestandsanpassung: Mehl')).toBeInTheDocument();
    expect(screen.getByText(/Aktueller Bestand: 100/)).toBeInTheDocument();
  });

  it('should show adjustment history if provided', () => {
    const propsWithHistory = {
      ...defaultProps,
      item: {
        ...mockItem,
        adjustments: [
          {
            id: 1,
            adjustmentType: 'increase',
            quantity: 50,
            previousQuantity: 50,
            newQuantity: 100,
            reason: 'Neue Lieferung',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
      },
    };

    render(<StockAdjustmentDialog {...propsWithHistory} />);

    expect(screen.getByText('Anpassungsverlauf')).toBeInTheDocument();
    expect(screen.getByText('Neue Lieferung')).toBeInTheDocument();
  });

  describe('Adjustment Types', () => {
    it('should calculate new quantity for increase', async () => {
      const user = userEvent.setup();
      render(<StockAdjustmentDialog {...defaultProps} />);

      // Select increase type
      const typeSelect = screen.getByLabelText(/anpassungstyp/i);
      fireEvent.mouseDown(typeSelect);
      const increaseOption = await screen.findByText('Erhöhen');
      fireEvent.click(increaseOption);

      // Enter quantity
      await user.type(screen.getByLabelText(/menge/i), '50');

      // Check calculated new quantity
      expect(screen.getByText(/Neuer Bestand: 150/)).toBeInTheDocument();
    });

    it('should calculate new quantity for decrease', async () => {
      const user = userEvent.setup();
      render(<StockAdjustmentDialog {...defaultProps} />);

      // Select decrease type
      const typeSelect = screen.getByLabelText(/anpassungstyp/i);
      fireEvent.mouseDown(typeSelect);
      const decreaseOption = await screen.findByText('Verringern');
      fireEvent.click(decreaseOption);

      // Enter quantity
      await user.type(screen.getByLabelText(/menge/i), '30');

      // Check calculated new quantity
      expect(screen.getByText(/Neuer Bestand: 70/)).toBeInTheDocument();
    });

    it('should calculate new quantity for set', async () => {
      const user = userEvent.setup();
      render(<StockAdjustmentDialog {...defaultProps} />);

      // Select set type
      const typeSelect = screen.getByLabelText(/anpassungstyp/i);
      fireEvent.mouseDown(typeSelect);
      const setOption = await screen.findByText('Setzen');
      fireEvent.click(setOption);

      // Enter quantity
      await user.type(screen.getByLabelText(/menge/i), '200');

      // Check new quantity
      expect(screen.getByText(/Neuer Bestand: 200/)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error for negative decrease', async () => {
      const user = userEvent.setup();
      render(<StockAdjustmentDialog {...defaultProps} />);

      // Select decrease type
      const typeSelect = screen.getByLabelText(/anpassungstyp/i);
      fireEvent.mouseDown(typeSelect);
      const decreaseOption = await screen.findByText('Verringern');
      fireEvent.click(decreaseOption);

      // Enter quantity that would result in negative stock
      await user.type(screen.getByLabelText(/menge/i), '150');

      // Check error message
      expect(screen.getByText(/Bestand würde negativ werden/)).toBeInTheDocument();
      
      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /anpassen/i });
      expect(submitButton).toBeDisabled();
    });

    it('should require reason for adjustment', async () => {
      render(<StockAdjustmentDialog {...defaultProps} />);

      // Try to submit without reason
      const submitButton = screen.getByRole('button', { name: /anpassen/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/grund ist erforderlich/i)).toBeInTheDocument();
      });
    });

    it('should require positive quantity', async () => {
      const user = userEvent.setup();
      render(<StockAdjustmentDialog {...defaultProps} />);

      const quantityField = screen.getByLabelText(/menge/i);
      await user.type(quantityField, '-10');

      // Submit to trigger validation
      const submitButton = screen.getByRole('button', { name: /anpassen/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/menge muss positiv sein/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit valid adjustment', async () => {
      const user = userEvent.setup();
      render(<StockAdjustmentDialog {...defaultProps} />);

      // Fill form
      await user.type(screen.getByLabelText(/menge/i), '50');
      await user.type(screen.getByLabelText(/grund/i), 'Neue Lieferung erhalten');

      // Submit
      const submitButton = screen.getByRole('button', { name: /anpassen/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
          adjustmentType: 'increase',
          quantity: 50,
          reason: 'Neue Lieferung erhalten',
        });
      });
    });

    it('should close dialog on cancel', () => {
      render(<StockAdjustmentDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /abbrechen/i });
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should disable submit button when loading', () => {
      render(
        <StockAdjustmentDialog
          {...defaultProps}
          loading={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /anpassen/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Anpassen...');
    });
  });

  it('should not render when closed', () => {
    render(<StockAdjustmentDialog {...defaultProps} open={false} />);
    
    expect(screen.queryByText('Bestandsanpassung')).not.toBeInTheDocument();
  });

  it('should display error message when provided', () => {
    const errorMessage = 'Anpassung fehlgeschlagen';
    render(
      <StockAdjustmentDialog
        {...defaultProps}
        error={errorMessage}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});