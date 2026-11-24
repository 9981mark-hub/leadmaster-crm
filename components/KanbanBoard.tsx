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

// monday.com 상태별 시그니처 색상 매핑
const getStatusColor = (st: string) => {
    if (st.includes('신규') || st.includes('접수')) return '#0073ea';
    if (st.includes('상담') || st.includes('부재') || st.includes('재통화')) return '#fdab3d';
    if (st.includes('적격') || st.includes('심사') || st.includes('서류') || st.includes('인계')) return '#579bfc';
    if (st.includes('수임') || st.includes('계약') || st.includes('완료')) return '#00c875';
    if (st.includes('보류') || st.includes('취소') || st.includes('종결') || st.includes('실패')) return '#df2f4a';
    return '#a25ddc';
};

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
    // 한 칸에 너무 많으면 화면이 느려진다 → 앞 80건만 그리고 나머지는 숫자로
    const COLUMN_LIMIT = 80;

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex overflow-x-auto pb-8 gap-3.5 h-[calc(100vh-200px)] items-start">
                {statuses.map((status) => {
                    const statusColor = getStatusColor(status);
                    return (
                        <div key={status} className="min-w-[280px] w-[300px] flex flex-col h-full bg-[#f6f7fb] dark:bg-card/60 rounded-[8px] border border-[#d0d4e4] dark:border-border shadow-2xs overflow-hidden">
                            {/* monday.com 표준 솔리드 헤더 (상태 컬러 원형 닷 & 볼드 카운트) */}
                            <div className="p-3 font-bold text-[#323338] dark:text-foreground flex justify-between items-center bg-white dark:bg-card border-b border-[#d0d4e4] dark:border-border sticky top-0 z-10 shrink-0">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: statusColor }}
                                    />
                                    <span className="text-xs sm:text-sm font-semibold truncate max-w-[190px]">{status}</span>
                                </div>
                                <span className="bg-[#f0f3ff] dark:bg-primary/10 text-primary border border-primary/20 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                                    {columns[status]?.length || 0}
                                </span>
                            </div>

                            <Droppable droppableId={status}>
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`flex-1 p-2.5 overflow-y-auto space-y-2 custom-scrollbar transition-colors ${
                                            snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-transparent'
                                        }`}
                                    >
                                        {columns[status]?.slice(0, COLUMN_LIMIT).map((c, index) => (
                                            // @ts-ignore
                                            <Draggable key={c.caseId} draggableId={c.caseId} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        style={{ ...provided.draggableProps.style }}
                                                        onClick={() => navigate(`/case/${c.caseId}`)}
                                                    >
                                                        <motion.div
                                                            initial={false}
                                                            animate={snapshot.isDragging ? { scale: 1.03, rotate: 1, boxShadow: "0px 10px 25px rgba(0,0,0,0.18)" } : { scale: 1, rotate: 0, boxShadow: "0px 1px 3px rgba(0,0,0,0.06)" }}
                                                            className={`bg-white dark:bg-card p-3 rounded-[8px] border border-[#d0d4e4] dark:border-border hover:border-primary/60 hover:shadow-md transition-all duration-150 group cursor-grab active:cursor-grabbing text-foreground shadow-2xs relative ${c.isNew ? 'ring-2 ring-rose-500/30' : ''}`}
                                                            style={{ borderLeftWidth: '4px', borderLeftColor: statusColor }}
                                                        >
                                                            <div className="flex justify-between items-start mb-1.5">
                                                                <span className="font-bold text-xs sm:text-sm text-[#323338] dark:text-foreground">{c.customerName}</span>
                                                                {c.isNew && <span className="text-2xs font-extrabold bg-rose-500/15 text-rose-500 border border-rose-500/30 px-1.5 py-0.2 rounded-md">NEW</span>}
                                                            </div>
                                                            <div className="flex items-center text-xs text-[#676879] dark:text-muted-foreground mb-1 font-mono">
                                                                <Phone size={12} className="mr-1 text-primary shrink-0" /> {c.phone}
                                                            </div>
                                                            <div className="flex items-center text-2xs text-[#676879] dark:text-muted-foreground justify-between mt-2 pt-2 border-t border-[#d0d4e4]/60 dark:border-border">
                                                                <span className="px-1.5 py-0.5 rounded bg-[#f6f7fb] dark:bg-muted font-medium">{c.caseType}</span>
                                                                <span className="font-medium text-[#323338] dark:text-foreground/80">{c.managerName || '-'}</span>
                                                            </div>

                                                            {c.secondaryStatus && (
                                                                <div className="mt-2 text-2xs bg-[#f6f7fb] dark:bg-muted/60 text-[#676879] dark:text-muted-foreground px-2 py-1 rounded-[4px] text-center truncate border border-[#d0d4e4]/50 dark:border-border/50">
                                                                    {c.secondaryStatus}
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                        {(columns[status]?.length || 0) > COLUMN_LIMIT && (
                                            <div className="text-center text-2xs text-muted-foreground py-2 break-keep">외 {(columns[status].length - COLUMN_LIMIT).toLocaleString()}건 — 검색·필터로 좁혀 보세요</div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    );
                })}
            </div>
        </DragDropContext>
    );
};
