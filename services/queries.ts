import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCases, fetchCase, updateCase, createCase, deleteCase, fetchStatuses, fetchPartners, fetchInboundPaths } from './api';
import { useToast } from '../contexts/ToastContext';

// Keys
export const QUERY_KEYS = {
    cases: ['cases'],
    case: (id: string) => ['case', id],
    statuses: ['statuses'],
    partners: ['partners'],
    inboundPaths: ['inboundPaths'],
};

// Hooks
export const useCases = () => {
    return useQuery({
        queryKey: QUERY_KEYS.cases,
        queryFn: fetchCases,
    });
};

export const useCase = (id: string | undefined) => {
    return useQuery({
        queryKey: QUERY_KEYS.case(id || ''),
        queryFn: () => fetchCase(id || ''),
        enabled: !!id,
    });
};

export const useStatuses = () => {
    return useQuery({
        queryKey: QUERY_KEYS.statuses,
        queryFn: fetchStatuses,
        staleTime: Infinity, // Statuses rarely change
    });
};

export const usePartners = () => {
    return useQuery({
        queryKey: QUERY_KEYS.partners,
        queryFn: fetchPartners,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useInboundPaths = () => {
    return useQuery({
        queryKey: QUERY_KEYS.inboundPaths,
        queryFn: fetchInboundPaths,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

// Mutations
export const useUpdateCaseMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: (data: { id: string; updates: any; silent?: boolean }) => updateCase(data.id, data.updates),
        onSuccess: (data, variables) => {
            // Update specific case in cache
            queryClient.setQueryData(QUERY_KEYS.case(variables.id), data);

            // Invalidate list to refresh filtered views
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });

            if (!variables.silent) {
                showToast('저장되었습니다.');
            }
        },
        onError: (error) => {
            console.error(error);
            showToast('저장에 실패했습니다.', 'error');
        }
    });
};

export const useCreateCaseMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: (newCase: any) => createCase(newCase),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });
            showToast('신규 케이스가 생성되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('생성에 실패했습니다.', 'error');
        }
    });
};

export const useDeleteCaseMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: (id: string) => deleteCase(id, true),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });
            showToast('삭제되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('삭제에 실패했습니다.', 'error');
        }
    });
};
