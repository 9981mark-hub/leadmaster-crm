import React from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-green-600' : 'bg-red-600';
  const Icon = isSuccess ? CheckCircle : AlertTriangle;

  return (
    <div 
      className={`fixed bottom-5 right-5 z-50 flex items-center justify-between p-4 rounded-lg shadow-lg text-white ${bgColor} animate-fade-in-up`}
      role="alert"
    >
      <div className="flex items-center">
        <Icon size={20} className="mr-3" />
        <span className="font-medium text-sm">{message}</span>
      </div>
      <button onClick={onClose} className="ml-4 -mr-1 p-1 rounded-full hover:bg-white/20 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}