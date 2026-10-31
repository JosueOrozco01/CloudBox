import { api } from './apiClient';
export const getPaymentMethods = () => api('/payments/methods').then(r => r.data);
export const getPayments = () => api('/payments/history').then(r => r.data);
export const getPayment = id => api(`/payments/${id}`).then(r => r.data);
export const getReceipt = id => api(`/payments/${id}/receipt`).then(r => r.data);
export const getReceiptDownload = id => api(`/payments/${id}/receipt/download`).then(r => r.data);
