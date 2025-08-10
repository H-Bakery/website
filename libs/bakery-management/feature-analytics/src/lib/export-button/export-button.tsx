import React from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress, Alert, Snackbar } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import GridOnIcon from '@mui/icons-material/GridOn';
import ImageIcon from '@mui/icons-material/Image';
import { useExportReports, ExportParams } from '../hooks/use-export-reports';

interface AnalyticsParams {
  startDate: string;
  endDate: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export type ExportFormat = 'csv' | 'pdf' | 'excel' | 'png';

export interface ExportButtonProps {
  onExport?: (format: ExportFormat) => void;
  formats?: ExportFormat[];
  disabled?: boolean;
  buttonText?: string;
  size?: 'small' | 'medium' | 'large';
  analyticsParams?: AnalyticsParams;
  includeCharts?: boolean;
}

const formatIcons: Record<ExportFormat, React.ReactElement> = {
  csv: <GridOnIcon />,
  pdf: <DescriptionIcon />,
  excel: <GridOnIcon />,
  png: <ImageIcon />,
};

const formatLabels: Record<ExportFormat, string> = {
  csv: 'CSV exportieren',
  pdf: 'PDF exportieren',
  excel: 'Excel exportieren',
  png: 'Als Bild exportieren',
};

export function ExportButton({
  onExport,
  formats = ['csv', 'pdf', 'excel'],
  disabled = false,
  buttonText = 'Exportieren',
  size = 'medium',
  analyticsParams,
  includeCharts = true,
}: ExportButtonProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const open = Boolean(anchorEl);
  
  const { exportReport, isExporting, error, clearError } = useExportReports();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: ExportFormat) => {
    handleClose();
    
    // For PNG export or custom export handler, use the provided callback
    if (format === 'png' || !analyticsParams) {
      onExport?.(format);
      return;
    }

    try {
      const exportParams: ExportParams = {
        ...analyticsParams,
        format: format as 'pdf' | 'excel' | 'csv',
        includeCharts,
      };

      await exportReport(exportParams);
      setShowSuccess(true);
    } catch (error) {
      // Error is handled by the hook
      console.error('Export failed:', error);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
        onClick={handleClick}
        disabled={disabled || isExporting}
        size={size}
      >
        {isExporting ? 'Exportiere...' : buttonText}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {formats.map((format) => (
          <MenuItem key={format} onClick={() => handleExport(format)}>
            <ListItemIcon>{formatIcons[format]}</ListItemIcon>
            <ListItemText>{formatLabels[format]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Success notification */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={4000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Report wurde erfolgreich exportiert und heruntergeladen!
        </Alert>
      </Snackbar>

      {/* Error notification */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={clearError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ExportButton;