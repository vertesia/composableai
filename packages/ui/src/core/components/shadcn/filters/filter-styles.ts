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
  background: hsl(var(--muted)) !important;
}
`;