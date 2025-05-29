import React, { useState, useEffect } from 'react'
import { Review } from '../../../services/types' // Adjust import path
// Consider using Material UI components like TextField, Button, Rating

interface ReviewFormProps {
  initialData?: Review
  onSubmit: (reviewData: Omit<Review, 'id' | 'recipeId' | 'date'>) => void
  onCancel: () => void
  recipeId: string // To associate the review with a recipe
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  recipeId,
}) => {
  const [author, setAuthor] = useState('')
  const [rating, setRating] = useState<number>(0)
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (initialData) {
      setAuthor(initialData.author)
      setRating(initialData.rating)
      setComment(initialData.comment || '')
    }
  }, [initialData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      alert('Please provide a rating.')
      return
    }
    onSubmit({ author, rating, comment })
    // Reset form or rely on parent to close
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="author">Author:</label>
        <input
          type="text"
          id="author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="rating">Rating:</label>
        {/* Basic select for rating, consider using a star component */}
        <select
          id="rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          required
        >
          <option value="0" disabled>
            Select a rating
          </option>
          <option value="1">1 Star</option>
          <option value="2">2 Stars</option>
          <option value="3">3 Stars</option>
          <option value="4">4 Stars</option>
          <option value="5">5 Stars</option>
        </select>
      </div>
      <div>
        <label htmlFor="comment">Comment:</label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <button type="submit">
        {initialData ? 'Update Review' : 'Add Review'}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

export default ReviewForm
