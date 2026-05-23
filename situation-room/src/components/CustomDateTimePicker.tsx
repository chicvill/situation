import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MobileDateTimePicker } from '@mui/x-date-pickers/MobileDateTimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

// Set dayjs locale to Korean
dayjs.locale('ko');

interface Props {
    value: string; // 'YYYY-MM-DDTHH:mm'
    onChange: (val: string) => void;
}

export const CustomDateTimePicker: React.FC<Props> = ({ value, onChange }) => {
    // Convert string "YYYY-MM-DDTHH:mm" to dayjs object, or use current date
    const dateValue = value ? dayjs(value) : null;

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
            <MobileDateTimePicker
                value={dateValue}
                onChange={(newValue) => {
                    if (newValue) {
                        onChange(newValue.format('YYYY-MM-DDTHH:mm'));
                    }
                }}
                format="YYYY-MM-DD A hh:mm"
                minutesStep={15}
                viewRenderers={{
                    hours: renderTimeViewClock,
                    minutes: renderTimeViewClock,
                    seconds: renderTimeViewClock,
                }}
                slotProps={{
                    textField: {
                        variant: 'outlined',
                        fullWidth: true,
                        placeholder: '날짜 및 시간을 선택하세요',
                        sx: {
                            backgroundColor: 'var(--bg-main)',
                            borderRadius: '10px',
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                '& fieldset': {
                                    borderColor: 'var(--border)',
                                    borderWidth: '1px',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'var(--border-strong)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'var(--accent-orange)',
                                    borderWidth: '2px',
                                },
                            },
                            '& .MuiInputBase-input': {
                                padding: '12px 14px',
                                color: 'var(--text-main)',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                fontFamily: 'inherit',
                            }
                        }
                    },
                    toolbar: {
                        hidden: false,
                    },
                    dialog: {
                        sx: { zIndex: 6000 }
                    }
                }}
            />
        </LocalizationProvider>
    );
};
