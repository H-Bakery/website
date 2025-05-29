import React from 'react';
import { Review } from '@/services/types'; // Adjust import path
// Consider using Material UI components like Card, CardContent, Typography, IconButton

interface ReviewListItemProps {
  review: Review;
  onEdit: (reviewId: string) => void;
  onDelete: (reviewId: string) => void;
}

const ReviewListItem: React.FC<ReviewListItemProps> = ({ review, onEdit, onDelete }) => {
  return (
    <div style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
      <h4>Rating: {review.rating}/5</h4>
      <p><strong>{review.author}</strong> ({new Date(review.date).toLocaleDateString()})</p>
      <p>{review.comment}</p>
      <button onClick={() => onEdit(review.id)}>Edit</button>
      <button onClick={() => onDelete(review.id)}>Delete</button>
    </div>
  );
};

export default ReviewListItem;
