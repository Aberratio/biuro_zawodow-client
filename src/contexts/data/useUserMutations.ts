import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Role, User } from "@/types";
import { API_BASE_URL, fetchJson } from "@/lib/api";
import { type ApiUser, mapApiUserToUi } from "@/lib/data-context-helpers";

interface MutationResult {
  ok: boolean;
  error?: string;
  entityId?: string;
  queued?: boolean;
}

type UserCreateInput = Omit<User, "id" | "password"> & { password?: string };
interface UserUpdateInput {
  name: string;
  email: string;
}

interface UseUserMutationsArgs {
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  ensureOnline: (message?: string) => string | null;
  runMutation: (
    executor: () => Promise<MutationResult>
  ) => Promise<MutationResult>;
  addLog: (action: string, participantName?: string) => void;
  markLocalDataChanged: () => void;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
  syncStoredAuthUser: (updater: (user: User) => User) => void;
}

export function useUserMutations({
  users,
  setUsers,
  ensureOnline,
  runMutation,
  addLog,
  markLocalDataChanged,
  getAuthHeaders,
  syncStoredAuthUser,
}: UseUserMutationsArgs) {
  const addUser = useCallback(
    async (userData: UserCreateInput) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const createUserPayload: Record<string, unknown> = {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          organization_id: userData.organization_id,
          assigned_events: userData.assigned_events,
        };
        if (userData.password) createUserPayload.password = userData.password;
        const payload = (
          await fetchJson(`${API_BASE_URL}/users`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify(createUserPayload),
          })
        ).payload as { data?: ApiUser };
        if (!payload.data)
          return { ok: false, error: "API user create returned empty payload" };
        markLocalDataChanged();
        const createdUser = mapApiUserToUi(payload.data);
        setUsers((previous) => [...previous, createdUser]);
        addLog(`Dodano użytkownika: ${createdUser.name}`);
        return { ok: true };
      }),
    [
      addLog,
      ensureOnline,
      getAuthHeaders,
      markLocalDataChanged,
      runMutation,
      setUsers,
    ]
  );

  const updateUser = useCallback(
    async (userId: string, data: UserUpdateInput) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/users/${userId}`, {
            method: "PATCH",
            headers: getAuthHeaders(true),
            body: JSON.stringify(data),
          })
        ).payload as { data?: ApiUser };
        if (!payload.data)
          return { ok: false, error: "API user update returned empty payload" };
        markLocalDataChanged();
        const updatedUser = mapApiUserToUi(payload.data);
        setUsers((previous) =>
          previous.map((user) => (user.id === userId ? updatedUser : user))
        );
        syncStoredAuthUser((user) => (user.id === userId ? updatedUser : user));
        return { ok: true };
      }),
    [
      ensureOnline,
      getAuthHeaders,
      markLocalDataChanged,
      runMutation,
      setUsers,
      syncStoredAuthUser,
    ]
  );

  const removeUser = useCallback(
    async (id: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingUser = users.find((user) => user.id === id);
        await fetchJson(`${API_BASE_URL}/users/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        setUsers((previous) => previous.filter((user) => user.id !== id));
        if (existingUser) addLog(`Usunięto użytkownika: ${existingUser.name}`);
        return { ok: true };
      }),
    [addLog, ensureOnline, getAuthHeaders, runMutation, setUsers, users]
  );

  const triggerUserPasswordReset = useCallback(
    async (id: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingUser = users.find((user) => user.id === id);
        await fetchJson(`${API_BASE_URL}/users/${id}/password-reset`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        if (existingUser)
          addLog(`Wysłano reset hasła użytkownikowi: ${existingUser.name}`);
        return { ok: true };
      }),
    [addLog, ensureOnline, getAuthHeaders, runMutation, users]
  );

  const setUserPassword = useCallback(
    async (id: string, password: string) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const existingUser = users.find((user) => user.id === id);
        await fetchJson(`${API_BASE_URL}/users/${id}/password`, {
          method: "PATCH",
          headers: getAuthHeaders(true),
          body: JSON.stringify({ password }),
        });
        if (existingUser)
          addLog(`Ustawiono hasło użytkownikowi: ${existingUser.name}`);
        return { ok: true };
      }),
    [addLog, ensureOnline, getAuthHeaders, runMutation, users]
  );

  const changeRole = useCallback(
    async (userId: string, role: Role) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/users/${userId}/role`, {
            method: "PATCH",
            headers: getAuthHeaders(true),
            body: JSON.stringify({ role }),
          })
        ).payload as { data?: ApiUser };
        if (!payload.data)
          return {
            ok: false,
            error: "API user role change returned empty payload",
          };
        const updatedUser = mapApiUserToUi(payload.data);
        setUsers((previous) =>
          previous.map((user) => (user.id === userId ? updatedUser : user))
        );
        syncStoredAuthUser((user) => (user.id === userId ? updatedUser : user));
        return { ok: true };
      }),
    [ensureOnline, getAuthHeaders, runMutation, setUsers, syncStoredAuthUser]
  );

  const assignScannerEvents = useCallback(
    async (userId: string, eventIds: string[]) =>
      runMutation(async () => {
        const offlineError = ensureOnline();
        if (offlineError) return { ok: false, error: offlineError };
        const payload = (
          await fetchJson(`${API_BASE_URL}/users/${userId}/event-assignments`, {
            method: "PATCH",
            headers: getAuthHeaders(true),
            body: JSON.stringify({ assigned_events: eventIds }),
          })
        ).payload as { data?: ApiUser };
        if (!payload.data)
          return {
            ok: false,
            error: "API scanner assignment returned empty payload",
          };
        markLocalDataChanged();
        const updatedUser = mapApiUserToUi(payload.data);
        setUsers((previous) =>
          previous.map((user) => (user.id === userId ? updatedUser : user))
        );
        syncStoredAuthUser((user) => (user.id === userId ? updatedUser : user));
        return { ok: true };
      }),
    [
      ensureOnline,
      getAuthHeaders,
      markLocalDataChanged,
      runMutation,
      setUsers,
      syncStoredAuthUser,
    ]
  );

  return {
    addUser,
    updateUser,
    removeUser,
    triggerUserPasswordReset,
    setUserPassword,
    changeRole,
    assignScannerEvents,
  };
}
