export const calendarStyles = `
.calendar-wrapper .react-calendar__navigation {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 8px !important;
}

.calendar-wrapper .react-calendar__navigation__label {
  flex: 1 !important;
  text-align: center !important;
  font-weight: 500 !important;
}

.calendar-wrapper .react-calendar__navigation__arrow {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 32px !important;
  height: 32px !important;
  border-radius: 4px !important;
  border: 1px solid hsl(var(--border)) !important;
  background: hsl(var(--background)) !important;
  color: hsl(var(--foreground)) !important;
}

.calendar-wrapper .react-calendar__navigation__arrow:hover {
  background: oklch(var(--muted)) !important;
}

.calendar-wrapper .react-calendar__tile {
  cursor: pointer !important;
  width: 0.5rem !important;
  font-size: 0.875rem !important;
}

.calendar-wrapper .react-calendar__tile:hover,
.calendar-wrapper .react-calendar__month-view__days__day:hover,
.calendar-wrapper .react-calendar__decade-view__years__year:hover,
.calendar-wrapper .react-calendar__year-view__months__month:hover {
  background: #b5b5b580 !important;
}

.calendar-wrapper .react-calendar__tile:not(.react-calendar__tile--active):hover {
  background: #b5b5b580 !important;
}

.calendar-wrapper .react-calendar__tile--hover {
  background: #b5b5b580 !important;
}

.calendar-wrapper .react-calendar__tile--disabled,
.calendar-wrapper .react-calendar__tile:disabled,
.calendar-wrapper .react-calendar__month-view__days__day--disabled,
.calendar-wrapper .react-calendar__month-view__days__day:disabled,
.calendar-wrapper .react-calendar__year-view__months__month--disabled,
.calendar-wrapper .react-calendar__year-view__months__month:disabled,
.calendar-wrapper .react-calendar__decade-view__years__year--disabled,
.calendar-wrapper .react-calendar__decade-view__years__year:disabled {
  cursor: not-allowed !important;
  color: #9ca3af !important;
}

.calendar-wrapper .react-calendar__tile--disabled:hover,
.calendar-wrapper .react-calendar__tile:disabled:hover,
.calendar-wrapper .react-calendar__month-view__days__day--disabled:hover,
.calendar-wrapper .react-calendar__month-view__days__day:disabled:hover,
.calendar-wrapper .react-calendar__year-view__months__month--disabled:hover,
.calendar-wrapper .react-calendar__year-view__months__month:disabled:hover,
.calendar-wrapper .react-calendar__decade-view__years__year--disabled:hover,
.calendar-wrapper .react-calendar__decade-view__years__year:disabled:hover {
  background: transparent !important;
}


.calendar-wrapper .react-calendar__month-view__weekdays {
  font-size: 0.75rem !important;
}

.calendar-wrapper .react-calendar__month-view__weekdays__weekday {
  width: 0.75rem !important;
  font-size: 0.75rem !important;
  text-align: center !important;
}
  
`;