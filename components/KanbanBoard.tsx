import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Case } from '../types';
import { motion } from 'framer-motion';
import { Phone, User, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KanbanBoardProps {
    cases: Case[];
    statuses: string[];
    onUpdateStatus: (caseId: string, newStatus: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ cases, statuses, onUpdateStatus }) => {
    const navigate = useNavigate();

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        console.log(`Moving ${draggableId} to ${newStatus}`);
        onUpdateStatus(draggableId, newStatus);
    };

    // Group cases by status
    const columns = statuses.reduce((acc, status) => {
        acc[status] = cases.filter(c => c.status === status);
        return acc;
    }, {} as Record<string, Case[]>);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex overflow-x-auto pb-4 gap-4 h-[calc(100vh-200px)] items-start">
                {statuses.map((status) => (
                    <div key={status} className="min-w-[280px] w-[300px] flex flex-col h-full bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
                        <div className="p-3 font-bold text-gray-700 dark:text-gray-200 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 rounded-t-xl border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
                            <span>{status}</span>
                            <span className="bg-gray-200 dark:bg-gray-700 text-xs px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                                {columns[status]?.length || 0}
                            </span>
                        </div>

                        <Droppable droppableId={status}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-1 p-2 overflow-y-auto scrollbar-hide transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                >
                                    {columns[status]?.map((c, index) => (
                                        // @ts-ignore
                                        <Draggable key={c.caseId} draggableId={c.caseId} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    style={{ ...provided.draggableProps.style }}
                                                    className="mb-3"
                                                    onClick={() => navigate(`/case/${c.caseId}`)}
                                                >
                                                    <motion.div
                                                        initial={false}
                                                        animate={snapshot.isDragging ? { scale: 1.05, rotate: 2, boxShadow: "0px 10px 20px rgba(0,0,0,0.1)" } : { scale: 1, rotate: 0, boxShadow: "0px 2px 5px rgba(0,0,0,0.05)" }}
                                                        className={`bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors group cursor-grab active:cursor-grabbing ${c.isNew ? 'ring-2 ring-red-500/20' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="font-bold text-gray-800 dark:text-gray-100">{c.customerName}</span>
                                                            {c.isNew && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded">NEW</span>}
                                                        </div>
                                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                            <Phone size={12} className="mr-1" /> {c.phone}
                                                        </div>
                                                        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                                                            <span>{c.caseType}</span>
                                                            <span>{c.managerName || '-'}</span>
                                                        </div>

                                                        {c.secondaryStatus && (
                                                            <div className="mt-2 text-[10px] bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 px-2 py-1 rounded text-center truncate">
                                                                {c.secondaryStatus}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
};
