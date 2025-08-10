import React from 'react'

export interface CashEntryFormProps {
  onSubmit: (amount: number) => void | Promise<void>
}

// Placeholder component - actual implementation will be migrated later
const CashEntryForm: React.FC<CashEntryFormProps> = ({ onSubmit }) => {
  return (
    <div>
      <h1>Täglichen Kassenstand eingeben</h1>
      <form>
        <label htmlFor="cash-amount">Kassenstand</label>
        <input id="cash-amount" type="text" />

        <button type="submit" disabled>
          Kassenstand speichern
        </button>
      </form>
    </div>
  )
}

export default CashEntryForm
