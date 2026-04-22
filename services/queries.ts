import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCases, fetchCase, updateCase, createCase, deleteCase, fetchStatuses, fetchPartners, fetchInboundPaths, fetchSecondaryStatuses, addSecondaryStatus, deleteSecondaryStatus, fetchTertiaryStatuses, addTertiaryStatus, deleteTertiaryStatus, fetchCommunicationLogs, fetchSmsTemplates, saveSmsTemplate, enqueueSms } from './api';
import { useToast } from '../contexts/ToastContext';

// Keys
export const QUERY_KEYS = {
    cases: ['cases'],
    case: (id: string) => ['case', id],
    statuses: ['statuses'],
    secondaryStatuses: ['secondaryStatuses'], // [New]
    tertiaryStatuses: ['tertiaryStatuses'], // [New] 3차 상태
    partners: ['partners'],
    inboundPaths: ['inboundPaths'],
    communicationLogs: (phone: string) => ['communicationLogs', phone],
    smsTemplates: ['smsTemplates'],
};

// Hooks
export const useCases = () => {
    return useQuery({
        queryKey: QUERY_KEYS.cases,
        queryFn: fetchCases,
    });
};

export const useSecondaryStatuses = () => {
    return useQuery({
        queryKey: QUERY_KEYS.secondaryStatuses,
        queryFn: fetchSecondaryStatuses,
        staleTime: 1000 * 60 * 5, // 5 minutes
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
        staleTime: 1000 * 60 * 5, // 5 minutes (Changed from Infinity for better sync)
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

export const useAddSecondaryStatusMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: addSecondaryStatus,
        onSuccess: (updatedList) => {
            queryClient.setQueryData(QUERY_KEYS.secondaryStatuses, updatedList);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.secondaryStatuses });
            showToast('2차 상태가 추가되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('추가에 실패했습니다.', 'error');
        }
    });
};

export const useDeleteSecondaryStatusMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: deleteSecondaryStatus,
        onSuccess: (updatedList) => {
            queryClient.setQueryData(QUERY_KEYS.secondaryStatuses, updatedList);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.secondaryStatuses });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tertiaryStatuses }); // Also refresh tertiary
            showToast('2차 상태가 삭제되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('삭제에 실패했습니다.', 'error');
        }
    });
};

// --- Tertiary Statuses (3차 상태) ---
export const useTertiaryStatuses = () => {
    return useQuery({
        queryKey: QUERY_KEYS.tertiaryStatuses,
        queryFn: fetchTertiaryStatuses,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useAddTertiaryStatusMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: ({ secondaryStatus, status }: { secondaryStatus: string; status: string }) =>
            addTertiaryStatus(secondaryStatus, status),
        onSuccess: (updatedMap) => {
            queryClient.setQueryData(QUERY_KEYS.tertiaryStatuses, updatedMap);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tertiaryStatuses });
            showToast('3차 상태가 추가되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('추가에 실패했습니다.', 'error');
        }
    });
};

export const useDeleteTertiaryStatusMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: ({ secondaryStatus, status }: { secondaryStatus: string; status: string }) =>
            deleteTertiaryStatus(secondaryStatus, status),
        onSuccess: (updatedMap) => {
            queryClient.setQueryData(QUERY_KEYS.tertiaryStatuses, updatedMap);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tertiaryStatuses });
            showToast('3차 상태가 삭제되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('삭제에 실패했습니다.', 'error');
        }
    });
};

// --- Communication Logs & SMS ---
export const useCommunicationLogs = (phone: string | undefined) => {
    return useQuery({
        queryKey: QUERY_KEYS.communicationLogs(phone || ''),
        queryFn: () => fetchCommunicationLogs(phone || ''),
        enabled: !!phone,
    });
};

export const useSmsTemplates = () => {
    return useQuery({
        queryKey: QUERY_KEYS.smsTemplates,
        queryFn: fetchSmsTemplates,
    });
};

export const useSaveSmsTemplateMutation = () => {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    return useMutation({
        mutationFn: saveSmsTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.smsTemplates });
            showToast('템플릿이 저장되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            showToast('템플릿 저장에 실패했습니다.', 'error');
        }
    });
};

export const useEnqueueSmsMutation = () => {
    const { showToast } = useToast();

    return useMutation({
        mutationFn: ({ phone, content }: { phone: string; content: string }) => enqueueSms(phone, content),
        onSuccess: () => {
            showToast('문자 발송이 예약되었습니다. (스마트폰 앱에서 처리됩니다)');
        },
        onError: (error) => {
            console.error(error);
            showToast('문자 발송 예약에 실패했습니다.', 'error');
        }
    });
};
