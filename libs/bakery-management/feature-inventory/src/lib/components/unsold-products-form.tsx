import React from 'react'

export interface UnsoldProductsFormProps {
  onSubmit: (productId: number, quantity: number) => void | Promise<void>
}

// Placeholder component - actual implementation will be migrated later
const UnsoldProductsForm: React.FC<UnsoldProductsFormProps> = ({
  onSubmit,
}) => {
  return (
    <div>
      <h1>Unverkaufte Produkte erfassen</h1>
      <form>
        <label htmlFor="product-select">Produkt auswählen</label>
        <input id="product-select" type="text" />

        <label htmlFor="unsold-quantity">Anzahl unverkauft</label>
        <input id="unsold-quantity" type="number" />

        <button type="submit" disabled>
          Unverkaufte Produkte speichern
        </button>
      </form>
    </div>
  )
}

export default UnsoldProductsForm
