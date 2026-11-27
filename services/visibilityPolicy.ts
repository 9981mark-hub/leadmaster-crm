import { StoreKeySpec, loadOrgStore, mutateOrgStore, useOrgStore } from './orgStore';
import { OrgVisibilityPolicy, DEFAULT_ORG_VISIBILITY_POLICY } from './org';

export const VISIBILITY_POLICY_SPEC: StoreKeySpec<OrgVisibilityPolicy> = {
  key: 'visibilityPolicy',
  empty: () => ({ ...DEFAULT_ORG_VISIBILITY_POLICY }),
};

export const loadVisibilityPolicy = (): Promise<OrgVisibilityPolicy> =>
  loadOrgStore(VISIBILITY_POLICY_SPEC);

export const saveVisibilityPolicy = async (
  patch: Partial<OrgVisibilityPolicy>
): Promise<OrgVisibilityPolicy> => {
  const res = await mutateOrgStore(VISIBILITY_POLICY_SPEC, (curr) => ({
    ...DEFAULT_ORG_VISIBILITY_POLICY,
    ...curr,
    ...patch,
  }));
  if (!res.ok) throw new Error(res.error || '노출 정책 저장 실패');
  return res.value;
};

export const useVisibilityPolicy = (): OrgVisibilityPolicy => {
  const { value } = useOrgStore(VISIBILITY_POLICY_SPEC);
  return { ...DEFAULT_ORG_VISIBILITY_POLICY, ...value };
};
