import React from 'react';
import { Modal as MuiModal, ModalProps as MuiModalProps, Box } from '@mui/material';

interface ModalProps extends Omit<MuiModalProps, 'children'> {
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ children, ...props }) => {
  return (
    <MuiModal {...props}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
        }}
      >
        {children}
      </Box>
    </MuiModal>
  );
};

export default Modal;