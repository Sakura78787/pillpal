import { useAppointmentStore } from '@/store/appointmentStore.js';
import { useHealthStore } from '@/store/healthStore.js';
import { useLogStore } from '@/store/logStore.js';
import { useMedicationStore } from '@/store/medicationStore.js';

export const clearGuestDomainState = () => {
  useMedicationStore.setState({ medications: [], selectedMedication: null, error: null });
  useLogStore.setState({ logs: [], todayLogs: [], error: null });
  useHealthStore.setState({ records: [], todayRecords: [], selectedRecord: null, error: null });
  useAppointmentStore.setState({ appointments: [], selectedAppointment: null, error: null });
};

export const loadGuestDomainState = (session) => {
  useMedicationStore.setState({ medications: session.medications, selectedMedication: null, error: null });
  useLogStore.setState({ logs: session.medicationLogs, todayLogs: [], error: null });
  useHealthStore.setState({ records: session.healthRecords, todayRecords: [], selectedRecord: null, error: null });
  useAppointmentStore.setState({ appointments: session.appointments, selectedAppointment: null, error: null });
};
