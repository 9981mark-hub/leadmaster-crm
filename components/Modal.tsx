import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-background/80 z-50 flex justify-center items-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/40">
          <h3 id="modal-title" className="text-base font-bold text-foreground">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer" 
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
