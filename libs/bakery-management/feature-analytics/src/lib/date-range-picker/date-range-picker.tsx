import React from 'react';
import { Box, TextField, Button, ButtonGroup, Paper } from '@mui/material';
import { DateRange } from '@bakery/shared/types';

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: string;
  maxDate?: string;
  presets?: Array<{
    label: string;
    getValue: () => DateRange;
  }>;
}

export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate = new Date().toISOString().split('T')[0],
  presets = defaultPresets,
}: DateRangePickerProps) {
  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      startDate: event.target.value,
    });
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      endDate: event.target.value,
    });
  };

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          label="Von"
          type="date"
          value={value.startDate}
          onChange={handleStartDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            min: minDate,
            max: value.endDate || maxDate,
          }}
          size="small"
        />
        
        <TextField
          label="Bis"
          type="date"
          value={value.endDate}
          onChange={handleEndDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            min: value.startDate || minDate,
            max: maxDate,
          }}
          size="small"
        />

        <ButtonGroup size="small" variant="outlined">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              onClick={() => onChange(preset.getValue())}
            >
              {preset.label}
            </Button>
          ))}
        </ButtonGroup>
      </Box>
    </Paper>
  );
}

const defaultPresets = [
  {
    label: 'Heute',
    getValue: (): DateRange => {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: today, endDate: today };
    },
  },
  {
    label: 'Gestern',
    getValue: (): DateRange => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = yesterday.toISOString().split('T')[0];
      return { startDate: date, endDate: date };
    },
  },
  {
    label: 'Letzte 7 Tage',
    getValue: (): DateRange => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'Letzte 30 Tage',
    getValue: (): DateRange => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'Dieser Monat',
    getValue: (): DateRange => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'Letzter Monat',
    getValue: (): DateRange => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
];

export default DateRangePicker;