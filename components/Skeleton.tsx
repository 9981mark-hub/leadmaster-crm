import React from 'react';

interface SkeletonProps {
    className?: string;
    count?: number; // Helpers to render multiple lines
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, count = 1 }) => {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
                />
            ))}
        </div>
    );
};

export const CardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-[100px] flex flex-col justify-between">
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-1/2" />
        </div>
        <div className="flex justify-end">
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    </div>
);

export const ListSkeleton = ({ rows = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded" />
            </div>
        ))}
    </div>
);
